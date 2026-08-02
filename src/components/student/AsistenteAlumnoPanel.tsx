"use client";

import { useActionState, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { preguntarAsistenteAlumno, type EstadoAsistenteAlumno } from "@/app/alumno/asistente/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const INICIAL: EstadoAsistenteAlumno = { respuesta: null, error: null };
const PREGUNTAS = [
  "¿Qué entrené recientemente?",
  "¿Cuánto levanté la última vez en pecho?",
  "¿Qué recordatorios tengo hoy?",
  "Explícame cómo recuperarme mejor después de entrenar",
];

export function AsistenteAlumnoPanel() {
  const [estado, accion, pendiente] = useActionState(preguntarAsistenteAlumno, INICIAL);
  const [pregunta, setPregunta] = useState("");

  return (
    <div className="space-y-3">
      <Card className="panel-vip-espejo !p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vip text-black"><Bot size={22} /></div>
          <div>
            <h1 className="text-card-title text-text">Asistente VIP</h1>
            <p className="text-caption text-text-tertiary">Conoce tu historial y te orienta sin reemplazar a tu entrenador.</p>
          </div>
        </div>
        <form action={accion} className="space-y-3">
          <textarea
            name="pregunta"
            value={pregunta}
            onChange={(evento) => setPregunta(evento.target.value)}
            rows={3}
            minLength={5}
            maxLength={500}
            required
            placeholder="Pregúntame por tu entrenamiento, alimentación o progreso…"
            className="radius-control w-full resize-none border border-border bg-surface-2 px-4 py-3 text-secondary text-text outline-none focus:border-vip"
          />
          <Button type="submit" loading={pendiente} disabled={!pregunta.trim()}>
            <Send size={17} /> {pendiente ? "Revisando tu historial…" : "Preguntar"}
          </Button>
        </form>
      </Card>

      {!estado.respuesta && !pendiente && (
        <div className="grid grid-cols-2 gap-2">
          {PREGUNTAS.map((texto) => (
            <button key={texto} type="button" onClick={() => setPregunta(texto)} className="radius-control min-h-20 border border-border bg-surface p-3 text-left text-caption text-text">
              <Sparkles size={15} className="mb-2 text-vip" /> {texto}
            </button>
          ))}
        </div>
      )}

      {estado.error && <p className="text-caption rounded-xl bg-error/10 p-3 text-error">{estado.error}</p>}
      {estado.respuesta && (
        <Card className="border border-vip/30 !p-4 puntos-vip-entrada">
          <p className="text-micro font-bold text-vip">RESPUESTA PERSONAL</p>
          <p className="text-secondary mt-2 whitespace-pre-line text-text-secondary">{estado.respuesta.texto}</p>
          {estado.respuesta.aviso && <p className="text-caption mt-3 border-t border-border pt-3 text-warning">{estado.respuesta.aviso}</p>}
        </Card>
      )}
    </div>
  );
}

