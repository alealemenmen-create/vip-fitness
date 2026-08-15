"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronRight, Sparkles, Trophy } from "lucide-react";
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
  const [celebracionForzada, setCelebracionForzada] = useState(false);
  useEffect(() => {
    const abrirCelebracion = () => {
      setCelebracionForzada(true);
      setAbierto(true);
      setUltimaConfirmacion(true);
    };
    window.addEventListener("vip:celebrar-final-rutina", abrirCelebracion);
    return () => window.removeEventListener("vip:celebrar-final-rutina", abrirCelebracion);
  }, []);
  const completadosParaCierre = celebracionForzada ? total : completados;
  const pendientes = total - completadosParaCierre;
  const pct = total > 0 ? Math.round((completadosParaCierre / total) * 100) : 0;
  const puntos = calcularPuntosEntrenamiento(completadosParaCierre, total);
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
    if (compacto && !esDescanso && pendientes <= 0) {
      return (
        <button
          type="button"
          onClick={abrir}
          className="boton-finalizar-celebracion group flex w-full items-center gap-3 text-left active:scale-[0.985]"
        >
          <span className="finalizacion-sello" aria-hidden>
            <Trophy size={22} strokeWidth={1.8} />
            <Sparkles size={10} strokeWidth={2.4} />
          </span>
          <span className="finalizacion-texto min-w-0 flex-1">
            <span className="finalizacion-estado">
              {completados === total ? "Rutina completada" : "Gran trabajo"}
            </span>
            <span className="finalizacion-titulo">Finalizar entrenamiento</span>
            <span className="finalizacion-detalle">
              {completadosParaCierre} de {total} ejercicios registrados
            </span>
          </span>
          <span className="finalizacion-puntos">
            <strong>+{puntos}</strong>
            <small>PTS VIP</small>
          </span>
          <span className="finalizacion-avanzar" aria-hidden>
            <ChevronRight size={18} strokeWidth={2} />
          </span>
        </button>
      );
    }

    if (compacto && !esDescanso) {
      return (
        <button
          type="button"
          onClick={abrir}
          className="boton-finalizar-incompleta w-full text-left"
        >
          <span>Finalizar rutina incompleta</span>
          <small>
            {pendientes} {pendientes === 1 ? "ejercicio pendiente" : "ejercicios pendientes"} · {completados}/{total} completados
          </small>
        </button>
      );
    }

    return (
      <Button variant="accion" size={compacto ? "xs" : "lg"} onClick={abrir} className="w-full">
        {esDescanso ? "Marcar día como completado" : `Finalizar y sumar +${puntos} pts`}
      </Button>
    );
  }

  // El cierre de una rutina completa es un hito, no otra tarjeta más abajo.
  // Se presenta sobre la sesión para que el alumno vea claramente la
  // recompensa antes de acreditarla, sin pedir una segunda confirmación fría.
  if (compacto && !esDescanso && pendientes <= 0) {
    return createPortal(
      <div className="celebracion-final-fondo" role="dialog" aria-modal="true" aria-labelledby="celebracion-final-titulo">
        <div className="celebracion-final-borde" aria-hidden />
        <section className="celebracion-final-panel">
          <div className="celebracion-chispas" aria-hidden>
            <span /><span /><span /><span /><span />
          </div>
          <div className="celebracion-final-emblema" aria-hidden>
            <Trophy size={34} strokeWidth={1.65} />
            <Sparkles size={16} strokeWidth={2.2} />
          </div>
          <p className="celebracion-final-etiqueta">Entrenamiento completado</p>
          <h2 id="celebracion-final-titulo">Excelente trabajo</h2>
          <p className="celebracion-final-resumen">Completaste los {total} ejercicios de tu rutina.</p>
          <div className="celebracion-final-puntos">
            <span>RECOMPENSA VIP</span>
            <strong>+{puntos}</strong>
            <small>puntos para tu ranking</small>
          </div>
          <form action={finalizarSesion} className="celebracion-final-acciones">
            <input type="hidden" name="sesion_id" value={sesionId} />
            <BotonFinalizarSesion variant="primary" size="sm" className="celebracion-final-confirmar">
              <CheckCircle2 size={18} strokeWidth={2.5} /> Acreditar mis puntos
            </BotonFinalizarSesion>
          </form>
          <button type="button" className="celebracion-final-volver" onClick={() => {
            setAbierto(false);
            setCelebracionForzada(false);
          }}>
            Volver a revisar la rutina
          </button>
        </section>
      </div>,
      document.body
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
            {pendientes <= 0 ? "Revisar registros" : "Cancelar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
