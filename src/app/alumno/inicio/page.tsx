import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { SeguimientoDiario } from "@/components/student/SeguimientoDiario";
import { MensajeMotivacional } from "@/components/student/MensajeMotivacional";
import { ResumenSemanaCompacto } from "@/components/student/ResumenSemanaCompacto";
import { GraficaProgresoECG } from "@/components/student/GraficaProgresoECG";
import { BalanceSesionesMes } from "@/components/student/BalanceSesionesMes";
import { AlimentacionHoyCuadro } from "@/components/student/AlimentacionHoyCuadro";
import { RankedVipCard } from "@/components/student/RankedVipCard";
import { BadgeRango } from "@/components/student/BadgeRango";
import { progresoAlSiguiente } from "@/lib/ranking/puntos";
import { TorneoActivoCard } from "@/components/student/TorneoActivoCard";
import { obtenerRankingSemanal, type FilaRanking } from "@/lib/ranking/data";
import { obtenerTorneosPublicos } from "@/lib/torneos/data";
import type { TorneoPublico } from "@/lib/torneos/types";
import { obtenerPlanAlimentacion } from "@/app/alumno/comer/data";
import { fraseDelDia } from "@/lib/frasesMotivacionales";
import { formatFechaCompacta, nombreDiaSemana } from "@/lib/date";
import { obtenerBalanceSesionesMes } from "@/app/alumno/entrenar/data";
import {
  obtenerPerfilYObjetivo,
  obtenerNotaActivaYMarcarLeida,
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
    nota,
    entrenamiento,
    resumenDias,
    alimentacion,
    seguimientoHoy,
    balanceSesiones,
    constanciaSemana,
    plan,
  ] = await Promise.all([
    obtenerPerfilYObjetivo(supabase, alumnoId),
    obtenerNotaActivaYMarcarLeida(supabase, alumnoId, !soloLectura),
    obtenerEstadoEntrenamientoHoy(supabase, alumnoId),
    obtenerResumenEntrenamientoDias(supabase, alumnoId),
    obtenerResumenAlimentacionHoy(supabase, alumnoId),
    obtenerSeguimientoHoy(supabase, alumnoId),
    obtenerBalanceSesionesMes(supabase, alumnoId),
    obtenerConstanciaSemana(supabase, alumnoId),
    obtenerPlanAlimentacion(supabase, alumnoId),
  ]);

  const primerNombre = nombreAlumnoPublicado(perfil.nombre).split(" ")[0] ?? "";
  const frase = fraseDelDia("inicio", primerNombre);
  const nombreVisible = nombreAlumnoPublicado(perfil.nombre);

  // Rendimiento general: promedio de lo que ya se mide de entrenamiento
  // (constancia general de la rutina) y alimentación (comidas de hoy
  // registradas) — los dos datos que esta misma página ya carga, sin
  // consultas nuevas. Si falta alguno, se promedia solo con el que haya.
  const pctRendimientoSemanal = constanciaSemana.pct;
  const pctRendimientoGeneral = resumenDias?.pctGeneral ?? 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Perfil y RANKING VIP en una sola tarjeta, partida por la mitad con una
          línea divisoria. Justo encima de Entrenamiento. */}
      <Card className="efecto-3d !p-0">
        <div className="grid grid-cols-2">
          <div className="flex min-w-0 flex-col p-2.5">
            {/* Orden pedido: nombre, medalla + puntos (grandes), fecha,
                objetivo, rendimiento semanal. Todo en flujo secuencial, sin
                separar arriba/abajo — eso dejaba un hueco vacío en el medio.
                El nombre ya no calcula su tamaño por cantidad de caracteres
                (quedaba chico para nombres largos) — tamaño fijo grande, y si
                no entra en una línea, CSS lo pasa a dos (line-clamp-2) en vez
                de cortarlo con "…". */}
            <h1 className="line-clamp-2 break-words text-[20px] font-bold leading-tight text-text">
              {nombreVisible}
            </h1>

            <Suspense fallback={<div className="mt-4 h-7" />}>
              <MiRango rankingPromesa={rankingPromesa} alumnoId={alumnoId} />
            </Suspense>

            <p className="mt-4 whitespace-nowrap text-[11px] leading-none text-text-secondary">
              {formatFechaCompacta()}
            </p>

            <Pill tone="vip" className="mt-3 max-w-full truncate !px-3 !text-[12px]">
              {perfil.objetivo || "Objetivo pendiente"}
            </Pill>

            <div className="mt-3 space-y-2">
              <div className="flex items-baseline justify-between gap-1">
                <span className="min-w-0 truncate whitespace-nowrap text-[11px] text-text-tertiary">
                  Rendimiento semanal
                </span>
                <span className="text-[11px] font-bold text-vip">{pctRendimientoSemanal}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pctRendimientoSemanal}%`, background: "var(--color-vip)" }}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 border-l border-border p-2.5">
            <Suspense fallback={<RankingCargando />}>
              <RankingVip rankingPromesa={rankingPromesa} alumnoId={alumnoId} />
            </Suspense>
          </div>
        </div>
      </Card>

      <TarjetaEntrenamientoHoy
        estado={entrenamiento}
        resumenDias={resumenDias}
        historialPromesa={historialPromesa}
        constancia={constanciaSemana}
      />

      <MensajeMotivacional frase={frase} />

      <div className="grid grid-cols-2 gap-4">
        <Card className="!py-8">
          <p className="text-caption text-text-tertiary">COMIDAS DE HOY</p>
          <p className="text-h3 mt-1 text-text">
            {alimentacion.comidasRegistradas} de {alimentacion.comidasDisponibles}
          </p>
          <p className="text-secondary text-text-secondary">registradas</p>
        </Card>
        <BalanceSesionesMes balance={balanceSesiones} />
      </div>

      <div className={nota ? "radius-card mensaje-dia mensaje-dia-movimiento p-4" : "radius-card bg-surface p-4"}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-secondary font-semibold text-text">
            {nota?.generadoConIA ? "Mensaje motivacional" : "Nota de tu entrenador"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {nota?.generadoConIA && <Pill tone="vip">IA</Pill>}
            {nota?.esNueva && <Pill tone="error">Nuevo</Pill>}
          </div>
        </div>
        {nota ? (
          <>
            <p className="text-secondary text-text-secondary">&quot;{nota.texto}&quot;</p>
            <p className="text-caption mt-1.5 text-text-tertiary">{nota.fecha_inicio}</p>
          </>
        ) : (
          <p className="text-secondary text-text-secondary">
            Tu entrenador todavía no ha dejado una nota para hoy.
          </p>
        )}
      </div>

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
      <Card className="!p-4">
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

/** El emblema y los puntos del alumno, en la mitad izquierda de la tarjeta de
 * arriba. Espera al ranking dentro de su propio <Suspense> para no frenar el
 * nombre ni el objetivo, que ya están listos. */
async function MiRango({
  rankingPromesa,
  alumnoId,
}: {
  rankingPromesa: Promise<FilaRanking[]>;
  alumnoId: string;
}) {
  const ranking = await rankingPromesa;
  const propia = ranking.find((fila) => fila.alumnoId === alumnoId);
  if (!propia) return <div className="mt-4 h-7" />;
  const progreso = progresoAlSiguiente(propia.puntosAcumulados);

  return (
    <Link href="/alumno/ranked" className="mt-4 block min-w-0">
      <span className="flex min-w-0 items-center gap-2">
        <BadgeRango rango={propia.rango} size={28} brillo={false} eager />
        <span className="min-w-0 truncate text-[13px] font-medium leading-none text-text-secondary">
          {propia.rango.nombre}
        </span>
        <span className="ml-auto shrink-0 text-[16px] font-bold leading-none tabular-nums text-vip">
          {propia.puntosAcumulados.toLocaleString("es-CL")}
          <span className="ml-0.5 text-[10px] font-normal text-text-tertiary">pts</span>
        </span>
      </span>
      {progreso && (
        <span className="mt-2 block">
          <span className="mb-1 flex items-center justify-between gap-1 text-[8px] leading-none text-text-tertiary">
            <span>Próximo: {progreso.siguiente.nombre}</span>
            <span>{progreso.pct}%</span>
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
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

/** Esqueleto del ranking: mismo alto que la lista real (4 filas de 44px con
 * 4px de separación, más el encabezado) para que al llegar los datos no se
 * mueva nada de lo que hay alrededor. */
function RankingCargando() {
  return (
    <div className="flex h-full flex-col" aria-hidden>
      <div className="mb-2 h-[22px]" />
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-surface-2" />
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
    <Card className="tarjeta-modelo-oscura p-5">
      <p className="text-caption mb-3 text-text-tertiary">TU ENTRENAMIENTO</p>

      <ResumenSemanaCompacto
        diaHoy={diaHoy}
        nombreDia={nombreDiaSemana()}
        numeroDia={resumenDias.numeroActual}
        constancia={constancia}
      />

      <div className="mt-4">
        <Link
          href={
            estado.tipo === "sin_dia_elegido"
              ? "/alumno/entrenar"
              : `/alumno/entrenar/sesion/${estado.sesionId}`
          }
          className="btn-accion radius-control flex h-14 items-center justify-center gap-2 text-body font-semibold"
        >
          {estado.tipo === "sin_dia_elegido"
            ? "Comenzar"
            : completado
              ? "Ver entrenamiento"
              : "Continuar"}
          <ChevronRight size={18} />
        </Link>
      </div>

      <details className="mt-4 border-t border-border pt-3">
        <summary className="text-caption cursor-pointer text-text-tertiary">
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
