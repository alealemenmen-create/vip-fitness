import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import type { PeriodoSeguimiento } from "@/lib/seguimiento/tipos";
import { PanelSeguimiento } from "@/components/seguimiento/PanelSeguimiento";

function periodoValido(valor?: string): PeriodoSeguimiento {
  const numero = Number(valor);
  return numero === 14 || numero === 30 ? numero : 7;
}

export default async function SeguimientoAlumnoAdminPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requireRol(["entrenador", "admin"]);
  const { id } = await params;
  const periodo = periodoValido((await searchParams).periodo);
  const supabase = await createClient();
  const datos = await obtenerSeguimientoIntegral(supabase, id, periodo);
  if (!datos) return <p className="text-body text-text-secondary">No se encontró el alumno.</p>;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <Link href={`/admin/alumnos/${id}`} className="radius-control border border-border p-2 text-text-secondary"><ArrowLeft size={18} /></Link>
        <div><p className="text-[10px] uppercase tracking-[0.18em] text-vip">Seguimiento integral</p><h1 className="text-xl font-bold text-text">{datos.alumnoNombre}</h1></div>
      </div>
      <PanelSeguimiento datos={datos} modo="entrenador" baseHref={`/admin/alumnos/${id}/seguimiento`} imprimirHref={`/admin/alumnos/${id}/seguimiento/imprimir`} mostrarRevision />
    </div>
  );
}
