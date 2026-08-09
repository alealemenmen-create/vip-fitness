import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { SeguimientoDiario } from "@/components/student/SeguimientoDiario";
import { ResumenSemanaCompacto } from "@/components/student/ResumenSemanaCompacto";
import { GraficaProgresoECG } from "@/components/student/GraficaProgresoECG";
import { AlimentacionHoyCuadro } from "@/components/student/AlimentacionHoyCuadro";
import { ResumenMetricasInicio } from "@/components/student/ResumenMetricasInicio";
import { RankedVipCard } from "@/components/student/RankedVipCard";
import { BadgeRango } from "@/components/student/BadgeRango";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";
import { TorneoActivoCard } from "@/components/student/TorneoActivoCard";
import { obtenerRankingSemanal, type FilaRanking } from "@/lib/ranking/data";
import { obtenerTorneosPublicos } from "@/lib/torneos/data";
import type { TorneoPublico } from "@/lib/torneos/types";
import { obtenerPlanAlimentacion } from "@/app/alumno/comer/data";
import { formatFechaCompacta, nombreDiaSemana } from "@/lib/date";
import { obtenerBalanceSesionesMes } from "@/app/alumno/entrenar/data";
import {
  obtenerPerfilYObjetivo,
  obtenerEstadoEntrenamientoHoy,
  obtenerResumenEntrenamientoDias,
  obtenerResumenAlimentacionHoy,
  obtenerSeguimientoHoy,
  obtenerHistorialProgreso,
  obtenerConstanciaSemana,
  type ResumenEntrenamientoDias,
  type PuntoProgreso,
  type ConstanciaSemana,
} from "./data";
import { nombreAlumnoPublicado } from "@/lib/nombre";

export default async function InicioPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  // Lo lento se arranca PERO NO se espera: el ranking recorre los datos de
  // todos los alumnos y los torneos traen participantes y nombres. Antes iban
  // dentro del mismo Promise.all que todo lo demás, así que la pantalla
  // quedaba en blanco hasta que terminaba la más lenta de las doce consultas.
  // Ahora las promesas viajan a componentes con su propio <Suspense>: el
  // entrenamiento de hoy se pinta de inmediato y esto entra después.
  const rankingPromesa = obtenerRankingSemanal();
  const torneosPromesa = obtenerTorneosPublicos(alumnoId);
  const historialPromesa = obtenerHistorialProgreso(supabase, alumnoId);

  const [
    perfil,
    entrenamiento,
    resumenDias,
    alimentacion,
    seguimientoHoy,
    balanceSesiones,
    constanciaSemana,
    plan,
  ] = await Promise.all([
    obtenerPerfilYObjetivo(supabase, alumnoId),
    obtenerEstadoEntrenamientoHoy(supabase, alumnoId),
    obtenerResumenEntrenamientoDias(supabase, alumnoId),
    obtenerResumenAlimentacionHoy(supabase, alumnoId),
    obtenerSeguimientoHoy(supabase, alumnoId),
    obtenerBalanceSesionesMes(supabase, alumnoId),
    obtenerConstanciaSemana(supabase, alumnoId),
    obtenerPlanAlimentacion(supabase, alumnoId),
  ]);

  const nombreVisible = nombreAlumnoPublicado(perfil.nombre);

  // Rendimiento general: promedio de lo que ya se mide de entrenamiento
  // (constancia general de la rutina) y alimentación (comidas de hoy
  // registradas) — los dos datos que esta misma página ya carga, sin
  // consultas nuevas. Si falta alguno, se promedia solo con el que haya.
  const pctRendimientoGeneral = resumenDias?.pctGeneral ?? 0;

  return (
    <div className="space-y-3 pb-6">
      <section className="identidad-vip-premium relative overflow-hidden rounded-[22px] px-3 py-2.5">
        <div className="relative flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-vip">
              <Crown size={10} fill="currentColor" /> Membresía VIP
            </p>
            <h1 className="mt-0.5 truncate text-[17px] font-bold leading-tight text-text">{nombreVisible}</h1>
            <p className="mt-0.5 truncate text-[9px] text-text-secondary">
              {perfil.objetivo || "Objetivo pendiente"} · {formatFechaCompacta()}
            </p>
          </div>
          <Suspense fallback={<div className="h-12 w-28 animate-pulse rounded-2xl bg-surface-2" />}>
            <MiRango rankingPromesa={rankingPromesa} alumnoId={alumnoId} />
          </Suspense>
        </div>
      </section>

      <TarjetaEntrenamientoHoy
        estado={entrenamiento}
        resumenDias={resumenDias}
        historialPromesa={historialPromesa}
        constancia={constanciaSemana}
      />

      <ResumenMetricasInicio
        comidasRegistradas={alimentacion.comidasRegistradas}
        comidasDisponibles={alimentacion.comidasDisponibles}
        balanceSesiones={balanceSesiones}
      />

      <Suspense fallback={<RankingCargando />}>
        <RankingVip rankingPromesa={rankingPromesa} alumnoId={alumnoId} />
      </Suspense>

      <AlimentacionHoyCuadro
        kcal={alimentacion.kcal}
        prot={alimentacion.prot}
        carb={alimentacion.carb}
        grasa={alimentacion.grasa}
        plan={plan}
      />

      {/* Sin esqueleto: lo normal es que no haya ningún torneo abierto, y
          reservar espacio para algo que casi nunca aparece descuadra la
          pantalla más de lo que ayuda. */}
      <Suspense fallback={null}>
        <TorneosAbiertos torneosPromesa={torneosPromesa} nombrePropio={perfil.nombre} />
      </Suspense>

      {!soloLectura && <SeguimientoDiario seguimientoHoy={seguimientoHoy} />}

      {/* Cierre de la pantalla: el acumulado histórico, que no compite con el
          rendimiento de la semana allá arriba. */}
      <Card padding="p-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-caption text-text-tertiary">RENDIMIENTO GENERAL</p>
          <p className="text-secondary font-bold text-text">{pctRendimientoGeneral}%</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-text-secondary"
            style={{ width: `${pctRendimientoGeneral}%` }}
          />
        </div>
      </Card>
    </div>
  );
}

