"use client";

import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import { SesionGrupoCard } from "@/components/student/SesionGrupoCard";
import { posicionTecnica, resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";

/**
 * Parte la lista de ejercicios en grupos consecutivos de la misma familia de
 * técnica (superserie/biserie/triserie/circuito, ver `resolverGrupoTecnica`),
 * acotados por la numeración "(n/total)" que escribe el entrenador (ver
 * `posicionTecnica`) para no fusionar dos biseries seguidas en una de 4. Un
 * ejercicio suelto es un "grupo" de 1.
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
      const total = posicionTecnica(ejercicios[i].tecnicaTipo)?.total ?? null;
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
}: {
  ejercicios: EjercicioSesion[];
  sesionId: string;
  soloLectura: boolean;
  completados: number;
  total: number;
}) {
  const handles = useRef(new Map<string, SesionEjercicioCardHandle>());
  const ejercicioActivoId = calcularActivo(ejercicios);
  const grupos = agruparPorTecnica(ejercicios);
  const [guardado, setGuardado] = useState(false);
  const indiceActivo = Math.max(
    0,
    grupos.findIndex((grupo) => grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId))
  );
  const [indiceVisible, setIndiceVisible] = useState(indiceActivo);

  // Se conserva la tarjeta actual después de guardar: el próximo paso se
  // indica iluminando “Siguiente”, en vez de mover la pantalla sin avisar.
  const guardarTodo = () => {
    handles.current.forEach((handle) => handle.guardar());
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 2500);
  };

  const renderizarGrupo = (grupo: EjercicioSesion[]) => {
    if (grupo.length >= 2) {
      const activo = grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId);
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
        activo={grupo[0].sesionEjercicioId === ejercicioActivoId}
        modoEnfocado={!soloLectura}
      />
    );
  };

  const grupoVisible = grupos[indiceVisible] ?? grupos[0];
  const tituloVisible = grupoVisible?.map((ej) => ej.nombre).join(" + ") ?? "Entrenamiento";

  return (
    <>
      {soloLectura ? (
        grupos.map(renderizarGrupo)
      ) : grupoVisible ? (
        <section className="modo-entrenamiento-enfocado space-y-3" aria-label="Ejercicio actual">
          <div className="cabecera-modo-enfocado">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="icono-modo-enfocado" aria-hidden="true">
                <Dumbbell size={18} strokeWidth={2.6} />
              </span>
              <div className="min-w-0">
                <p className="text-micro font-bold uppercase tracking-[0.16em] text-vip">
                  Ahora entrenas
                </p>
                <p className="truncate text-caption font-semibold text-text">{tituloVisible}</p>
              </div>
            </div>
            <span className="contador-modo-enfocado">
              {indiceVisible + 1}/{grupos.length}
            </span>
          </div>

          {renderizarGrupo(grupoVisible)}

          <nav className="navegacion-modo-enfocado" aria-label="Navegar por los ejercicios">
            <button
              type="button"
              onClick={() => setIndiceVisible((indice) => Math.max(0, indice - 1))}
              disabled={indiceVisible === 0}
              className="boton-navegacion-ejercicio"
            >
              <ChevronLeft size={18} /> Anterior
            </button>

            <div className="flex items-center justify-center gap-1.5" aria-label={`Ejercicio ${indiceVisible + 1} de ${grupos.length}`}>
              {grupos.map((grupo, indice) => (
                <button
                  key={grupo[0].sesionEjercicioId}
                  type="button"
                  onClick={() => setIndiceVisible(indice)}
                  className="punto-rutina"
                  data-activo={indice === indiceVisible}
                  data-completo={grupo.every((ej) => ej.completado)}
                  aria-label={`Ir al ejercicio ${indice + 1}`}
                  aria-current={indice === indiceVisible ? "step" : undefined}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIndiceVisible((indice) => Math.min(grupos.length - 1, indice + 1))}
              disabled={indiceVisible === grupos.length - 1}
              className="boton-navegacion-ejercicio"
              data-recomendado={grupoVisible.every((ej) => ej.completado) ? "true" : "false"}
            >
              Siguiente <ChevronRight size={18} />
            </button>
          </nav>
        </section>
      ) : null}

      {!soloLectura && (
        <Button variant="secondary" onClick={guardarTodo} className="w-full">
          <Check size={16} strokeWidth={3} /> {guardado ? "Progreso guardado" : "Guardar ahora"}
        </Button>
      )}

      {!soloLectura && (
        <FinalizarEntrenamiento sesionId={sesionId} completados={completados} total={total} />
      )}
    </>
  );
}
