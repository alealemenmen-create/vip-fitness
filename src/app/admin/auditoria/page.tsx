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
      <Link href="/admin/configuracion" className="flex items-center gap-2">
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