/** Rango acumulado compacto para la cabecera. La clasificación semanal vive
 * más abajo, en la Arena VIP deslizable. */
async function MiRango({
  rankingPromesa,
  alumnoId,
}: {
  rankingPromesa: Promise<FilaRanking[]>;
  alumnoId: string;
}) {
  const ranking = await rankingPromesa;
  const propia = ranking.find((fila) => fila.alumnoId === alumnoId);
  if (!propia) return <div className="h-12 w-28" />;
  const progreso = progresoAlSiguiente(propia.puntosAcumulados);

  return (
    <Link
      href="/alumno/ranked"
      className="rango-cabecera-premium block w-28 rounded-2xl border border-vip/25 px-2.5 py-2"
    >
      <span className="flex items-center gap-2">
        <BadgeRango rango={propia.rango} size={30} brillo={false} eager />
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[10px] font-medium text-text-secondary">{propia.rango.nombre}</span>
          <span className="mt-1 block text-[14px] font-bold tabular-nums text-vip">
            {propia.puntosAcumulados.toLocaleString("es-CL")}
            <span className="ml-1 text-[7px] font-normal text-text-tertiary">pts</span>
          </span>
        </span>
      </span>
      {progreso && (
        <span className="mt-1.5 block">
          <span className="mb-1 flex items-center justify-between gap-1 text-[7px] leading-none text-text-tertiary">
            <span className="truncate">Próximo: {progreso.siguiente.nombre}</span>
            <span>{progreso.pct}%</span>
          </span>
          <span className="block h-1 overflow-hidden rounded-full bg-bg">
            <span
              className="barra-progreso-relleno block h-full rounded-full bg-vip transition-[width] duration-500"
              style={{ width: `${progreso.pct}%` }}
            >
              {[0, 1, 2, 3].map((indice) => (
                <span key={indice} className="ola-progreso" style={{ animationDelay: `${indice * 0.52}s` }} />
              ))}
            </span>
          </span>
        </span>
      )}
    </Link>
  );
}

