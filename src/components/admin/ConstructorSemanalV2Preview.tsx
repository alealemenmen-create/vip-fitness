import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Dumbbell, Replace } from "lucide-react";
import type { ResultadoConstructorSemanalV2 } from "@/lib/generador-rutinas-v2/constructor-semanal";
import type { GrupoDosisV2 } from "@/lib/generador-rutinas-v2/tipos";

const NOMBRE_GRUPO: Record<GrupoDosisV2, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  brazos: "Brazos",
  cuadriceps: "Cuádriceps",
  femorales: "Femorales",
  gluteos: "Glúteos",
  pantorrillas: "Pantorrillas",
  core: "Core",
};

type Props = { resultado: ResultadoConstructorSemanalV2 };

export function ConstructorSemanalV2Preview({ resultado }: Props) {
  const estadoClase = resultado.estado === "borrador"
    ? "bg-success/10 text-success"
    : resultado.estado === "provisional_revision"
      ? "bg-warning/10 text-warning"
      : "bg-bg text-text-secondary";
  const estadoTexto = resultado.estado === "borrador"
    ? "Borrador construido"
    : resultado.estado === "provisional_revision"
      ? "Provisional · revisar adaptaciones"
      : "Esperando dosis";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-vip/10 p-2 text-vip"><CalendarDays size={20} /></span>
          <div>
            <h2 className="font-bold text-text">Constructor Semanal Inteligente</h2>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">Convierte la dosis en días, ejercicios y reemplazos auditables. Es una vista previa: todavía no publica ni reemplaza la rutina activa.</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${estadoClase}`}>{estadoTexto}</span>
      </div>

      {resultado.estado === "no_disponible" ? (
        <div className="mt-4 rounded-xl border border-border bg-bg p-4">
          <p className="text-sm font-semibold text-text">Primero hay que completar y aprobar la dosis.</p>
          <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
            {resultado.razones.map((razon) => <li key={razon} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vip" />{razon}</li>)}
          </ul>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Semana</dt><dd className="mt-1 font-bold text-text">{resultado.dias.length} días</dd></div>
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Dosis cubierta</dt><dd className="mt-1 font-bold text-text">{resultado.auditoria.seriesProgramadas}/{resultado.auditoria.seriesObjetivo} series</dd></div>
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Sesión más larga</dt><dd className="mt-1 font-bold text-text">{resultado.auditoria.minutosMaximosProgramados}/{resultado.auditoria.minutosMaximosPermitidos ?? "—"} min</dd></div>
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Catálogo elegible</dt><dd className="mt-1 font-bold text-text">{resultado.auditoria.catalogoElegible}/{resultado.auditoria.catalogoRecibido} ejercicios</dd></div>
          </dl>

          {resultado.razones.map((razon) => <p key={razon} className={`rounded-xl border p-3 text-sm ${resultado.estado === "provisional_revision" ? "border-warning/25 bg-warning/5 text-text-secondary" : "border-vip/15 bg-vip/5 text-text-secondary"}`}>{razon}</p>)}

          {resultado.alertas.length > 0 ? (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-text"><AlertTriangle size={16} className="text-warning" /> Alertas antes de aprobar</p>
              <ul className="mt-2 grid gap-2 text-sm text-text-secondary lg:grid-cols-2">
                {resultado.alertas.map((alerta) => <li key={alerta} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{alerta}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            {resultado.dias.map((dia) => (
              <article key={dia.numero} className="min-w-0 overflow-hidden rounded-2xl border border-border">
                <header className="flex flex-wrap items-center justify-between gap-3 bg-bg p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-vip">Día {dia.numero}</p>
                    <h3 className="mt-0.5 font-bold text-text">{dia.nombre}</h3>
                    <p className="mt-1 text-xs text-text-secondary">{dia.enfoque.map((grupo) => NOMBRE_GRUPO[grupo]).join(" · ")}</p>
                  </div>
                  <div className="flex gap-2 text-xs font-semibold text-text-secondary">
                    <span className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1"><Dumbbell size={13} /> {dia.seriesDirectas} series</span>
                    <span className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1"><Clock3 size={13} /> {dia.minutosEstimados} min</span>
                  </div>
                </header>
                <ol className="divide-y divide-border">
                  {dia.ejercicios.map((ejercicio) => (
                    <li key={`${dia.numero}-${ejercicio.orden}-${ejercicio.ejercicioId}`} className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vip/10 text-xs font-bold text-vip">{ejercicio.orden}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div><p className="font-semibold text-text">{ejercicio.nombre}</p><p className="mt-0.5 text-xs text-text-tertiary">{NOMBRE_GRUPO[ejercicio.grupoDosis]} · {ejercicio.patron.replaceAll("_", " ")}</p></div>
                            <p className="shrink-0 rounded-lg bg-bg px-2.5 py-1 text-sm font-bold text-text">{ejercicio.series} × {ejercicio.repeticiones}</p>
                          </div>
                          <p className="mt-2 text-xs font-medium text-text-secondary">RIR {ejercicio.rir} · descanso {ejercicio.descansoSegundos} s</p>
                          <details className="mt-2 text-xs text-text-secondary">
                            <summary className="cursor-pointer font-semibold text-vip">Por qué y cómo reemplazar</summary>
                            <p className="mt-2 leading-relaxed">{ejercicio.motivo}</p>
                            {ejercicio.sustituciones.length > 0 ? <p className="mt-1.5 flex items-start gap-1.5"><Replace size={13} className="mt-0.5 shrink-0" /> Alternativas: {ejercicio.sustituciones.map((item) => item.nombre).join(" · ")}</p> : <p className="mt-1.5 text-warning">Sin reemplazo compatible en el catálogo actual.</p>}
                          </details>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><h3 className="text-sm font-bold text-text">Auditoría semanal</h3><p className="mt-0.5 text-xs text-text-secondary">Compara dosis y frecuencia programadas antes de habilitar una publicación.</p></div>
              <p className="text-xs text-text-tertiary">Objetivo → borrador</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-bg text-xs uppercase tracking-wide text-text-tertiary"><tr><th className="px-3 py-2.5">Grupo</th><th className="px-3 py-2.5">Series</th><th className="px-3 py-2.5">Frecuencia</th><th className="px-3 py-2.5">Estado</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {resultado.auditoria.porGrupo.map((grupo) => <tr key={grupo.grupo}>
                    <th className="px-3 py-2.5 font-semibold text-text">{NOMBRE_GRUPO[grupo.grupo]}</th>
                    <td className="px-3 py-2.5 text-text-secondary">{grupo.objetivo} → {grupo.programadas}</td>
                    <td className="px-3 py-2.5 text-text-secondary">{grupo.frecuenciaObjetivo}× → {grupo.frecuenciaProgramada}×</td>
                    <td className={`px-3 py-2.5 font-semibold ${grupo.cumple ? "text-success" : "text-warning"}`}>{grupo.cumple ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} /> Cumple</span> : "Revisar"}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <details className="rounded-xl bg-bg p-4 text-sm text-text-secondary">
            <summary className="cursor-pointer font-bold text-text">Reglas aplicadas por el constructor</summary>
            <ul className="mt-3 space-y-2">{resultado.reglasAplicadas.map((regla) => <li key={regla} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{regla}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
