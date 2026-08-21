import Link from "next/link";
import { ExternalLink, Images } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerDocumentosEstudioVip } from "@/lib/estudio-vip/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EstudioVipEditor } from "@/components/admin/EstudioVipEditor";

export const metadata = { title: "Estudio VIP · Panel VIP" };

export default async function EstudioVipPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const [{ borrador, publicado }, { count: totalAlumnos }, { count: alumnosV2 }] = await Promise.all([
    obtenerDocumentosEstudioVip(),
    supabase.from("alumno_perfil").select("user_id", { count: "exact", head: true }),
    supabase.from("alumno_perfil").select("user_id", { count: "exact", head: true }).eq("portal_v2_habilitado", true),
  ]);

  return <div className="space-y-5 pb-10">
    <AdminPageHeader
      eyebrow="Control de Portal V2"
      title="Estudio VIP"
      description="Edita, previsualiza, guarda como borrador y publica la experiencia del alumno sin tocar sus rutinas ni su progreso."
      actions={<>
        <Link href="/admin/ejercicios" className="boton-panel-secundario"><Images size={15} /> Fotos y videos</Link>
        <Link href="/portal-v2/entrenamiento" target="_blank" className="btn-accion radius-control flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-bold">Portal real <ExternalLink size={15} /></Link>
      </>}
    />
    <EstudioVipEditor borradorInicial={borrador} publicadoInicial={publicado} totalAlumnos={totalAlumnos ?? 0} alumnosV2={alumnosV2 ?? 0} />
  </div>;
}
