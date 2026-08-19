import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerAnuncios, obtenerBorradoresNoticias } from "@/lib/noticias/data";
import { AnunciosManager } from "@/components/admin/AnunciosManager";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { FileClock, Megaphone, Users } from "lucide-react";

export default async function NoticiasAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const [anuncios, borradores] = await Promise.all([
    obtenerAnuncios(supabase),
    obtenerBorradoresNoticias(supabase),
  ]);
  const query = await searchParams;
  const titulo = typeof query.titulo === "string" ? query.titulo.slice(0, 90) : "";
  const mensaje = typeof query.mensaje === "string" ? query.mensaje.slice(0, 500) : "";
  const borradorId = typeof query.borrador === "string" ? query.borrador.slice(0, 40) : "";
  const borradorIA = query.ia === "1" && titulo && mensaje ? { id: borradorId, titulo, mensaje } : null;

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Comunidad"
        title="Noticias VIP"
        description="Prepara y publica comunicados que aparecerán para todos los alumnos en su portal."
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Resumen de noticias">
        <AdminStatCard href="/admin/noticias#noticias-publicadas" icon={<Megaphone size={20} />} value={anuncios.length} label="Publicadas" detail="Ver noticias visibles" color="#22c55e" />
        <AdminStatCard href="/admin/noticias#borradores-noticias" icon={<FileClock size={20} />} value={borradores.length} label="Borradores" detail="Revisar antes de publicar" color="#f59e0b" />
        <AdminStatCard href="/admin/alumnos" icon={<Users size={20} />} value="Todos" label="Audiencia" detail="Ver alumnos del portal" color="#3b82f6" />
      </section>
      <section className="admin-panel-card scroll-mt-28 rounded-3xl p-4 md:p-5">
        <AnunciosManager anuncios={anuncios} borradores={borradores} borradorIA={borradorIA} />
      </section>
    </div>
  );
}
