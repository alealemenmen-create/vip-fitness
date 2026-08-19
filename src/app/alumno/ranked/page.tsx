import { Suspense } from "react";
import { requireAlumno } from "@/lib/auth";
import { obtenerMovimientosAlumno, obtenerRanking } from "@/lib/ranking/data";
import { ProgresoVipCompetitivo } from "@/components/student/ProgresoVipCompetitivo";
import { TarjetaRangoActual } from "@/components/student/TarjetaRangoActual";
import { obtenerHistorialTorneos, obtenerTorneosPublicos } from "@/lib/torneos/data";
import { obtenerSaldoVip } from "@/lib/torneos/apuestas-data";
import { TorneoActivoCard } from "@/components/student/TorneoActivoCard";
import { HistorialTorneos } from "@/components/student/HistorialTorneos";
import { Card } from "@/components/ui/Card";
import { Crown, Gem, Swords } from "lucide-react";
import { GuiaPuntos } from "@/components/student/GuiaPuntos";
import { CatalogoRecompensasVip } from "@/components/student/CatalogoRecompensasVip";
import { obtenerRecompensasAlumnoVip } from "@/lib/recompensas/data";

export default async function RankedPage() {
  const { alumnoId, nombre } = await requireAlumno();
  return (
    <div className="ranked-casino space-y-5 pb-8">
      <header className="ranked-casino-hero">
        <div className="ranked-casino-hero__halo" aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="ranked-casino-kicker"><Gem size={13} /> Temporada VIP</p>
            <h1 className="ranked-casino-title">RANKED</h1>
            <p className="ranked-casino-subtitle">Cada punto mueve el podio. Haz que tu nombre sea el que todos quieran alcanzar.</p>
          </div>
          <span className="ranked-casino-live"><span aria-hidden /> En juego</span>
        </div>
      </header>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface-2" />}>
        <RangoActual alumnoId={alumnoId} />
      </Suspense>
      <GuiaPuntos />
      <Suspense fallback={<div className="h-36 animate-pulse rounded-xl bg-surface-2" />}>
        <Recompensas alumnoId={alumnoId} />
      </Suspense>
      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-surface-2" />}>
        <ArenaVip alumnoId={alumnoId} nombre={nombre} />
      </Suspense>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Contenido alumnoId={alumnoId} />
      </Suspense>
    </div>
  );
}

async function Recompensas({ alumnoId }: { alumnoId: string }) {
  const datos = await obtenerRecompensasAlumnoVip(alumnoId);
  if (!datos.disponible) return null;
  return <CatalogoRecompensasVip saldo={datos.saldo} catalogo={datos.catalogo} canjes={datos.canjes} />;
}

async function RangoActual({ alumnoId }: { alumnoId: string }) {
  // "Tu rango actual" no depende del periodo (semana/mes/año) elegido más
  // abajo — cualquiera de los tres rankings trae `puntosAcumulados`/`rango`
  // ya resueltos. `obtenerRanking` está cacheado (`unstable_cache`, tag
  // "ranking"), así que pedirlo acá y de nuevo en `Contenido` no duplica
  // trabajo real.
  const semana = await obtenerRanking("semana");
  return <TarjetaRangoActual filas={semana} alumnoId={alumnoId} />;
}

async function ArenaVip({ alumnoId, nombre }: { alumnoId: string; nombre: string }) {
  const [activas, historial, saldo] = await Promise.all([
    obtenerTorneosPublicos(alumnoId),
    obtenerHistorialTorneos(),
    obtenerSaldoVip(alumnoId),
  ]);
  return (
    <section className="space-y-2">
      <div className="ranked-section-heading">
        <span className="ranked-section-icon"><Swords size={18} /></span>
        <div>
          <p className="ranked-casino-kicker"><Crown size={12} /> Premios y apuestas</p>
          <h2 className="text-body font-bold text-text">Arena VIP</h2>
          {/* Decía "sin apostar tu saldo". Dejó de ser cierto: competir sigue
              siendo gratis, pero el público ahora apuesta lo suyo. */}
          <p className="text-micro text-text-tertiary">Reglas públicas · competir es gratis · el público apuesta</p>
        </div>
      </div>
      {activas.length > 0 ? (
        <TorneoActivoCard torneos={activas} nombrePropio={nombre} miAlumnoId={alumnoId} miSaldo={saldo} />
      ) : (
        <Card className="ranked-casino-card ranked-arena-vacia" padding="p-4">
          <Swords size={24} className="text-vip" />
          <div>
            <p className="text-secondary font-semibold text-text">La mesa está entre rondas</p>
            <p className="text-caption text-text-secondary">El próximo Duelo, Reto del Coach o Copa aparecerá aquí.</p>
          </div>
        </Card>
      )}
      {historial.length > 0 && (
        <details className="ranked-casino-card radius-card px-4 py-3">
          <summary className="cursor-pointer text-caption font-semibold text-text-secondary">Sala de trofeos y resultados anteriores</summary>
          <div className="mt-3"><HistorialTorneos historial={historial} /></div>
        </details>
      )}
    </section>
  );
}

async function Contenido({ alumnoId }: { alumnoId: string }) {
  const [semana, mes, anio, movimientos] = await Promise.all([
    obtenerRanking("semana"),
    obtenerRanking("mes"),
    obtenerRanking("anio"),
    obtenerMovimientosAlumno(alumnoId),
  ]);

  return (
    <ProgresoVipCompetitivo
      rankings={{ semana, mes, anio }}
      alumnoId={alumnoId}
      movimientos={movimientos}
    />
  );
}
