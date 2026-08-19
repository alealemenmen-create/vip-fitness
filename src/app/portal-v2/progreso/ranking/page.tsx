import Link from "next/link";
import { ArrowLeft, Crown, Gem, ShieldCheck, Swords, Trophy } from "lucide-react";
import { obtenerContextoAlumnoOpcional } from "@/lib/auth";
import { obtenerMovimientosAlumno, obtenerRanking, type FilaRanking, type MovimientoPuntos } from "@/lib/ranking/data";
import { rangoDePuntos } from "@/lib/ranking/puntos";
import { obtenerTorneosPublicos } from "@/lib/torneos/data";
import { obtenerRecompensasAlumnoVip, type RecompensasAlumnoVip } from "@/lib/recompensas/data";
import { ProgresoVipCompetitivo } from "@/components/student/ProgresoVipCompetitivo";
import { TarjetaRangoActual } from "@/components/student/TarjetaRangoActual";
import { GuiaPuntos } from "@/components/student/GuiaPuntos";
import { CatalogoRecompensasVip } from "@/components/student/CatalogoRecompensasVip";
import { TorneoActivoCard } from "@/components/student/TorneoActivoCard";
import { Card } from "@/components/ui/Card";
import styles from "@/components/v2/PortalV2.module.css";

const ID_DEMO = "demo-alumno-vip";

function filaDemo(alumnoId: string, nombre: string, puntos: number, puntosAcumulados: number, posicion: number): FilaRanking {
  return {
    alumnoId,
    nombre,
    posicion,
    puntos,
    puntosAcumulados,
    rango: rangoDePuntos(puntosAcumulados),
    desglose: { asistencia: Math.round(puntos * 0.55), alimentacion: Math.round(puntos * 0.25), app: Math.round(puntos * 0.2), total: puntos, totalCrudo: puntos },
  };
}

function rankingDemo(factor = 1): FilaRanking[] {
  return [
    filaDemo("demo-vale", "Vale R.", Math.round(1240 * factor), 3240, 1),
    filaDemo(ID_DEMO, "Ale Mendoza", Math.round(900 * factor), 2690, 2),
    filaDemo("demo-seba", "Seba M.", Math.round(760 * factor), 2410, 3),
    filaDemo("demo-camila", "Camila P.", Math.round(690 * factor), 2130, 4),
    filaDemo("demo-nicolas", "Nicolás G.", Math.round(625 * factor), 1980, 5),
  ];
}

const MOVIMIENTOS_DEMO: MovimientoPuntos[] = [
  { id: "demo-1", categoria: "entrenamiento", puntos: 300, titulo: "Entrenamiento completado", detalle: "Actividad cerrada y verificada por el servidor", fecha: "2026-08-19" },
  { id: "demo-2", categoria: "constancia", puntos: 30, titulo: "Constancia diaria", detalle: "Primer ingreso válido del día", fecha: "2026-08-19" },
  { id: "demo-3", categoria: "progreso", puntos: 75, titulo: "Seguimiento corporal", detalle: "Registro dentro de la ventana permitida", fecha: "2026-08-18" },
];

type RankingsV2 = { semana: FilaRanking[]; mes: FilaRanking[]; anio: FilaRanking[] };
type TorneosV2 = Awaited<ReturnType<typeof obtenerTorneosPublicos>>;

async function cargarSeguro<T>(promesa: Promise<T>, mensaje: string): Promise<{ datos: T | null; error: string | null }> {
  try {
    return { datos: await promesa, error: null };
  } catch {
    return { datos: null, error: mensaje };
  }
}

