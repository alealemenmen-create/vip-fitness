"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Dumbbell,
  Info,
  Salad,
  Search,
  Sparkles,
  TrendingUp,
  Send,
  Megaphone,
} from "lucide-react";
import {
  consultarAsistenteVip,
  confirmarEliminacionDatos,
  type EstadoAsistente,
} from "@/app/admin/asistente/actions";
import { ETIQUETA_CATEGORIA_ELIMINACION, type EstadoReporteVip, type TipoReporteVip } from "@/lib/asistente/tipos";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EliminarPerfilBoton } from "@/components/admin/EliminarPerfilBoton";

const ESTADO_INICIAL: EstadoAsistente = { respuesta: null, respuestaIA: null, error: null };

const REPORTES: {
  tipo: TipoReporteVip;
  titulo: string;
  detalle: string;
  icono: typeof AlertTriangle;
}[] = [
  { tipo: "atencion", titulo: "Atención hoy", detalle: "Prioridades para revisar", icono: AlertTriangle },
  { tipo: "nutricion", titulo: "Nutrición", detalle: "Comidas y calorías", icono: Salad },
  { tipo: "entrenamiento", titulo: "Entrenamiento", detalle: "Sesiones y cumplimiento", icono: Dumbbell },
  { tipo: "progreso", titulo: "Progreso", detalle: "Peso y seguimiento", icono: TrendingUp },
];

const TONOS: Record<EstadoReporteVip, { etiqueta: string; clase: string; icono: typeof Info }> = {
  atencion: { etiqueta: "Revisar", clase: "border-error/30 bg-error/10 text-error", icono: AlertTriangle },
  bien: { etiqueta: "Buen ritmo", clase: "border-success/30 bg-success/10 text-success", icono: CheckCircle2 },
  sin_datos: { etiqueta: "Faltan datos", clase: "border-warning/30 bg-warning/10 text-warning", icono: Info },
  informativo: { etiqueta: "En seguimiento", clase: "border-vip/30 bg-vip/10 text-vip", icono: Info },
};

