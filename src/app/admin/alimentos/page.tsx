import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { AlimentosManager, type AlimentoAdmin } from "@/components/admin/AlimentosManager";
import { AlimentosPendientes, type AlimentoPendiente } from "@/components/admin/AlimentosPendientes";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { CircleAlert, LibraryBig, Salad, Tags } from "lucide-react";

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

export default async function AdminAlimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  await requireAdmin();
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
  const categorias = new Set(alimentos.map((alimento) => alimento.categoria).filter(Boolean)).size;
  const sinCategoria = alimentos.filter((alimento) => !alimento.categoria).length;
  const query = await searchParams;
  const categoriaInicial = query.categoria?.slice(0, 80);

  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader
        eyebrow="Nutrición"
        title="Biblioteca de alimentos"
        description="Aprueba aportes de alumnos y mantén ordenado el catálogo nutricional del portal."
      />
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumen de alimentos">
        <AdminStatCard href="/admin/alimentos#catalogo-alimentos" icon={<LibraryBig size={20} />} value={alimentos.length} label="Alimentos" detail="Abrir catálogo aprobado" color="#3b82f6" />
        <AdminStatCard href="/admin/alimentos#catalogo-alimentos" icon={<Tags size={20} />} value={categorias} label="Categorías" detail="Ver grupos organizados" color="#a78bfa" />
        <AdminStatCard href="/admin/alimentos?categoria=Sin%20categor%C3%ADa#catalogo-alimentos" icon={<CircleAlert size={20} />} value={sinCategoria} label="Sin categoría" detail="Abrir alimentos por clasificar" color="#f59e0b" />
        <AdminStatCard href="/admin/alimentos#alimentos-pendientes" icon={<Salad size={20} />} value={pendientes.length} label="Pendientes" detail="Revisar aportes por aprobar" color={pendientes.length ? "#ef4444" : "#22c55e"} />
      </section>
      <section id="alimentos-pendientes" className="scroll-mt-28 space-y-3">
        {pendientes.length > 0 ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Revisión pendiente</p>
          <AlimentosPendientes alimentos={pendientes} />
        </>
        ) : (
          <div className="admin-panel-card rounded-3xl p-4 text-sm text-text-secondary">No hay aportes pendientes de aprobación.</div>
        )}
      </section>
      <section id="catalogo-alimentos" className="admin-panel-card scroll-mt-28 rounded-3xl p-4 md:p-5">
        <AlimentosManager key={categoriaInicial ?? "todas"} alimentos={alimentos} categoriaInicial={categoriaInicial} />
      </section>
    </div>
  );
}
