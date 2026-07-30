"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";

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
  const ejercicioActivoId = ejercicios.find((e) => !e.completado)?.sesionEjercicioId ?? null;
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
