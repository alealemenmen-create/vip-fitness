import { Sparkles, Wrench, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Novedad } from "@/lib/novedades";
import { formatFechaHoraCorta } from "@/lib/date";

const ESTILO_CATEGORIA: Record<Novedad["categoria"], { icono: React.ReactNode; etiqueta: string; color: string }> = {
  arreglo: { icono: <Wrench size={13} />, etiqueta: "Arreglo", color: "var(--color-error)" },
  mejora: { icono: <Sparkles size={13} />, etiqueta: "Mejora", color: "var(--color-vip)" },
  funcion_nueva: { icono: <Plus size={13} />, etiqueta: "Función nueva", color: "var(--color-success)" },
};

/** Lista de novedades de la app, de más reciente a más vieja. Los despliegues
 * de producción se registran automáticamente; las explicaciones manuales
 * anteriores siguen apareciendo en la misma lista. */
export function Novedades({ novedades }: { novedades: Novedad[] }) {
  if (novedades.length === 0) {
    return (
      <Card padding="p-3">
        <p className="text-caption text-text-tertiary">Todavía no hay novedades registradas.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {novedades.map((n) => {
        const estilo = ESTILO_CATEGORIA[n.categoria];
        return (
          <Card key={n.id} padding="p-3">
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ color: estilo.color, background: `color-mix(in srgb, ${estilo.color} 16%, transparent)` }}
              >
                {estilo.icono}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-secondary font-semibold text-text">{n.titulo}</p>
                  <span className="text-micro shrink-0 text-text-tertiary">{formatFechaHoraCorta(n.creadoEn)}</span>
                </div>
                <p className="text-caption mt-0.5 text-text-secondary">{n.resumen}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
