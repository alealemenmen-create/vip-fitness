"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import { SesionGrupoCard } from "@/components/student/SesionGrupoCard";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { resolverGrupoTecnica, tamanoGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";

const suscribirSinCambios = () => () => {};

/**
 * Parte la lista de ejercicios en grupos consecutivos de la misma familia de
 * técnica (superserie/biserie/triserie/circuito, ver `resolverGrupoTecnica`),
 * acotados por el tamaño del grupo (ver `tamanoGrupoTecnica`: la numeración
 * "(n/total)" si el entrenador la escribió, si no el default de la familia)
 * para no fusionar dos biseries seguidas en una de 4. Un ejercicio suelto es
 * un "grupo" de 1.
 *
 * Único punto donde se calculan los límites de grupo — tanto `calcularActivo`
 * como el render de abajo parten de acá, para que nunca puedan desincronizarse
 * entre sí sobre dónde empieza y termina cada biserie.
 */
function agruparPorTecnica(ejercicios: EjercicioSesion[]): EjercicioSesion[][] {
  const grupos: EjercicioSesion[][] = [];
  let i = 0;
  while (i < ejercicios.length) {
    const familia = resolverGrupoTecnica(ejercicios[i].tecnicaTipo)?.etiqueta ?? null;
    let j = i;
    if (familia) {
      // `tamanoGrupoTecnica` cae al default de la familia (bi=2, tri=3,
      // super=2) cuando el "(n/total)" no viene escrito — sin esto, dos
      // biseries seguidas sin numerar se fusionaban en un grupo de 4.
      const total = tamanoGrupoTecnica(ejercicios[i].tecnicaTipo);
      while (
        j + 1 < ejercicios.length &&
        resolverGrupoTecnica(ejercicios[j + 1].tecnicaTipo)?.etiqueta === familia &&
        (total === null || j - i + 1 < total)
      ) {
        j++;
      }
    }
    grupos.push(ejercicios.slice(i, j + 1));
    i = j + 1;
  }
  return grupos;
}

/**
 * Cuál ejercicio está "activo" ahora — el que se abre solo y lleva el
 * resplandor de "te toca acá".
 *
 * Para un ejercicio suelto es el de siempre: el primero sin completar, en el
 * orden de la rutina. Pero en una superserie/biserie/triserie/circuito se
 * alterna DE VERDAD entre los ejercicios del grupo, serie por serie: el que
 * tiene menos series hechas hasta ahora es el que toca (empate = el primero
 * del grupo) — así después de una serie de "Aperturas (1/2)" el turno pasa
 * solo a "Pullover (2/2)", en vez de pedir el ejercicio entero antes de pasar
 * al siguiente.
 */
function calcularActivo(ejercicios: EjercicioSesion[]): string | null {
  for (const grupo of agruparPorTecnica(ejercicios)) {
    const pendientes = grupo.filter((e) => !e.completado);
    if (pendientes.length === 0) continue;
    if (grupo.length === 1) return pendientes[0].sesionEjercicioId;
    // Grupo real (2 o más): el que tiene menos series hechas manda — empate
    // lo gana el que aparece primero en `pendientes` (orden de la rutina),
    // porque `reduce` solo reemplaza con `<`, nunca con `<=`.
    const elegido = pendientes.reduce((mejor, actual) =>
      actual.series.filter((s) => s.realizada).length < mejor.series.filter((s) => s.realizada).length
        ? actual
        : mejor
    );
    return elegido.sesionEjercicioId;
  }
  return null;
}

/**
 * Lista de ejercicios de la sesión + un único botón "Guardar progreso"
 * general (en vez de uno por ejercicio) y "Finalizar entrenamiento" debajo.
 * El guardado automático por ejercicio (cuando terminan los descansos de
 * todas sus series) sigue funcionando igual — este botón es el respaldo
 * manual para guardar todo de una vez.
 *
 * Cualquier técnica encadenada (biserie, triserie, giant set — 2 o más
 * ejercicios seguidos de la misma familia, ver `resolverGrupoTecnica`) se
 * muestra como una sola tarjeta combinada con las series intercaladas —
 * ver `SesionGrupoCard`.
 */
