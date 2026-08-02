import { Suspense } from "react";
import { requireAlumno } from "@/lib/auth";
import { obtenerMovimientosAlumno, obtenerRanking } from "@/lib/ranking/data";
import { ProgresoVipCompetitivo } from "@/components/student/ProgresoVipCompetitivo";

export default async function RankedPage() {
  const { alumnoId } = await requireAlumno();
  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-h2 text-text">Progreso <span className="text-vip">VIP</span></h1>
        <p className="text-caption mt-1 text-text-secondary">Suma, sube de rango y compite con tu constancia.</p>
      </div>
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-surface-2" />}>
        <Contenido alumnoId={alumnoId} />
      </Suspense>
    </div>
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