export default async function RankingV2Page() {
  const contexto = await obtenerContextoAlumnoOpcional();
  const alumnoId = contexto?.alumnoId ?? ID_DEMO;
  const nombre = contexto?.nombre ?? "Ale Mendoza";
  let rankings: RankingsV2;
  let movimientos: MovimientoPuntos[];
  let torneos: TorneosV2;
  let recompensas: RecompensasAlumnoVip;
  let erroresCarga: string[] = [];
  let rankingNoDisponible = false;

  if (contexto) {
    const [cargaRankings, cargaMovimientos, cargaTorneos, cargaRecompensas] = await Promise.all([
      cargarSeguro(
        Promise.all([obtenerRanking("semana"), obtenerRanking("mes"), obtenerRanking("anio")])
          .then(([semana, mes, anio]) => ({ semana, mes, anio })),
        "No pudimos cargar la clasificación.",
      ),
      cargarSeguro(obtenerMovimientosAlumno(alumnoId), "No pudimos cargar tus movimientos de puntos."),
      cargarSeguro(obtenerTorneosPublicos(alumnoId), "No pudimos cargar los desafíos activos."),
      cargarSeguro(obtenerRecompensasAlumnoVip(alumnoId), "No pudimos cargar tus recompensas."),
    ]);
    rankings = cargaRankings.datos ?? { semana: [], mes: [], anio: [] };
    rankingNoDisponible = Boolean(cargaRankings.error);
    movimientos = cargaMovimientos.datos ?? [];
    torneos = cargaTorneos.datos ?? [];
    recompensas = cargaRecompensas.datos ?? { disponible: false, error: cargaRecompensas.error, saldo: 0, catalogo: [], canjes: [] };
    erroresCarga = [cargaRankings.error, cargaMovimientos.error, cargaTorneos.error]
      .filter((error): error is string => Boolean(error));
  } else {
    rankings = { semana: rankingDemo(), mes: rankingDemo(2.25), anio: rankingDemo(7.5) };
    movimientos = MOVIMIENTOS_DEMO;
    torneos = [];
    recompensas = { disponible: false, error: null, saldo: 900, catalogo: [], canjes: [] };
  }
  const saldo = recompensas.saldo;

  return (
    <section className={`${styles.rankingV2Page} ranked-casino space-y-4 px-3 pb-8 pt-3 sm:px-4`}>
      <header className="flex items-center justify-between gap-3">
        <Link href="/portal-v2/progreso/comunidad" aria-label="Volver a Comunidad" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="ranked-casino-kicker"><Gem size={12} /> Temporada VIP</p>
          <h1 className="text-xl font-black tracking-[-.03em] text-white">ARENA Y RANKING</h1>
        </div>
        <span className="ranked-casino-live"><span aria-hidden /> En juego</span>
      </header>

      {!contexto ? (
        <Card className="ranked-casino-card flex items-start gap-3" padding="p-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-vip" />
          <div><strong className="block text-xs text-text">Vista directa protegida</strong><p className="mt-1 text-[10px] leading-relaxed text-text-secondary">Puedes recorrer todo el sistema sin contraseña. Los puntos, retos y premios reales aparecen al entrar con una cuenta del piloto; esta demostración no escribe ni descuenta nada.</p></div>
        </Card>
      ) : null}

      {erroresCarga.length ? (
        <div role="alert">
          <Card className="ranked-casino-card flex items-start gap-3" padding="p-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-vip" />
            <div className="min-w-0 flex-1">
              <strong className="block text-xs text-text">Parte de Arena necesita reconectarse</strong>
              <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">{erroresCarga.join(" ")} Las demás secciones siguen disponibles y tus puntos no se modificaron.</p>
              <a className="mt-2 inline-flex min-h-9 items-center rounded-full border border-white/10 px-4 text-[10px] font-bold text-white" href="/portal-v2/progreso/ranking">Intentar nuevamente</a>
            </div>
          </Card>
        </div>
      ) : null}

      <TarjetaRangoActual filas={rankings.semana} alumnoId={alumnoId} />
      <GuiaPuntos />

      {recompensas.disponible ? (
        <CatalogoRecompensasVip saldo={recompensas.saldo} catalogo={recompensas.catalogo} canjes={recompensas.canjes} soloLectura={contexto?.soloLectura ?? true} />
      ) : (
        <Card className="ranked-casino-card" padding="p-4">
          <p className="ranked-casino-kicker"><Crown size={12} /> Recompensas VIP</p>
          <h2 className="mt-1 text-sm font-bold text-text">Tu saldo: {saldo.toLocaleString("es-CL")} XP</h2>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">{recompensas.error ?? "El catálogo aparece aquí cuando el administrador publica premios con costo, vigencia y stock reales. No mostramos recompensas inventadas ni permitimos canjes de demostración."}</p>
        </Card>
      )}

      <section className="space-y-2" aria-label="Arena VIP">
        <div className="ranked-section-heading">
          <span className="ranked-section-icon"><Swords size={18} /></span>
          <div><p className="ranked-casino-kicker"><Trophy size={12} /> Desafíos verificados</p><h2 className="text-body font-bold text-text">Arena VIP</h2></div>
        </div>
        {torneos.length ? (
          <TorneoActivoCard torneos={torneos} nombrePropio={nombre} miAlumnoId={alumnoId} miSaldo={saldo} soloLectura={contexto?.soloLectura ?? true} />
        ) : (
          <Card className="ranked-casino-card flex items-center gap-3" padding="p-4"><Swords size={24} className="text-vip" /><div><strong className="text-sm text-text">La arena está entre rondas</strong><p className="mt-1 text-[10px] text-text-secondary">El siguiente duelo, circuito o reto del entrenador aparecerá aquí con reglas públicas y medición verificable.</p></div></Card>
        )}
      </section>

      <ProgresoVipCompetitivo rankings={rankings} alumnoId={alumnoId} movimientos={movimientos} rankingNoDisponible={rankingNoDisponible} />
    </section>
  );
}