export function SesionEjercicios({
  ejercicios,
  sesionId,
  soloLectura,
  completados,
  total,
  modoCorreccion = false,
}: {
  ejercicios: EjercicioSesion[];
  sesionId: string;
  soloLectura: boolean;
  /**
   * Corrigiendo un registro cerrado (migración 0077): se edita, pero **toda la
   * rutina se muestra en lista**, no de a un ejercicio por vez.
   *
   * `soloLectura` decidía dos cosas a la vez —si se puede escribir Y si se ve
   * uno o todos— y por eso corregir caía en el modo enfocado del
   * entrenamiento: para arreglar un kilo del ejercicio 6 había que tocar
   * "Siguiente" cinco veces. Alejandro: "que cuando entre a la pantalla de
   * corregir me arroje la rutina en lista para verla mejor y corregirla muy
   * rápido". Son dos preguntas distintas y ahora son dos props distintas.
   *
   * También apaga `activo` en todas las tarjetas: en una sesión abandonada o
   * incompleta quedan ejercicios sin terminar, y sin esto el primero de ellos
   * arrancaría los descansos y los temporizadores. Corregir no es entrenar —
   * acá no corre ningún reloj.
   */
  modoCorreccion?: boolean;
  completados: number;
  total: number;
}) {
  const handles = useRef(new Map<string, SesionEjercicioCardHandle>());
  const ejercicioActivoId = calcularActivo(ejercicios);
  const grupos = agruparPorTecnica(ejercicios);
  const montado = useSyncExternalStore(suscribirSinCambios, () => true, () => false);
  const indiceActivo = Math.max(
    0,
    grupos.findIndex((grupo) => grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId))
  );
  const [indiceVisible, setIndiceVisible] = useState(indiceActivo);
  // Con 8-10 ejercicios la tira no entra entera y hay que desplazarla. Se
  // centra sola en el que se está mirando: si no, al entrar a mitad de sesión
  // el casillero activo quedaba fuera de la parte visible.
  const pistaRef = useRef<HTMLDivElement>(null);
  const casilleroActivoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    casilleroActivoRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [indiceVisible]);

  /**
   * Cambiar de ejercicio guarda lo que haya cargado en el que se deja.
   *
   * Solo se monta la tarjeta que se está mirando, así que moverse la desmonta:
   * sin esto, unos kilos escritos y no confirmados con "Listo" solo quedaban
   * en el respaldo del teléfono. Ahora cada movimiento por la barra los manda
   * también al servidor — y ese es el reemplazo real del botón "Guardar" que
   * se sacó, sin pedirle al alumno que se acuerde de nada.
   */
  const irA = (indice: number) => {
    handles.current.forEach((handle) => handle.guardar());
    setIndiceVisible(indice);
  };

  const avanzarDesdeEncuesta = (grupo: EjercicioSesion[]) => {
    const indice = grupos.findIndex((actual) => actual[0].sesionEjercicioId === grupo[0].sesionEjercicioId);
    if (indice >= 0 && indice < grupos.length - 1) setIndiceVisible(indice + 1);
  };

  const renderizarGrupo = (grupo: EjercicioSesion[]) => {
    if (grupo.length >= 2) {
      const activo = !modoCorreccion && grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId);
      return (
        <SesionGrupoCard
          key={grupo[0].sesionEjercicioId}
          ref={(handle) => {
            for (const ej of grupo) {
              if (handle) handles.current.set(ej.sesionEjercicioId, handle);
              else handles.current.delete(ej.sesionEjercicioId);
            }
          }}
          ejercicios={grupo}
          sesionId={sesionId}
          soloLectura={soloLectura}
          activo={activo}
          onDificultadRespondida={() => avanzarDesdeEncuesta(grupo)}
        />
      );
    }

    return (
      <SesionEjercicioCard
        key={grupo[0].sesionEjercicioId}
        ref={(handle) => {
          if (handle) handles.current.set(grupo[0].sesionEjercicioId, handle);
          else handles.current.delete(grupo[0].sesionEjercicioId);
        }}
        ejercicio={grupo[0]}
        sesionId={sesionId}
        soloLectura={soloLectura}
        activo={!modoCorreccion && grupo[0].sesionEjercicioId === ejercicioActivoId}
        modoEnfocado={!soloLectura && !modoCorreccion}
        onDificultadRespondida={() => avanzarDesdeEncuesta(grupo)}
      />
    );
  };

  const grupoVisible = grupos[indiceVisible] ?? grupos[0];
  const tituloVisible = grupoVisible?.map((ej) => ej.nombre).join(" + ") ?? "Entrenamiento";

  /* Los puntitos de antes decían "vas por el 3 de 7" pero no cuál era cada
     uno, así que para revisar un ejercicio había que ir tocando Siguiente a
     ciegas. Ahora en el medio va la rutina entera —un casillero por ejercicio,
     numerado— y el que se está mirando lleva borde violeta. Anterior y
     Siguiente se achicaron a solo la flecha y se corrieron a los extremos:
     ese ancho es justo el que necesitaba la fila de casilleros. */
  const navegacion = grupoVisible ? (
    <nav className="navegacion-modo-enfocado navegacion-modo-enfocado-fija" aria-label="Navegar por los ejercicios">
      <button
        type="button"
        onClick={() => irA(Math.max(0, indiceVisible - 1))}
        disabled={indiceVisible === 0}
        className="boton-navegacion-ejercicio boton-navegacion-atras"
        aria-label="Ejercicio anterior"
        title="Ejercicio anterior"
      >
        <ChevronLeft size={17} strokeWidth={3} />
        <ChevronLeft size={17} strokeWidth={3} className="-ml-2.5" />
      </button>

      <div
        ref={pistaRef}
        className="tira-ejercicios-rutina"
        aria-label={`Ejercicio ${indiceVisible + 1} de ${grupos.length}`}
      >
        {grupos.map((grupo, indice) => (
          <button
            key={grupo[0].sesionEjercicioId}
            type="button"
            ref={indice === indiceVisible ? casilleroActivoRef : undefined}
            onClick={() => irA(indice)}
            className="casillero-ejercicio-rutina"
            data-activo={indice === indiceVisible}
            data-completo={grupo.every((ej) => ej.completado)}
            aria-label={`Ir al ejercicio ${indice + 1}: ${grupo.map((ej) => ej.nombre).join(" + ")}`}
            aria-current={indice === indiceVisible ? "step" : undefined}
            data-encurso={indice === indiceActivo}
          >
            {indice === indiceActivo ? (
              /* El ejercicio que toca AHORA no lleva número: lleva las dos
                 flechitas corriendo hacia adelante, que es lo que se ve de
                 lejos con el celular apoyado en el piso. */
              <span className="flechas-ejercicio-en-curso" aria-hidden="true">
                <ChevronRight size={11} strokeWidth={3.5} />
                <ChevronRight size={11} strokeWidth={3.5} />
              </span>
            ) : grupo.every((ej) => ej.completado) ? (
              <Check size={13} strokeWidth={3.5} />
            ) : (
              indice + 1
            )}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => irA(Math.min(grupos.length - 1, indiceVisible + 1))}
        disabled={indiceVisible === grupos.length - 1}
        className="boton-navegacion-ejercicio boton-navegacion-adelante"
        data-recomendado={grupoVisible.every((ej) => ej.completado) ? "true" : "false"}
        aria-label="Ejercicio siguiente"
        title="Ejercicio siguiente"
      >
        <ChevronRight size={17} strokeWidth={3} />
        <ChevronRight size={17} strokeWidth={3} className="-ml-2.5" />
      </button>
    </nav>
  ) : null;

  return (
    <>
      {/* Dos motivos distintos para ver la rutina entera de una: mirarla sin
          poder tocarla (`soloLectura`) y corregirla (`modoCorreccion`). La
          diferencia está adentro de las tarjetas, que en corrección siguen
          siendo editables. */}
      {soloLectura || modoCorreccion ? (
        grupos.map(renderizarGrupo)
      ) : grupoVisible ? (
        <section className="modo-entrenamiento-enfocado space-y-2" aria-label="Ejercicio actual">
          <div className="flex min-w-0 items-center gap-2 px-1">
            <IlustracionEjercicio
              ilustracionSlug={null}
              grupoMuscular={grupoVisible[0].grupoMuscular}
              nombre={tituloVisible}
              tamano={30}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                Ejercicio {indiceVisible + 1} de {grupos.length}
              </p>
              <p className="text-caption truncate font-semibold text-vip">{tituloVisible}</p>
            </div>
          </div>

          {renderizarGrupo(grupoVisible)}

        </section>
      ) : null}

      {/* Ni barra de navegación ni "Finalizar entrenamiento" en una
          corrección: no hay ejercicio "en curso" que seguir ni entrenamiento
          que cerrar. De la corrección se sale con "Listo, terminé de
          corregir", que la pantalla pone arriba de las opciones. */}
      {montado && !soloLectura && !modoCorreccion && navegacion
        ? createPortal(navegacion, document.body)
        : null}

      {!soloLectura && !modoCorreccion && (
        <>
          {/* "Guardar" suelto ya no existe: guardar y completar el ejercicio
              eran dos toques para una sola intención, y el segundo casi nunca
              llegaba. Ahora "Completar y guardar" (dentro de cada tarjeta)
              hace las dos cosas, y las series se siguen guardando solas al
              terminar cada descanso. */}
          <div className="flex flex-col gap-2">
            {indiceVisible === grupos.length - 1 && (
              <FinalizarEntrenamiento sesionId={sesionId} completados={completados} total={total} compacto />
            )}
          </div>
          {/* Reserva suficiente recorrido al final del scroll para que
              Guardar, Finalizar y los paneles de nota/molestia puedan subir
              completamente por encima de las dos barras fijas. */}
          <div className="h-16" aria-hidden="true" />
        </>
      )}
    </>
  );
}
