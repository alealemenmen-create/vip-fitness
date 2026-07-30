import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAlumno } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { StatGrid, StatTile } from "@/components/ui/StatGrid";
import { ComidaCard } from "@/components/student/ComidaCard";
import { obtenerRegistroDia } from "../data";
import { formatFechaLarga } from "@/lib/date";

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export default async function ComerDiaPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();

  // El catálogo ya no se manda al cliente: son miles de alimentos y la
  // búsqueda se hace en el servidor mientras el alumno escribe.
  const { comidas, totalesDia } = await obtenerRegistroDia(supabase, alumnoId, fecha);

  const fechaLegible = formatFechaLarga(new Date(`${fecha}T12:00:00`));

  return (
    <div className="space-y-4 pb-8">
      <Link href="/alumno/comer" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <h1 className="text-h3 text-text">{fechaLegible}</h1>
      </Link>

      <Card className="efecto-3d panel-vip-espejo panel-vip-espejo-borde">
        <p className="text-caption mb-3 text-text-tertiary">TOTAL DEL DÍA</p>
        <StatGrid>
          <StatTile value={round(totalesDia.kcal)} label="KCAL" accent />
          <StatTile value={`${round(totalesDia.prot)}g`} label="PROT" />
          <StatTile value={`${round(totalesDia.carb)}g`} label="CARB" />
          <StatTile value={`${round(totalesDia.grasa)}g`} label="GRASA" />
        </StatGrid>
      </Card>

      {comidas.map((comida) => (
        <ComidaCard
          key={comida.tipoComida}
          fecha={fecha}
          comida={comida}
          soloLectura={soloLectura}
        />
      ))}
    </div>
  );
}
