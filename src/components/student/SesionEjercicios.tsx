"use client";

import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { CuadroFotoReferencia, SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import { SesionGrupoCard } from "@/components/student/SesionGrupoCard";
import { resolverGrupoTecnica, tamanoGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";

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
  const indiceActivo = Math.max(
    0,
    grupos.findIndex((grupo) => grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId))
  );
  const [indiceVisible, setIndiceVisible] = useState(indiceActivo);

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
          modoEnfocado={!soloLectura && !modoCorreccion}
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
  const grupoSiguiente = grupos[indiceVisible + 1] ?? null;

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
          {renderizarGrupo(grupoVisible)}

          {grupoSiguiente && (
            <div className="vista-siguiente-ejercicio">
              <CuadroFotoReferencia
                ilustracionSlug={grupoSiguiente[0].ilustracionSlug}
                fotoMiniaturaUrl={grupoSiguiente[0].fotoMiniaturaUrl}
                fotoCompletaUrl={grupoSiguiente[0].fotoCompletaUrl}
                videoUrl={grupoSiguiente[0].videoUrl}
                videoCloudflareUid={grupoSiguiente[0].videoCloudflareUid}
                videoCloudflareEstado={grupoSiguiente[0].videoCloudflareEstado}
                videoCloudflareMiniaturaUrl={grupoSiguiente[0].videoCloudflareMiniaturaUrl}
                nombre={grupoSiguiente[0].nombre}
                sesionEjercicioId={grupoSiguiente[0].sesionEjercicioId}
                ejercicioId={grupoSiguiente[0].ejercicioId}
                fotoCuadradaX={grupoSiguiente[0].fotoCuadradaX}
                fotoCuadradaY={grupoSiguiente[0].fotoCuadradaY}
                compacto
                tamanoCompacto={52}
              />
              <button
                type="button"
                onClick={() => irA(indiceVisible + 1)}
                aria-label={`Ver siguiente ejercicio: ${grupoSiguiente.map((ejercicio) => ejercicio.nombre).join(" + ")}`}
              >
                <span>Siguiente</span>
                <strong>{grupoSiguiente.map((ejercicio) => ejercicio.nombre).join(" + ")}</strong>
                <ChevronRight size={21} />
              </button>
            </div>
          )}

        </section>
      ) : null}

      {/* Ni barra de navegación ni "Finalizar entrenamiento" en una
          corrección: no hay ejercicio "en curso" que seguir ni entrenamiento
          que cerrar. De la corrección se sale con "Listo, terminé de
          corregir", que la pantalla pone arriba de las opciones. */}
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
