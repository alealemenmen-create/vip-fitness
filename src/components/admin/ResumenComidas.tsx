import { Card } from "@/components/ui/Card";
import type { ResumenDiaComidas, EstadoDia } from "@/app/alumno/comer/tipos";

const COLOR_ESTADO: Record<EstadoDia, string> = {
  vacio: "var(--color-text-tertiary)",
  parcial: "var(--color-vip)",
  completo: "var(--color-success)",
};

export function ResumenComidas({ resumen }: { resumen: ResumenDiaComidas[] }) {
  return (
    <Card padding="p-2">
      <p className="text-[10px] mb-1 text-text-tertiary">ALIMENTACIÓN · ÚLTIMOS {resumen.length} DÍAS</p>
      <div className="space-y-1">
        {resumen.map((d) => (
          <div key={d.fecha} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: d.estado === "vacio" ? "transparent" : COLOR_ESTADO[d.estado],
                  border: d.estado === "vacio" ? "1px solid var(--color-border)" : "none",
                }}
              />
              <p className="text-caption text-text">{d.fecha}</p>
            </div>
            <p className="text-caption text-text-tertiary">
              {d.estado === "vacio" ? "Sin registro" : `${d.kcal} kcal`}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
