"use client";

import { useState } from "react";
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

function tituloBloque(bloque: EjercicioSesionV2[]) {
  return bloque.length > 1 ? bloque.map((item) => item.codigo).join("/") : bloque[0].codigo;
}

function FilaContenido({ bloque }: { bloque: EjercicioSesionV2[] }) {
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
      <FilaContenido bloque={bloque} />
    </div>
  );
}

/** Reordenar arrastrando en vez de con flechas, respetando bloques
 * (biserie/triserie/serie gigante se mueven como unidad). Un mantenido
 * corto (no 3 s: se siente lento) levanta el bloque en un overlay
 * flotante semi-transparente; soltarlo reordena. Flechas de teclado
 * siguen moviendo el bloque enfocado (dnd-kit KeyboardSensor), para no
 * perder accesibilidad con un gesto que es, por naturaleza, solo táctil. */
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
  const [bloqueActivo, setBloqueActivo] = useState<EjercicioSesionV2[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setBloqueActivo(null)}
    >
      <SortableContext items={bloques.map((bloque) => bloque[0].id)} strategy={verticalListSortingStrategy}>
        <div className={styles.ordenLista}>
          {bloques.map((bloque) => <FilaBloque key={bloque[0].id} bloque={bloque} deshabilitado={deshabilitado} />)}
        </div>
      </SortableContext>
      <DragOverlay>
        {bloqueActivo ? (
          <div className={`${styles.ordenFila} ${styles.ordenFilaLevantada}`}>
            <FilaContenido bloque={bloqueActivo} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
