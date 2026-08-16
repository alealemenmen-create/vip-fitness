import Link from "next/link";
import { Activity, AlertTriangle, Apple, ArrowRight, CheckCircle2, Dumbbell, Droplets, HeartPulse, Moon, Scale, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { AlertaSeguimiento, NivelCumplimiento, SeguimientoIntegral } from "@/lib/seguimiento/tipos";
import { RevisionSeguimientoForm } from "./RevisionSeguimientoForm";

const NIVEL: Record<NivelCumplimiento, { texto: string; tono: "success" | "vip" | "neutral" | "error" }> = {
  excelente: { texto: "Excelente", tono: "success" },
  muy_bien: { texto: "Muy bien", tono: "success" },
  en_proceso: { texto: "En proceso", tono: "vip" },
  atencion: { texto: "Necesita atención", tono: "error" },
  sin_datos: { texto: "Sin datos suficientes", tono: "neutral" },
};

function fechaCorta(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Santiago" })
    .format(new Date(`${fecha}T12:00:00`))
    .replace(".", "");
}

function valorPct(valor: number | null) { return valor === null ? "—" : `${valor}%`; }

function Metrica({ icono, etiqueta, valor, detalle }: { icono: React.ReactNode; etiqueta: string; valor: string; detalle: string }) {
  return (
    <Card padding="p-3" className="min-w-0 border border-border/70">
      <div className="mb-2 flex items-center gap-2 text-text-tertiary">{icono}<span className="text-[9px] font-semibold uppercase tracking-wide">{etiqueta}</span></div>
      <p className="text-xl font-bold text-text">{valor}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-text-tertiary">{detalle}</p>
    </Card>
  );
}

function Alerta({ alerta }: { alerta: AlertaSeguimiento }) {
  const positiva = alerta.prioridad === "positiva";
  return (
    <div className={`radius-control flex gap-2.5 border p-3 ${positiva ? "border-success/35 bg-success/5" : alerta.prioridad === "alta" ? "border-error/45 bg-error/5" : "border-vip/35 bg-vip/5"}`}>
      {positiva ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" /> : <AlertTriangle size={17} className={`mt-0.5 shrink-0 ${alerta.prioridad === "alta" ? "text-error" : "text-vip"}`} />}
      <div><p className="text-caption font-semibold text-text">{alerta.titulo}</p><p className="text-caption text-text-secondary">{alerta.detalle}</p></div>
    </div>
  );
}

export function PanelSeguimiento({
  datos,
  modo,
  baseHref,
  mostrarRevision = false,
  imprimirHref,
}: {
  datos: SeguimientoIntegral;
  modo: "alumno" | "entrenador";
  baseHref: string;
  mostrarRevision?: boolean;
  imprimirHref?: string;
}) {
  const r = datos.resumen;
  const nivel = NIVEL[r.nivel];
  // Premium analítico solo para el alumno (instructivo §8): el entrenador ve
  // este mismo panel dentro de la ficha del alumno en el Panel del
  // Entrenador, que todavía no pasó por su propio rediseño (Fase 2 pendiente
  // del instructivo del panel) — tocar el material acá lo dejaría a mitad de
  // camino entre el sistema viejo y el nuevo. `premium` aísla el cambio a la
  // única pantalla que ya está redecorada.
  const premium = modo === "alumno";
  return (
    <div className="space-y-4">
      <div className="imprimir-oculto flex flex-wrap items-center justify-between gap-2">
        <div className={`flex gap-1 rounded-xl p-1 ${premium ? "control-periodo-avance" : "bg-surface"}`}>
          {([7, 14, 30] as const).map((periodo) => (
            <Link
              key={periodo}
              href={`${baseHref}?periodo=${periodo}`}
              className={`rounded-lg px-3 py-1.5 text-caption font-semibold ${
                datos.diasPeriodo === periodo
                  ? premium
                    ? "periodo-avance-activo"
                    : "bg-vip text-black"
                  : "text-text-secondary"
              }`}
            >
              {periodo} días
            </Link>
          ))}
        </div>
        {imprimirHref && (
          <Link
            href={`${imprimirHref}?periodo=${datos.diasPeriodo}`}
            className={`radius-control border px-3 py-2 text-caption font-semibold ${
              premium ? "border-white/[0.12] text-text-secondary" : "border-vip/40 text-vip"
            }`}
          >
            Imprimir / PDF
          </Link>
        )}
      </div>

      <section className={premium ? "hero-avance-premium radius-card p-5 text-white" : "radius-card overflow-hidden border border-vip/30 bg-[radial-gradient(circle_at_top_right,rgba(255,184,0,0.18),transparent_45%),linear-gradient(145deg,#171717,#090909)] p-5 text-white"}>
        <div className="flex items-start justify-between gap-3">
          <div><p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${premium ? "hero-avance-eyebrow" : "text-vip"}`}>{modo === "alumno" ? "Cómo lo he hecho" : "Cómo lo ha hecho"} · últimos {datos.diasPeriodo} días</p><h2 className="mt-1 text-xl font-bold">{datos.alumnoNombre}</h2></div>
          <Pill tone={nivel.tono}>{nivel.texto}</Pill>
        </div>
        <div className="mt-5 flex items-end gap-2"><span className={`text-5xl font-black ${premium ? "hero-avance-numero" : "text-vip"}`}>{r.adherenciaGeneral ?? "—"}</span><span className="pb-1 text-sm text-white/60">{r.adherenciaGeneral === null ? "sin evaluación" : "% adherencia general"}</span></div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${premium ? "hero-avance-barra" : "bg-vip"}`} style={{ width: `${r.adherenciaGeneral ?? 0}%` }} /></div>
        <p className="mt-3 text-xs text-white/65">{datos.desde} al {datos.hasta} · datos reales de entrenamiento y alimentación separados del autorreporte.</p>
      </section>

      <section className={`grid grid-cols-2 gap-2 lg:grid-cols-4 ${premium ? "indicadores-avance-premium" : ""}`}>
        <Metrica icono={<Dumbbell size={15} />} etiqueta="Entrenamiento" valor={valorPct(r.entrenamientoPct)} detalle={`${r.sesionesRealizadas}/${r.sesionesEsperadas || 0} sesiones · calidad ${valorPct(r.calidadSesionesPct)}`} />
        <Metrica icono={<Apple size={15} />} etiqueta="Nutrición" valor={valorPct(r.nutricionPct)} detalle={`${r.diasConAlimentacion}/${r.diasPeriodo} días registrados`} />
        <Metrica icono={<HeartPulse size={15} />} etiqueta="Seguimiento" valor={`${r.recuperacionPct}%`} detalle={`Sueño ${r.suenoPromedio ?? "—"} h · energía ${r.energiaPromedio ?? "—"}/5`} />
        <Metrica icono={<TrendingUp size={15} />} etiqueta="Impulso VIP" valor={`${r.progresionesCumplidas}/${r.progresionesEvaluadas}`} detalle="progresiones cumplidas o superadas" />
      </section>

      <Card padding="p-4">
        <div className="mb-3 flex items-center gap-2"><Apple size={17} className="text-vip" /><h3 className="text-card-title">Promedios nutricionales</h3></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><p className="text-[9px] text-text-tertiary">CALORÍAS</p><p className="text-body font-semibold">{r.kcalPromedio ?? "—"} / {r.kcalObjetivo ?? "—"}</p></div>
          <div><p className="text-[9px] text-text-tertiary">PROTEÍNA</p><p className="text-body font-semibold">{r.proteinaPromedio ?? "—"} / {r.proteinaObjetivo ?? "—"} g</p></div>
          <div><p className="text-[9px] text-text-tertiary">AGUA</p><p className="text-body font-semibold">{r.aguaPromedio ?? "—"} L</p></div>
          <div><p className="text-[9px] text-text-tertiary">SUEÑO</p><p className="text-body font-semibold">{r.suenoPromedio ?? "—"} h</p></div>
        </div>
      </Card>

      {datos.alertas.length > 0 && <section className="space-y-2"><h3 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">Señales del período</h3>{datos.alertas.map((alerta, i) => <Alerta key={`${alerta.titulo}:${i}`} alerta={alerta} />)}</section>}

      <Card padding="p-4">
        <div className="mb-3 flex items-center gap-2"><Scale size={17} className="text-vip" /><h3 className="text-card-title">Evolución</h3></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><p className="text-[9px] text-text-tertiary">PESO</p><p className="text-body font-semibold">{datos.evolucion.pesoActual ?? "—"} kg</p></div>
          <div><p className="text-[9px] text-text-tertiary">VARIACIÓN</p><p className="text-body font-semibold">{datos.evolucion.variacionPeso === null ? "—" : `${datos.evolucion.variacionPeso > 0 ? "+" : ""}${datos.evolucion.variacionPeso} kg`}</p></div>
          <div><p className="text-[9px] text-text-tertiary">FOTOS</p><p className="text-body font-semibold">{datos.evolucion.fotosPeriodo}</p></div>
          <div><p className="text-[9px] text-text-tertiary">MEDIDAS</p><p className="text-body font-semibold">{datos.evolucion.medidasPeriodo}</p></div>
        </div>
      </Card>

      <section className="space-y-2">
        <h3 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">Detalle diario</h3>
        {datos.dias.map((dia) => {
          const ejercicios = dia.sesiones.reduce((total, sesion) => total + sesion.ejerciciosCompletados, 0);
          const totalEjercicios = dia.sesiones.reduce((total, sesion) => total + sesion.ejerciciosTotales, 0);
          const tieneDatos = dia.sesiones.length > 0 || dia.nutricion || dia.aguaLitros !== null || dia.pesoKg !== null;
          return (
            <details
              key={dia.fecha}
              className={`radius-control group px-3 py-2.5 ${
                premium ? "border border-white/[0.07] bg-surface" : "border border-border bg-surface"
              }`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <div className="min-w-0"><p className="text-caption font-semibold capitalize text-text">{fechaCorta(dia.fecha)}</p><p className="truncate text-[10px] text-text-tertiary">{tieneDatos ? [dia.sesiones.length ? `${ejercicios}/${totalEjercicios} ejercicios` : null, dia.nutricion ? `${dia.nutricion.kcal} kcal · ${dia.nutricion.proteina} g prot` : null, dia.pesoKg ? `${dia.pesoKg} kg` : null].filter(Boolean).join(" · ") : "Sin registro"}</p></div>
                <ArrowRight size={14} className="shrink-0 text-text-tertiary transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-3 space-y-2 border-t border-border pt-3 text-caption text-text-secondary">
                {dia.sesiones.map((sesion) => <div key={sesion.id} className="rounded-xl bg-surface-2 p-2"><p className="font-semibold text-text">{sesion.nombre} · {sesion.estado.replaceAll("_", " ")}</p><p>{sesion.ejerciciosCompletados}/{sesion.ejerciciosTotales} ejercicios · {sesion.seriesRealizadas}/{sesion.seriesTotales} series{sesion.cardioCompletado ? " · cardio ✓" : ""}</p></div>)}
                {dia.nutricion && <div className="rounded-xl bg-surface-2 p-2"><p className="font-semibold text-text">Nutrición</p><p>{dia.nutricion.comidas} comidas · {dia.nutricion.omitidas} omitidas · {dia.nutricion.kcal} kcal</p><p>{dia.nutricion.proteina} g proteína · {dia.nutricion.carbohidratos} g carb · {dia.nutricion.grasa} g grasa</p></div>}
                {(dia.aguaLitros !== null || dia.suenoHoras !== null || dia.energia !== null) && <div className="flex flex-wrap gap-3 rounded-xl bg-surface-2 p-2"><span className="flex items-center gap-1"><Droplets size={13} /> {dia.aguaLitros ?? "—"} L</span><span className="flex items-center gap-1"><Moon size={13} /> {dia.suenoHoras ?? "—"} h</span><span className="flex items-center gap-1"><Activity size={13} /> {dia.energia ?? "—"}/5</span></div>}
                {dia.declaracionAlimentacion === true && !dia.nutricion && <p className="text-vip">Declaró cumplir alimentación, pero no hay alimentos registrados.</p>}
                {dia.molestias && <p className="text-error">Molestias: {dia.molestias}</p>}{dia.comentario && <p>Comentario: {dia.comentario}</p>}
              </div>
            </details>
          );
        })}
      </section>

      {datos.revisiones.length > 0 && <section className="space-y-2"><h3 className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">Revisiones del entrenador</h3>{datos.revisiones.map((revision) => <Card key={revision.id} padding="p-3"><div className="flex items-center gap-2 text-vip"><Sparkles size={15} /><p className="text-caption font-semibold">{revision.desde} al {revision.hasta}</p></div><p className="mt-2 text-caption text-text">{revision.observacion}</p>{revision.decisionSiguientePlan && <p className="mt-1 text-caption text-text-secondary">Siguiente paso: {revision.decisionSiguientePlan}</p>}<p className="mt-2 text-[9px] text-text-tertiary">{revision.entrenadorNombre}</p></Card>)}</section>}

      {mostrarRevision && <Card padding="p-4"><h3 className="mb-1 text-card-title">Observación del entrenador</h3><p className="mb-3 text-caption text-text-secondary">Quedará vinculada a este período y visible para el alumno.</p><RevisionSeguimientoForm alumnoId={datos.alumnoId} periodo={datos.diasPeriodo} /></Card>}
    </div>
  );
}
