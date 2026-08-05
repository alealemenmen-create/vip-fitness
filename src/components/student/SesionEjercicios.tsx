"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
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
 * Las biseries (grupos de EXACTAMENTE 2 ejercicios encadenados) se muestran
 * como una sola tarjeta combinada con las series intercaladas — ver
 * `SesionGrupoCard`. Un grupo de 3+ (triserie, giant set, circuito) sigue
 * mostrándose como tarjetas sueltas alternando turno, igual que antes.
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

  const guardarTodo = () => {
    handles.current.forEach((handle) => handle.guardar());
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 2500);
  };

  return (
    <>
      {grupos.map((grupo) => {
        if (grupo.length === 2) {
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
              ejercicios={[grupo[0], grupo[1]]}
              sesionId={sesionId}
              soloLectura={soloLectura}
              activo={activo}
            />
          );
        }
        return grupo.map((ej) => (
          <SesionEjercicioCard
            key={ej.sesionEjercicioId}
            ref={(handle) => {
              if (handle) handles.current.set(ej.sesionEjercicioId, handle);
              else handles.current.delete(ej.sesionEjercicioId);
            }}
            ejercicio={ej}
            sesionId={sesionId}
            soloLectura={soloLectura}
            activo={ej.sesionEjercicioId === ejercicioActivoId}
          />
        ));
      })}

      {!soloLectura && (
        <Button variant="accion" onClick={guardarTodo} className="w-full">
          <Check size={16} strokeWidth={3} /> {guardado ? "Progreso guardado" : "Guardar progreso"}
        </Button>
      )}

      {!soloLectura && (
        <FinalizarEntrenamiento sesionId={sesionId} completados={completados} total={total} />
      )}
    </>
  );
}
