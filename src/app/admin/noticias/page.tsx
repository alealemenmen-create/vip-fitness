import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerAnuncios } from "@/lib/noticias/data";
import { AnunciosManager } from "@/components/admin/AnunciosManager";

export default async function NoticiasAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const anuncios = await obtenerAnuncios(supabase);
  const query = await searchParams;
  const titulo = typeof query.titulo === "string" ? query.titulo.slice(0, 90) : "";
  const mensaje = typeof query.mensaje === "string" ? query.mensaje.slice(0, 500) : "";
  const borradorIA = query.ia === "1" && titulo && mensaje ? { titulo, mensaje } : null;

  return (
    <div className="space-y-4">
      <h1 className="text-h2 text-text">Noticias</h1>
      <p className="text-secondary text-text-secondary">
        Lo que publiques acá aparece para todos los alumnos en su pestaña de Noticias VIP.
      </p>
      <AnunciosManager anuncios={anuncios} borradorIA={borradorIA} />
    </div>
  );
}
