import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerSeguimientoIntegral } from "@/lib/seguimiento/data";
import type { PeriodoSeguimiento } from "@/lib/seguimiento/tipos";
import { InformeSeguimiento } from "@/components/seguimiento/InformeSeguimiento";

export default async function ImprimirSeguimientoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periodo?: string }> }) {
  await requireRol(["entrenador", "admin"]);
  const { id } = await params;
  const numero = Number((await searchParams).periodo);
  const periodo: PeriodoSeguimiento = numero === 14 || numero === 30 ? numero : 7;
  const datos = await obtenerSeguimientoIntegral(await createClient(), id, periodo);
  if (!datos) return <p>No se encontró el alumno.</p>;
  return <div className="informe-vip-fondo -mx-4 min-h-screen bg-[#d9d9d9] py-8 md:-mx-8 lg:-mx-10"><InformeSeguimiento datos={datos} /></div>;
}