async function RankingVip({
  rankingPromesa,
  alumnoId,
}: {
  rankingPromesa: Promise<FilaRanking[]>;
  alumnoId: string;
}) {
  return <RankedVipCard filas={await rankingPromesa} alumnoId={alumnoId} />;
}

function RankingCargando() {
  return (
    <div className="rounded-[24px] border border-border bg-surface p-3" aria-hidden>
      <div className="h-9 w-40 animate-pulse rounded-xl bg-surface-2" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-[18px] bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

async function TorneosAbiertos({
  torneosPromesa,
  nombrePropio,
}: {
  torneosPromesa: Promise<TorneoPublico[]>;
  nombrePropio: string;
}) {
  return <TorneoActivoCard torneos={await torneosPromesa} nombrePropio={nombrePropio} />;
}

/** La gráfica histórica vive dentro de un <details> cerrado por defecto, así
 * que puede llegar tarde sin que nadie lo note. */
async function GraficaHistorica({ historialPromesa }: { historialPromesa: Promise<PuntoProgreso[]> }) {
  return <GraficaProgresoECG puntos={await historialPromesa} />;
}

function TarjetaEntrenamientoHoy({
  estado,
  resumenDias,
  historialPromesa,
  constancia,
}: {
  estado: Awaited<ReturnType<typeof obtenerEstadoEntrenamientoHoy>>;
  resumenDias: ResumenEntrenamientoDias;
  historialPromesa: Promise<PuntoProgreso[]>;
  constancia: ConstanciaSemana;
}) {
  if (estado.tipo === "sin_rutina") {
    return (
      <Card>
        <p className="text-card-title text-text">Entrenamiento de hoy</p>
        <p className="text-body mt-2 text-text-secondary">
          Todavía no tienes una rutina asignada.
          <br />
          Tu entrenador debe asignarte una rutina.
        </p>
      </Card>
    );
  }

  if (!resumenDias) {
    // Rutina activa pero sin días cargados — caso borde, se mantiene el
    // mensaje simple sin anillos (no hay nada que graficar).
    return (
      <Card>
        <p className="text-card-title text-text">Entrenamiento de hoy</p>
        <p className="text-body mt-2 text-text-secondary">
          Esta rutina todavía no tiene días cargados.
        </p>
      </Card>
    );
  }

  const completado = estado.tipo === "completado";
  const diaHoy = resumenDias.dias.find((d) => d.esHoy) ?? resumenDias.dias[0];

  // `tarjeta-modelo-oscura`: se queda en oscuro también con el tema claro,
  // para que la foto del modelo se vea sobre el mismo negro con el que fue
  // tomada — ver el porqué en globals.css.
  return (
    // Padding vertical más chico que el horizontal (py-3.5 en vez de p-5):
    // achica la tarjeta ~30% de alto sin apretar los costados.
    <Card className="tarjeta-modelo-oscura tarjeta-entrenamiento-premium px-4 py-2">
      <p className="mb-1 text-[9px] tracking-[0.08em] text-text-tertiary">TU ENTRENAMIENTO</p>

      <ResumenSemanaCompacto
        diaHoy={diaHoy}
        nombreDia={nombreDiaSemana()}
        numeroDia={resumenDias.numeroActual}
        constancia={constancia}
      />

      <div className="mt-1">
        <Link
          href={
            estado.tipo === "sin_dia_elegido"
              ? "/alumno/entrenar"
              : `/alumno/entrenar/sesion/${estado.sesionId}`
          }
          className="btn-accion radius-control flex h-11 items-center justify-center gap-2 text-[12px] font-semibold"
        >
          {estado.tipo === "sin_dia_elegido"
            ? "Comenzar"
            : completado
              ? "Ver entrenamiento"
              : "Continuar"}
          <ChevronRight size={18} />
        </Link>
      </div>

      <details className="mt-1.5 border-t border-border pt-1">
        <summary className="cursor-pointer text-[9px] text-text-tertiary">
          Ver constancia histórica · General {resumenDias.pctGeneral}%
        </summary>
        <div className="mt-3">
          <Suspense fallback={<div className="h-32 animate-pulse rounded-md bg-surface-2" />}>
            <GraficaHistorica historialPromesa={historialPromesa} />
          </Suspense>
        </div>
      </details>
    </Card>
  );
}
