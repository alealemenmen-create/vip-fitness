"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import { resolverGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";

/**
 * Cuál ejercicio está "activo" ahora — el que se abre solo y lleva el
 * resplandor de "te toca acá".
 *
 * Para un ejercicio suelto es el de siempre: el primero sin completar, en el
 * orden de la rutina. Pero en una superserie/biserie/triserie/circuito (grupos
 * consecutivos con la misma familia de técnica, ver `resolverGrupoTecnica`)
 * se alterna DE VERDAD entre los ejercicios del grupo, serie por serie: el
 * que tiene menos series hechas hasta ahora es el que toca (empate = el
 * primero del grupo) — así después de una serie de "Aperturas (1/2)" el
 * turno pasa solo a "Pullover (2/2)", en vez de pedir el ejercicio entero
 * antes de pasar al siguiente.
 */
function calcularActivo(ejercicios: EjercicioSesion[]): string | null {
  let i = 0;
  while (i < ejercicios.length) {
    const familia = resolverGrupoTecnica(ejercicios[i].tecnicaTipo)?.etiqueta ?? null;
    let j = i;
    if (familia) {
      while (
        j + 1 < ejercicios.length &&
        resolverGrupoTecnica(ejercicios[j + 1].tecnicaTipo)?.etiqueta === familia
      ) {
        j++;
      }
    }
    const grupo = ejercicios.slice(i, j + 1);
    const pendientes = grupo.filter((e) => !e.completado);

    if (pendientes.length > 0) {
      if (grupo.length === 1) return pendientes[0].sesionEjercicioId;
      // Grupo real (2 o más): el que tiene menos series hechas manda —
      // empate lo gana el que aparece primero en `pendientes` (orden de la
      // rutina), porque `reduce` solo reemplaza con `<`, nunca con `<=`.
      const elegido = pendientes.reduce((mejor, actual) =>
        actual.series.filter((s) => s.realizada).length <
        mejor.series.filter((s) => s.realizada).length
          ? actual
          : mejor
      );
      return elegido.sesionEjercicioId;
    }

    i = j + 1;
  }
  return null;
}

/**
 * Lista de ejercicios de la sesión + un único botón "Guardar progreso"
 * general (en vez de uno por ejercicio) y "Finalizar entrenamiento" debajo.
 * El guardado automático por ejercicio (cuando terminan los descansos de
 * todas sus series) sigue funcionando igual — este botón es el respaldo
 * manual para guardar todo de una vez.
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
  const [guardado, setGuardado] = useState(false);

  const guardarTodo = () => {
    handles.current.forEach((handle) => handle.guardar());
    setGuardado(true);
    window.setTimeout(() => setGuardado(false), 2500);
  };

  return (
    <>
      {ejercicios.map((ej) => (
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
      ))}

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
