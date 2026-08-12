"use client";

import { useState } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { finalizarSesion } from "@/app/alumno/entrenar/actions";
import { BotonFinalizarSesion } from "@/components/student/BotonFinalizarSesion";
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";

export function FinalizarEntrenamiento({
  sesionId,
  completados,
  total,
  esDescanso = false,
  compacto = false,
}: {
  sesionId: string;
  completados: number;
  total: number;
  esDescanso?: boolean;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [ultimaConfirmacion, setUltimaConfirmacion] = useState(false);
  const pendientes = total - completados;
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0;
  const puntos = calcularPuntosEntrenamiento(completados, total);
  // Reportado por varios alumnos: "mucho protocolo para finalizar". Las dos
  // pantallas de confirmación tienen sentido cuando quedan ejercicios sin
  // hacer (ahí sí hay algo que se pierde si finaliza por error), pero con
  // TODO completado no hay nada que arriesgar — preguntar dos veces ahí solo
  // frena a quien ya terminó. Sin quedar en cero confirmaciones: sigue
  // habiendo una sola pantalla antes de acreditar los puntos, y además queda
  // "Corregir registro" (ReabrirSesionBoton) por si se tocó de más.
  const abrir = () => {
    setAbierto(true);
    setUltimaConfirmacion(pendientes <= 0);
  };

  if (!abierto) {
    if (compacto && !esDescanso) {
      return (
        <button
          type="button"
          onClick={abrir}
          className="boton-finalizar-celebracion group flex min-h-[72px] w-full items-center gap-3 rounded-[20px] px-4 text-left text-black active:scale-[0.985]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-black/15 ring-1 ring-black/15">
            <Trophy size={23} strokeWidth={2.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-micro font-black uppercase tracking-[0.15em]">
              <Sparkles size={12} /> {completados === total ? "¡Rutina completada!" : "¡Gran trabajo!"}
            </span>
            <span className="mt-0.5 block text-base font-black leading-tight">Finalizar entrenamiento</span>
          </span>
          <span className="shrink-0 rounded-full bg-black px-2.5 py-1.5 text-sm font-black text-vip">
            +{puntos} pts
          </span>
        </button>
      );
    }

    return (
      <Button variant="accion" size={compacto ? "xs" : "lg"} onClick={abrir} className="w-full">
        {esDescanso ? "Marcar día como completado" : `Finalizar y sumar +${puntos} pts`}
      </Button>
    );
  }

  if (!ultimaConfirmacion) {
    return (
      <Card className={compacto ? "col-span-2" : ""}>
        <p className="text-card-title text-text">¿Seguro que quieres finalizar?</p>
        {!esDescanso && (
          <p className="text-caption mt-1 text-text-secondary">
            Llevas {completados} de {total} ejercicios ({pct}%).
          </p>
        )}
        {!esDescanso && pendientes > 0 && (
          <p className="text-caption mt-2 text-error">
            Aún tienes {pendientes} {pendientes === 1 ? "ejercicio pendiente" : "ejercicios pendientes"}.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="primary" size="sm" className="flex-1" onClick={() => setUltimaConfirmacion(true)}>
            Sí, continuar
          </Button>
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setAbierto(false)}>
            Volver
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={compacto ? "col-span-2" : ""}>
      <p className="text-card-title text-text">Última confirmación</p>
      <p className="text-caption mt-1 text-text-secondary">Al confirmar, esta sesión quedará finalizada.</p>
      {!esDescanso && (
        <p className="text-body mt-2 text-text">
          {completados} de {total} ejercicios completados ({pct}%)
        </p>
      )}
      {!esDescanso && pendientes > 0 && (
        <p className="text-secondary mt-1 text-error">
          Tienes {pendientes} ejercicios pendientes. ¿Deseas finalizar igualmente?
        </p>
      )}
      <form action={finalizarSesion} className="mt-4 space-y-3">
        <input type="hidden" name="sesion_id" value={sesionId} />
        <Textarea
          name="comentario"
          rows={2}
          placeholder={esDescanso ? "¿Qué hiciste hoy? (opcional)" : "Comentario opcional"}
        />
        <div className="flex gap-2">
          <BotonFinalizarSesion variant="primary" size="sm" className="flex-1">
            {puntos > 0 ? `Confirmar +${puntos} pts` : "Confirmar"}
          </BotonFinalizarSesion>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => {
              setUltimaConfirmacion(false);
              setAbierto(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
