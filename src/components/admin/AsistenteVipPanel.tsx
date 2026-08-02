"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Dumbbell,
  Megaphone,
  Salad,
  Send,
  Sparkles,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  consultarAsistenteVip,
  type EstadoAsistente,
} from "@/app/admin/asistente/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const ESTADO_INICIAL: EstadoAsistente = { respuesta: null, error: null };

const ATAJOS = [
  { texto: "¿Quién necesita atención hoy?", icono: AlertTriangle },
  { texto: "Dame el reporte nutricional de los últimos 7 días", icono: Salad },
  { texto: "Resume el cumplimiento de entrenamiento", icono: Dumbbell },
  { texto: "Analiza el progreso y los registros de peso", icono: TrendingUp },
  { texto: "Propón un duelo equilibrado para Arena VIP", icono: Swords },
  { texto: "Prepara una noticia positiva con datos de esta semana", icono: Megaphone },
] as const;

function urlArena(reto: NonNullable<EstadoAsistente["respuesta"]>["propuestaReto"]): string {
  if (!reto) return "/admin/torneos";
  const params = new URLSearchParams({
    ia: "1",
    nombre: reto.nombre,
    descripcion: reto.descripcion,
    regla: reto.reglaPublica,
    modalidad: reto.modalidad,
    metrica: reto.metrica,
    puntos: String(reto.puntosEnJuego),
    ladoA: reto.alumnoIds[0],
    ladoB: reto.alumnoIds[1],
  });
  return `/admin/torneos?${params.toString()}`;
}

function urlNoticia(noticia: NonNullable<EstadoAsistente["respuesta"]>["borradorNoticia"]): string {
  if (!noticia) return "/admin/noticias";
  const params = new URLSearchParams({ ia: "1", titulo: noticia.titulo, mensaje: noticia.mensaje });
  return `/admin/noticias?${params.toString()}`;
}

