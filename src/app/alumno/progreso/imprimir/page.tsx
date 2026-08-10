import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import type { PeriodoSeguimiento } from "@/lib/seguimiento/tipos";
import { InformeSeguimiento } from "@/components/seguimiento/InformeSeguimiento";

export default async function ImprimirMiAvancePage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { alumnoId } = await requireAlumno();
  const numero = Number((await searchParams).periodo);
  const periodo: PeriodoSeguimiento = numero === 14 || numero === 30 ? numero : 7;
  const datos = await obtenerSeguimientoIntegral(await createClient(), alumnoId, periodo);
  if (!datos) return <p>No se encontrÃ³ tu seguimiento.</p>;

  return (
    <div className="informe-vip-modal informe-vip-fondo min-h-screen bg-[#d9d9d9] py-8">
      <InformeSeguimiento datos={datos} volverHref={`/alumno/progreso?periodo=${periodo}`} />
    </div>
  );
}
