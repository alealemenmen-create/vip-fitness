import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { AuditoriaHallazgos } from "@/components/admin/AuditoriaHallazgos";
import { CorreccionMacrosActivos } from "@/components/admin/CorreccionMacrosActivos";
import { CerrarBacklogAuditoria } from "@/components/admin/CerrarBacklogAuditoria";

const FECHA_CORTE_AVISO_SERIES = "2026-08-11";

export default async function AuditoriaPage() {
  await requireAdmin();
  const hallazgos = await obtenerHallazgosPendientes();
  const backlogViejo = hallazgos.filter(
    (h) => h.tipo === "series_sin_registro" && h.fecha < FECHA_CORTE_AVISO_SERIES
  ).length;

  return (
    <div className="space-y-4 pb-8">
      {/* Antes volvía a /admin/configuracion — era el directorio del panel
          antes de la reorganización (INSTRUCTIVO_CLAUDE_REORDENO_PANEL_ENTRENADOR.md
          §4.3). Desde que /admin/mas tomó ese rol y /admin/configuracion pasó
          a ser solo ajustes del sistema, ese "volver" llevaba a una pantalla
          sin relación con Auditoría. */}
      <Link href="/admin/mas" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <span className="text-h3 text-text">Auditoría global</span>
      </Link>
      <p className="text-secondary text-text-secondary">
        Revisa rutinas activas y patrones de Puntos VIP. Las correcciones del entrenador nunca
        penalizan al alumno; los ajustes de puntos siempre esperan tu confirmación.
      </p>
      <CerrarBacklogAuditoria pendientes={backlogViejo} />
      <CorreccionMacrosActivos />
      <AuditoriaHallazgos hallazgos={hallazgos} />
    </div>
  );
}
