import { Suspense } from "react";
import { requireAlumno } from "@/lib/auth";
import { obtenerMovimientosAlumno, obtenerRanking } from "@/lib/ranking/data";
import { ProgresoVipCompetitivo } from "@/components/student/ProgresoVipCompetitivo";
import { TarjetaRangoActual } from "@/components/student/TarjetaRangoActual";
import { obtenerHistorialTorneos, obtenerTorneosPublicos } from "@/lib/torneos/data";
import { TorneoActivoCard } from "@/components/student/TorneoActivoCard";
import { HistorialTorneos } from "@/components/student/HistorialTorneos";
import { Card } from "@/components/ui/Card";
import { Swords } from "lucide-react";
import { GuiaPuntos } from "@/components/student/GuiaPuntos";

export default async function RankedPage() {
  const { alumnoId, nombre } = await requireAlumno();
  return (
    <div className="space-y-5 pb-8">
      <p className="text-caption text-text-secondary">Suma, sube de rango y compite con tu constancia.</p>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface-2" />}>
        <RangoActual alumnoId={alumnoId} />
      </Suspense>
      <GuiaPuntos />
      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-surface-2" />}>
        <ArenaVip alumnoId={alumnoId} nombre={nombre} />
      </Suspense>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Contenido alumnoId={alumnoId} />
      </Suspense>
    </div>
  );
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
  const [activas, historial] = await Promise.all([
    obtenerTorneosPublicos(alumnoId),
    obtenerHistorialTorneos(),
  ]);
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Swords size={18} className="text-vip" />
        <div>
          <h2 className="text-body font-bold text-text">Arena VIP</h2>
          <p className="text-micro text-text-tertiary">Reglas públicas · premios de VIP Fitness · sin apostar tu saldo</p>
        </div>
      </div>
      {activas.length > 0 ? (
        <TorneoActivoCard torneos={activas} nombrePropio={nombre} />
      ) : (
        <Card className="!p-4">
          <p className="text-caption text-text-secondary">No hay competencias activas. El próximo Duelo, Reto del Coach o Copa aparecerá aquí.</p>
        </Card>
      )}
      {historial.length > 0 && (
        <details className="radius-card bg-surface px-4 py-3">
          <summary className="cursor-pointer text-caption font-semibold text-text-secondary">Ver trofeos y resultados anteriores</summary>
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