export function AsistenteVipPanel({ totalAlumnos }: { totalAlumnos: number }) {
  const [estado, accion, pendiente] = useActionState(consultarAsistenteVip, ESTADO_INICIAL);
  const [tipo, setTipo] = useState<TipoReporteVip>("atencion");
  const respuesta = estado.respuesta;
  const respuestaIA = estado.respuestaIA;

  return (
    <div className="space-y-4">
      <Card className="panel-vip-espejo efecto-3d overflow-hidden !p-0">
        <div className="border-b border-vip/20 bg-vip/5 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-vip text-black">
              <Bot size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-h3 text-text">Asistente VIP</h1>
                <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-micro font-semibold text-success">
                  DATOS REALES
                </span>
              </div>
              <p className="text-caption mt-1 text-text-secondary">
                Supervisa {totalAlumnos} alumnos sin consumir IA. Cada resultado explica su origen.
              </p>
            </div>
          </div>
        </div>

        <form action={accion} className="space-y-4 p-4">
          <input type="hidden" name="modo" value="reporte" />
          <input type="hidden" name="tipo" value={tipo} />
          <div className="grid grid-cols-2 gap-2">
            {REPORTES.map(({ tipo: opcion, titulo, detalle, icono: Icono }) => {
              const activo = tipo === opcion;
              return (
                <button
                  key={opcion}
                  type="button"
                  onClick={() => setTipo(opcion)}
                  className={`radius-control min-h-24 border p-3 text-left transition-colors ${
                    activo ? "border-vip bg-vip/10" : "border-border bg-surface-2 hover:border-vip/50"
                  }`}
                >
                  <Icono size={19} className={activo ? "text-vip" : "text-text-tertiary"} />
                  <p className="text-secondary mt-2 font-semibold text-text">{titulo}</p>
                  <p className="text-micro mt-0.5 text-text-tertiary">{detalle}</p>
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="busqueda-alumno" className="text-caption mb-1.5 block font-semibold text-text-secondary">
              Alumno específico <span className="font-normal text-text-tertiary">(opcional)</span>
            </label>
            <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-3 focus-within:border-vip">
              <Search size={17} className="shrink-0 text-text-tertiary" />
              <input
                id="busqueda-alumno"
                name="busqueda"
                maxLength={80}
                placeholder="Buscar por nombre…"
                className="h-12 min-w-0 flex-1 bg-transparent text-secondary text-text outline-none"
              />
            </div>
          </div>

          <Button type="submit" loading={pendiente}>
            {pendiente ? "Calculando reporte…" : "Generar reporte"}
          </Button>
        </form>
      </Card>

      <Card className="!p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-vip/10 text-vip">
            <Sparkles size={19} />
          </div>
          <div>
            <h2 className="text-card-title text-text">Pregúntale a la IA</h2>
            <p className="text-caption mt-0.5 text-text-tertiary">
              La IA elige un reporte seguro; tú decides si quieres usarla.
            </p>
          </div>
        </div>
        <form action={accion} className="space-y-3">
          <input type="hidden" name="modo" value="ia" />
          <input type="hidden" name="tipo" value="atencion" />
          <input type="hidden" name="busqueda" value="" />
          <label htmlFor="pregunta-ia" className="sr-only">Pregunta para el Asistente VIP</label>
          <textarea
            id="pregunta-ia"
            name="pregunta"
            rows={3}
            minLength={5}
            maxLength={500}
            required
            placeholder="Ej.: ¿Quién necesita atención hoy y por qué?"
            className="radius-control w-full resize-none border border-border bg-surface-2 px-4 py-3 text-secondary text-text outline-none focus:border-vip"
          />
          <Button type="submit" loading={pendiente} variant="secondary">
            <Send size={17} /> Consultar con IA
          </Button>
          <p className="text-micro text-text-tertiary">
            Los reportes de arriba no consumen IA. Esta acción sí registra su costo.
          </p>
        </form>
      </Card>

      {pendiente && (
        <Card className="puntos-vip-entrada !p-4">
          <div className="flex items-center gap-3">
            <Sparkles size={21} className="animate-pulse text-vip" />
            <div>
              <p className="text-secondary font-semibold text-text">Verificando registros</p>
              <p className="text-caption text-text-tertiary">Los cálculos se hacen en Portal VIP, no en un modelo de IA.</p>
            </div>
          </div>
        </Card>
      )}

      {estado.error && <p className="text-caption rounded-xl bg-error/10 p-3 text-error">{estado.error}</p>}

      {respuestaIA && !pendiente && (
        <Card className="border border-vip/30 !p-4 puntos-vip-entrada">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-micro font-semibold text-vip">RESPUESTA DEL ASISTENTE</p>
              <h2 className="text-card-title mt-1 text-text">{respuestaIA.titulo}</h2>
            </div>
            <span className="rounded-full bg-vip/10 px-2 py-1 text-micro font-semibold text-vip">IA + DATOS VIP</span>
          </div>
          <p className="text-secondary mt-3 text-text-secondary">{respuestaIA.resumen}</p>
          <p className="text-micro mt-3 border-t border-border pt-3 text-text-tertiary">{respuestaIA.aviso}</p>
          {/* `costoUsd` ya lo calculaba `consultarConHerramientasVip` (ver
              lib/ai/asistenteConsultas.ts) pero se descartaba: no se mostraba
              en ningún lado. Es dato que ya viaja en la respuesta, no una
              cuenta nueva — solo faltaba pintarlo. Los mensajes del coach no
              tienen límite, pero conviene que vea cuánto va dejando cada uno. */}
          {respuestaIA.usoIA && (
            <p className="text-caption mt-1 font-medium text-vip">
              Este mensaje costó US${respuestaIA.costoUsd.toFixed(4)}.
            </p>
          )}

          {respuestaIA.borradorNoticia && (
            <div className="mt-4 rounded-2xl border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2 text-vip">
                <Megaphone size={16} />
                <p className="text-micro font-bold">BORRADOR GUARDADO</p>
              </div>
              <p className="text-secondary mt-2 font-semibold text-text">{respuestaIA.borradorNoticia.titulo}</p>
              <p className="text-caption mt-1 text-text-secondary">{respuestaIA.borradorNoticia.mensaje}</p>
              <Link
                href={`/admin/noticias?ia=1&borrador=${respuestaIA.borradorNoticia.id ?? ""}&titulo=${encodeURIComponent(respuestaIA.borradorNoticia.titulo)}&mensaje=${encodeURIComponent(respuestaIA.borradorNoticia.mensaje)}`}
                className="text-caption mt-3 inline-flex items-center gap-1 font-semibold text-vip"
              >
                Revisar antes de publicar <ArrowRight size={13} />
              </Link>
            </div>
          )}

          {respuestaIA.solicitudEliminacion && (
            <div className="mt-4 rounded-2xl border border-error/40 bg-error/5 p-3">
              <div className="flex items-center gap-2 text-error">
                <AlertTriangle size={16} />
                <p className="text-micro font-bold">SOLICITUD DE BORRADO — SIN CONFIRMAR</p>
              </div>
              <p className="text-secondary mt-2 font-semibold text-text">
                {respuestaIA.solicitudEliminacion.alumnoNombre} ·{" "}
                {ETIQUETA_CATEGORIA_ELIMINACION[respuestaIA.solicitudEliminacion.categoria]}
              </p>
              <ul className="text-caption mt-2 space-y-0.5 text-text-secondary">
                {respuestaIA.solicitudEliminacion.resumen.map((fila) => (
                  <li key={fila.tabla}>
                    {fila.cantidad} {fila.etiqueta}
                  </li>
                ))}
              </ul>
              <p className="text-micro mt-2 text-text-tertiary">
                Todavía no se borró nada. La IA solo propone — hace falta confirmar aquí abajo.
              </p>
              <div className="mt-3">
                <EliminarPerfilBoton
                  accion={confirmarEliminacionDatos}
                  campoId="solicitud_id"
                  valorId={respuestaIA.solicitudEliminacion.id}
                  etiqueta="Confirmar borrado"
                  advertencia={`Vas a borrar para siempre ${respuestaIA.solicitudEliminacion.resumen
                    .map((fila) => `${fila.cantidad} ${fila.etiqueta}`)
                    .join(", ")} de ${respuestaIA.solicitudEliminacion.alumnoNombre}. No se puede deshacer.`}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {respuesta && !pendiente && (
        <div className="space-y-3 puntos-vip-entrada">
          <Card className="!p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-card-title text-text">{respuesta.titulo}</h2>
                <p className="text-caption mt-1 text-text-secondary">{respuesta.descripcion}</p>
              </div>
              <span className="shrink-0 rounded-full border border-success/30 bg-success/10 px-2 py-1 text-micro font-semibold text-success">
                SIN IA
              </span>
            </div>
            <div className="mt-3 border-t border-border pt-3 text-caption text-text-tertiary">
              <p>{respuesta.periodo}</p>
              <p className="mt-1">
                {respuesta.totalCoincidencias} resultado{respuesta.totalCoincidencias === 1 ? "" : "s"} de {respuesta.totalEvaluados} alumno{respuesta.totalEvaluados === 1 ? "" : "s"} evaluado{respuesta.totalEvaluados === 1 ? "" : "s"}.
              </p>
            </div>
          </Card>

          {respuesta.alumnos.length === 0 ? (
            <Card className="!p-5 text-center">
              <CheckCircle2 size={25} className="mx-auto text-success" />
              <p className="text-secondary mt-2 font-semibold text-text">
                {respuesta.tipo === "atencion" ? "No hay alertas con estos filtros" : "No encontramos registros"}
              </p>
              <p className="text-caption mt-1 text-text-tertiary">Prueba sin nombre o revisa que el alumno tenga información cargada.</p>
            </Card>
          ) : (
            respuesta.alumnos.map((alumno) => {
              const tono = TONOS[alumno.estado];
              const IconoEstado = tono.icono;
              return (
                <Card key={alumno.alumnoId} className="!p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-secondary truncate font-semibold text-text">{alumno.nombre}</p>
                      {alumno.objetivo && <p className="text-micro mt-0.5 truncate text-text-tertiary">{alumno.objetivo}</p>}
                    </div>
                    <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-micro font-semibold ${tono.clase}`}>
                      <IconoEstado size={12} /> {tono.etiqueta}
                    </span>
                  </div>

                  <p className="text-caption mt-3 text-text-secondary">{alumno.motivo}</p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {alumno.metricas.map((metrica) => (
                      <div key={metrica.etiqueta} className="rounded-xl bg-surface-2 p-2">
                        <p className="text-micro text-text-tertiary">{metrica.etiqueta}</p>
                        <p className="text-caption mt-0.5 font-semibold text-text">{metrica.valor}</p>
                      </div>
                    ))}
                  </div>

                  <Link href={`/admin/alumnos/${alumno.alumnoId}`} className="text-caption mt-3 inline-flex items-center gap-1 font-semibold text-vip">
                    Abrir ficha completa <ArrowRight size={13} />
                  </Link>
                </Card>
              );
            })
          )}

          {respuesta.limitado && (
            <p className="text-caption rounded-xl bg-surface-2 p-3 text-text-tertiary">
              Se muestran los primeros 20 resultados para mantener el reporte rápido y seguro. Usa el buscador para reducir la lista.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
