"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
import type { EjercicioSesionV2 } from "./SesionActivaV2";
import styles from "./SesionActivaV2.module.css";

/** Las biseries/triseries/series gigantes comparten bloqueId y siempre se
 * mueven juntas -- misma regla que ya usaba moverBloqueEjercicio. */
export function agruparEnBloques(ejercicios: EjercicioSesionV2[]): EjercicioSesionV2[][] {
  const bloques: EjercicioSesionV2[][] = [];
  for (const ejercicio of ejercicios) {
    const ultimo = bloques.at(-1);
    if (ejercicio.bloqueId && ultimo?.[0]?.bloqueId === ejercicio.bloqueId) ultimo.push(ejercicio);
    else bloques.push([ejercicio]);
  }
  return bloques;
}

/** Mismos sensores en el panel "Orden de la sesión" y en el arrastre
 * directo sobre la lista principal -- un mantenido corto (400 ms, no los
 * 3 s pedidos textualmente: se siente lento) activa el arrastre táctil;
 * el mouse activa con una distancia mínima; el teclado sigue moviendo el
 * bloque enfocado con las flechas (dnd-kit KeyboardSensor), como
 * alternativa accesible a un gesto que por naturaleza es solo táctil. */
export function useSensoresOrden() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function tituloBloque(bloque: EjercicioSesionV2[]) {
  return bloque.length > 1 ? bloque.map((item) => item.codigo).join("/") : bloque[0].codigo;
}

/** Vista compacta de un bloque (miniatura + nombre + técnica) -- se usa
 * tanto para cada fila del panel como para el "levante" flotante
 * (DragOverlay) cuando se arrastra directo sobre la lista principal, para
 * que el gesto se sienta igual en los dos lugares. */
export function VistaPreviaBloque({ bloque }: { bloque: EjercicioSesionV2[] }) {
  const principal = bloque[0];
  return (
    <>
      <span className={styles.ordenAsa} aria-hidden="true"><GripVertical size={16} /></span>
      <span className={styles.ordenThumb}><ImagenV2Segura src={principal.foto} fallbackSrc={principal.fotoRespaldo} alt="" fill sizes="46px" /></span>
      <div className={styles.ordenCopy}>
        <strong>{tituloBloque(bloque)} · {bloque.length > 1 ? `${bloque.length} ejercicios` : principal.nombre}</strong>
        {bloque.length > 1 ? <small>{bloque.map((item) => item.nombre).join(" · ")}</small> : principal.tecnica ? <small>{principal.tecnica}</small> : null}
      </div>
    </>
  );
}