export function AsistenteVipPanel({ totalAlumnos }: { totalAlumnos: number }) {
  const [estado, accion, pendiente] = useActionState(consultarAsistenteVip, ESTADO_INICIAL);
  const [solicitud, setSolicitud] = useState("");
  const respuesta = estado.respuesta;

  return (
    <div className="space-y-4">
      <Card className="panel-vip-espejo efecto-3d overflow-hidden !p-0">
        <div className="border-b border-vip/20 bg-vip/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-vip text-black">
              <Bot size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-h3 text-text">Asistente VIP</h1>
                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-micro font-semibold text-success">
                  SOLO LECTURA
                </span>
              </div>
              <p className="text-caption mt-1 text-text-secondary">
                Analiza {totalAlumnos} alumnos. Tú confirmas antes de publicar cualquier cosa.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          <form action={accion} className="space-y-3">
            <label htmlFor="solicitud-ia" className="sr-only">Pregunta para el Asistente VIP</label>
            <textarea
              id="solicitud-ia"
              name="solicitud"
              rows={3}
              maxLength={500}
              required
              value={solicitud}
              onChange={(evento) => setSolicitud(evento.target.value)}
              placeholder="Ej: Propón un reto justo entre alumnos con rendimiento parecido..."
              className="radius-control w-full resize-none border border-border bg-surface-2 px-4 py-3 text-body text-text outline-none focus:border-vip"
            />
            <Button type="submit" loading={pendiente} disabled={!solicitud.trim()}>
              <Send size={17} /> {pendiente ? "Analizando datos..." : "Preguntar al Asistente"}
            </Button>
          </form>
        </div>
      </Card>

      {!respuesta && !pendiente && (
        <div className="space-y-2">
          <p className="text-caption font-semibold text-text-tertiary">PREGUNTAS RÁPIDAS</p>
          <div className="grid grid-cols-2 gap-2">
            {ATAJOS.map(({ texto, icono: Icono }) => (
              <button
                key={texto}
                type="button"
                onClick={() => setSolicitud(texto)}
                className="radius-control flex min-h-24 flex-col items-start justify-between border border-border bg-surface p-3 text-left transition-colors hover:border-vip/50"
              >
                <Icono size={18} className="text-vip" />
                <span className="text-caption text-text">{texto}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pendiente && (
        <Card className="puntos-vip-entrada">
          <div className="flex items-center gap-3">
            <Sparkles size={21} className="animate-pulse text-vip" />
            <div>
              <p className="text-secondary font-semibold text-text">Cruzando datos verificados</p>
              <p className="text-caption text-text-tertiary">Entrenamiento, alimentación, progreso y ranking.</p>
            </div>
          </div>
        </Card>
      )}

      {estado.error && !respuesta && <p className="text-caption text-error">{estado.error}</p>}

      {respuesta && (
        <div className="space-y-3 puntos-vip-entrada">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-card-title text-text">{respuesta.titulo}</h2>
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-1 text-micro text-text-tertiary">
                {respuesta.usoIA ? "IA + datos VIP" : "Datos VIP"}
              </span>
            </div>
            <p className="text-secondary text-text-secondary">{respuesta.resumen}</p>
            {respuesta.aviso && (
              <p className="text-caption mt-3 border-t border-border pt-3 text-text-tertiary">{respuesta.aviso}</p>
            )}
          </Card>

          {respuesta.hallazgos.length > 0 && (
            <Card className="!p-4">
              <p className="text-caption mb-3 font-semibold text-text-tertiary">HALLAZGOS EXPLICADOS</p>
              <div className="divide-y divide-border">
                {respuesta.hallazgos.map((hallazgo, indice) => (
                  <div key={`${hallazgo.alumnoId ?? "general"}-${indice}`} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2.5">
                      {hallazgo.prioridad === "alta" ? (
                        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-error" />
                      ) : (
                        <CheckCircle2 size={17} className={`mt-0.5 shrink-0 ${hallazgo.prioridad === "positiva" ? "text-success" : "text-vip"}`} />
                      )}
                      <div>
                        {hallazgo.nombre && <p className="text-secondary font-semibold text-text">{hallazgo.nombre}</p>}
                        <p className="text-caption mt-0.5 text-text-secondary">{hallazgo.detalle}</p>
                        {hallazgo.alumnoId && (
                          <Link href={`/admin/alumnos/${hallazgo.alumnoId}`} className="text-caption mt-1 inline-flex items-center gap-1 font-semibold text-vip">
                            Abrir alumno <ArrowRight size={13} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {respuesta.propuestaReto && (
            <Card className="border border-vip/40 !p-4">
              <div className="mb-3 flex items-center gap-2 text-vip">
                <Swords size={19} />
                <p className="text-caption font-bold">RETO PROPUESTO POR IA</p>
              </div>
              <h3 className="text-card-title text-text">{respuesta.propuestaReto.nombre}</h3>
              <p className="text-caption mt-1 text-text-secondary">{respuesta.propuestaReto.descripcion}</p>

              <div className="my-3 rounded-2xl bg-surface-2 p-3">
                <p className="text-caption text-text-tertiary">PARTICIPANTES PROPUESTOS</p>
                <p className="text-secondary mt-1 font-semibold text-text">
                  {respuesta.propuestaReto.alumnos[0]} <span className="text-vip">vs.</span> {respuesta.propuestaReto.alumnos[1]}
                </p>
                <p className="text-caption mt-2 text-text-tertiary">{respuesta.propuestaReto.razon}</p>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-vip/10 p-2">
                  <p className="text-micro text-text-tertiary">BOLSA VIP</p>
                  <p className="text-secondary font-bold text-vip">500 pts</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <p className="text-micro text-text-tertiary">GANADOR</p>
                  <p className="text-secondary font-bold text-text">400 pts</p>
                </div>
                <div className="rounded-xl bg-surface-2 p-2">
                  <p className="text-micro text-text-tertiary">2.º LUGAR</p>
                  <p className="text-secondary font-bold text-text">100 pts</p>
                </div>
              </div>
              <p className="text-caption mb-3 text-text-tertiary">
                Empate: 250 puntos para cada uno. Nadie pierde puntos. Ambos deben aceptar antes de competir.
              </p>
              <Link href={urlArena(respuesta.propuestaReto)} className="btn-accion radius-control flex w-full items-center justify-center gap-2 px-4 py-3 text-secondary font-bold">
                Revisar y publicar en Arena <ArrowRight size={17} />
              </Link>
            </Card>
          )}

          {respuesta.borradorNoticia && (
            <Card className="!p-4">
              <div className="mb-2 flex items-center gap-2 text-vip">
                <Megaphone size={18} />
                <p className="text-caption font-bold">BORRADOR DE NOTICIA</p>
              </div>
              <p className="text-secondary font-semibold text-text">{respuesta.borradorNoticia.titulo}</p>
              <p className="text-caption mt-1 text-text-secondary">{respuesta.borradorNoticia.mensaje}</p>
              <Link href={urlNoticia(respuesta.borradorNoticia)} className="text-secondary mt-3 inline-flex items-center gap-1.5 font-semibold text-vip">
                Revisar antes de publicar <ArrowRight size={15} />
              </Link>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
