import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth";
import { AlimentosManager, type AlimentoAdmin } from "@/components/admin/AlimentosManager";
import { AlimentosPendientes, type AlimentoPendiente } from "@/components/admin/AlimentosPendientes";
import { TituloPestana } from "@/components/admin/TituloPestana";

const COLUMNAS = "id, nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa, activo";

type FilaAlimento = {
  id: string;
  nombre: string;
  categoria: string | null;
  porcion_base: number;
  unidad: string;
  kcal: number;
  prot: number;
  carb: number;
  grasa: number;
  activo: boolean;
};

function aAdmin(a: FilaAlimento): AlimentoAdmin {
  return {
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
  };
}

export default async function AdminAlimentosPage() {
  await requireRol(["entrenador", "admin"]);
  const supabase = await createClient();

  // Los que esperan el visto bueno (migración 0030). Si todavía no se corrió,
  // la consulta falla y la sección simplemente no aparece — mismo criterio que
  // en el buscador de alimentos con las columnas de la 0013.
  const { data: filasPendientes } = await supabase
    .from("alimentos")
    .select(`${COLUMNAS}, creado_por, perfiles!alimentos_creado_por_fkey(nombre)`)
    .eq("aprobado", false)
    .eq("activo", true)
    .order("nombre");

  type FilaPendiente = FilaAlimento & {
    creado_por: string | null;
    perfiles: { nombre: string } | null;
  };

  const pendientes: AlimentoPendiente[] = ((filasPendientes ?? []) as unknown as FilaPendiente[]).map(
    (a) => ({ ...aAdmin(a), autor: a.perfiles?.nombre ?? "Alumno" })
  );

  const intento = await supabase.from("alimentos").select(COLUMNAS).eq("aprobado", true).order("nombre");
  const { data } = intento.error
    ? await supabase.from("alimentos").select(COLUMNAS).order("nombre")
    : intento;

  const alimentos: AlimentoAdmin[] = ((data ?? []) as unknown as FilaAlimento[]).map(aAdmin);

  return (
    <div className="space-y-4">
      <TituloPestana>
        <h1 className="text-h2 text-text">Alimentos</h1>
      </TituloPestana>
      {pendientes.length > 0 && <AlimentosPendientes alimentos={pendientes} />}
      <AlimentosManager alimentos={alimentos} />
    </div>
  );
}
