import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAlumno } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PerfilEntrenamientoForm } from "@/components/student/PerfilEntrenamientoForm";
import { Card } from "@/components/ui/Card";
import type { SupabaseClient } from "@supabase/supabase-js";

export default async function MiEntrenamientoPage() {
  const { alumnoId, soloLectura } = await requireAlumno();
  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data } = await db.from("perfiles_entrenamiento").select("*").eq("alumno_id", alumnoId).maybeSingle();
  return <div className="space-y-4 pb-8"><Link href="/alumno/inicio" className="flex items-center gap-2"><ArrowLeft size={20} className="text-text-secondary" /><h1 className="text-h3 text-text">Mi entrenamiento</h1></Link>{soloLectura ? <Card><p className="text-body text-text-secondary">Vista de solo lectura.</p></Card> : <PerfilEntrenamientoForm datos={data} />}</div>;
}
