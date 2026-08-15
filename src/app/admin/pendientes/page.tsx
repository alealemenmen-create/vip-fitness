import Link from "next/link";
import { requireRol } from "@/lib/auth";
import { obtenerColaPendientes } from "@/lib/pendientes/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { ChevronRight, ClipboardCheck } from "lucide-react";

const CLASE_SEVERIDAD: Record<string, string> = {
  error: "border-error/30 bg-error/10 text-error",
  warning: "border-warning/30 bg-warning/10 text-warning",
  neutral: "border-border bg-surface-2 text-text-secondary",
};

/**
 * Cola única de todo lo que espera una decisión del entrenador — sección 9.4
 * del instructivo de reorganización del panel. Cada tarjeta lleva a su
 * pantalla de origen real (Solicitudes, Auditoría, Errores, Borrados,
 * Galería, Gastos): esto no reemplaza esas pantallas, solo evita tener que
 * visitar seis lugares distintos para saber si hay algo esperando.
 */
export default async function PendientesPage() {
  await requireRol(["entrenador", "admin"]);
  const categorias = await obtenerColaPendientes();
  const total = categorias.reduce((suma, c) => suma + c.cantidad, 0);

  return (
    <div className="space-y-4 pb-8">
      <AdminPageHeader
        eyebrow="Panel del entrenador"
        title="Pendientes"
        description="Todo lo que espera una decisión tuya, en un solo lugar."
      />

      {categorias.length === 0 ? (
        <Card padding="p-5" className="flex flex-col items-center gap-2 text-center">
          <ClipboardCheck size={28} className="text-success" />
          <p className="text-body font-semibold text-text">Nada pendiente ahora mismo</p>
          <p className="text-caption text-text-tertiary">
            Solicitudes, auditoría, errores, borrados y gastos están al día.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-caption text-text-tertiary">
            {total} {total === 1 ? "cosa espera" : "cosas esperan"} tu decisión, agrupadas por tipo.
          </p>
          {categorias.map((categoria) => (
            <Link key={categoria.id} href={categoria.href} className="block">
              <Card padding="p-3" className="flex items-center gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold ${CLASE_SEVERIDAD[categoria.severidad]}`}
                >
                  {categoria.cantidad > 99 ? "99+" : categoria.cantidad}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-caption font-semibold text-text">{categoria.etiqueta}</span>
                  <span className="block truncate text-micro text-text-tertiary">{categoria.descripcion}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-tertiary" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
