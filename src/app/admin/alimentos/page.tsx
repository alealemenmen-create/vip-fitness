import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { AlimentosManager, type AlimentoAdmin } from "@/components/admin/AlimentosManager";

export default async function AdminAlimentosPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("alimentos")
    .select("id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa, activo")
    .order("nombre");

  const alimentos: AlimentoAdmin[] = (data ?? []).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    categoria: a.categoria,
    porcionBase: a.porcion_base,
    unidad: a.unidad,
    kcal: a.kcal,
    prot: a.prot,
    carb: a.carb,
    grasa: a.grasa,
    activo: a.activo,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-h2 text-text">Alimentos</h1>
      <AlimentosManager alimentos={alimentos} />
    </div>
  );
}
