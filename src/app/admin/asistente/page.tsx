import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AsistenteVipPanel } from "@/components/admin/AsistenteVipPanel";

export default async function AsistenteVipPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();
  const { count } = await supabase
    .from("alumno_perfil")
    .select("user_id", { count: "exact", head: true });

  return <AsistenteVipPanel totalAlumnos={count ?? 0} />;
}