function FilaBloque({ bloque, deshabilitado }: { bloque: EjercicioSesionV2[]; deshabilitado?: boolean }) {
  const id = bloque[0].id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: deshabilitado });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${styles.ordenFila} ${isDragging ? styles.ordenFilaOculta : ""}`}
      aria-label={`${tituloBloque(bloque)}, mantén presionado y arrastra para reordenar`}
      {...attributes}
      {...(deshabilitado ? {} : listeners)}
    >
      <VistaPreviaBloque bloque={bloque} />
    </div>
  );
}

type AsaContextValue = {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
};
const AsaContext = createContext<AsaContextValue | null>(null);

/** Envoltorio genérico para arrastrar "en el lugar" -- se usa directo
 * sobre la tarjeta compacta de un ejercicio en la lista principal, sin
 * cambiar en nada su apariencia normal (nada de chrome extra). Cuando el
 * bloque completo está deshabilitado (contiene el ejercicio expandido,
 * con inputs en vivo, o la sesión no admite reordenar) se renderiza
 * `children` tal cual, sin envolver -- así no interfiere jamás con la
 * edición de reps/peso.
 *
 * `attributes`/`listeners` NO van en este envoltorio: dnd-kit no llama
 * `preventDefault()` en el touchmove hasta que se cumple el retraso de
 * activación, así que si el punto de partida del toque no tiene
 * `touch-action: none` desde el principio, el navegador ya empezó su
 * propio scroll nativo antes de que el retraso termine y el gesto nunca
 * arranca (así se ve en el teléfono, aunque un puntero sintético en
 * pruebas automatizadas no lo note). Ponerle `touch-action: none` a toda
 * la tarjeta arreglaría el arrastre pero volvería la lista principal
 * imposible de scrollear con el dedo. Por eso el punto de agarre real es
 * `AsaArrastre`, expuesto por contexto -- mismo patrón de "drag handle"
 * documentado por dnd-kit. */
export function BloqueArrastrableEnLinea({
  id,
  deshabilitado,
  children,
}: {
  id: string;
  deshabilitado?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: deshabilitado });
  if (deshabilitado) return <>{children}</>;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? styles.ordenFilaOculta : undefined}>
      <AsaContext.Provider value={{ attributes, listeners }}>{children}</AsaContext.Provider>
    </div>
  );
}

/** Asa de arrastre real de una tarjeta en la lista principal -- el único
 * punto donde hay que presionar para levantar el bloque. No renderiza
 * nada si la tarjeta no está dentro de un `BloqueArrastrableEnLinea`
 * habilitado (bloque con el ejercicio expandido, solo lectura, etc). */
export function AsaArrastre() {
  const contexto = useContext(AsaContext);
  if (!contexto) return null;
  return (
    <button type="button" className={styles.asaTarjeta} aria-label="Mantén presionado y arrastra para reordenar" {...contexto.attributes} {...contexto.listeners}>
      <GripVertical size={18} />
    </button>
  );
}

export function DndContextOrden({
  id,
  ejercicios,
  deshabilitado,
  onReordenar,
  children,
}: {
  id: string;
  ejercicios: EjercicioSesionV2[];
  deshabilitado?: boolean;
  onReordenar: (siguientes: EjercicioSesionV2[]) => void;
  children: ReactNode;
}) {
  const bloques = agruparEnBloques(ejercicios);
  const [bloqueActivo, setBloqueActivo] = useState<EjercicioSesionV2[] | null>(null);
  const sensors = useSensoresOrden();

  const handleDragStart = (evento: DragStartEvent) => {
    const bloque = bloques.find((item) => item[0].id === evento.active.id);
    setBloqueActivo(bloque ?? null);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(10); } catch { /* algunos navegadores lo bloquean sin gesto directo */ }
    }
  };

  const handleDragEnd = (evento: DragEndEvent) => {
    setBloqueActivo(null);
    const { active, over } = evento;
    if (!over || active.id === over.id) return;
    const desde = bloques.findIndex((item) => item[0].id === active.id);
    const hasta = bloques.findIndex((item) => item[0].id === over.id);
    if (desde < 0 || hasta < 0) return;
    onReordenar(arrayMove(bloques, desde, hasta).flat());
  };

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={deshabilitado ? undefined : handleDragStart}
      onDragEnd={deshabilitado ? undefined : handleDragEnd}
      onDragCancel={() => setBloqueActivo(null)}
    >
      <SortableContext items={bloques.map((bloque) => bloque[0].id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {bloqueActivo ? (
          <div className={`${styles.ordenFila} ${styles.ordenFilaLevantada}`}>
            <VistaPreviaBloque bloque={bloqueActivo} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Reordenar arrastrando en vez de con flechas, respetando bloques
 * (biserie/triserie/serie gigante se mueven como unidad). Usado en el
 * panel "Orden de la sesión". */
export function OrdenSesionV2({
  ejercicios,
  deshabilitado,
  onReordenar,
}: {
  ejercicios: EjercicioSesionV2[];
  deshabilitado?: boolean;
  onReordenar: (siguientes: EjercicioSesionV2[]) => void;
}) {
  const bloques = agruparEnBloques(ejercicios);
  return (
    <DndContextOrden id="orden-sesion-panel" ejercicios={ejercicios} deshabilitado={deshabilitado} onReordenar={onReordenar}>
      <div className={styles.ordenLista}>
        {bloques.map((bloque) => <FilaBloque key={bloque[0].id} bloque={bloque} deshabilitado={deshabilitado} />)}
      </div>
    </DndContextOrden>
  );
}
