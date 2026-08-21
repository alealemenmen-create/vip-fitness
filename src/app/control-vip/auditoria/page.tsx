import { requireControlVipV2Admin } from "@/lib/auth";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { AuditoriaHallazgos } from "@/components/admin/AuditoriaHallazgos";
import { CorreccionMacrosActivos } from "@/components/admin/CorreccionMacrosActivos";
import { CerrarBacklogAuditoria } from "@/components/admin/CerrarBacklogAuditoria";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const FECHA_CORTE_AVISO_SERIES = "2026-08-11";

/** Misma pantalla que `/admin/auditoria`, mismos componentes y datos. */
export default async function ControlVipV2AuditoriaPage() {
  await requireControlVipV2Admin();
  const hallazgos = await obtenerHallazgosPendientes();
  const backlogViejo = hallazgos.filter(
    (h) => h.tipo === "series_sin_registro" && h.fecha < FECHA_CORTE_AVISO_SERIES
  ).length;

  return (
    <div className="space-y-4 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Auditoría global"
        description="Revisa rutinas activas y patrones de Puntos VIP. Las correcciones del entrenador nunca penalizan al alumno; los ajustes de puntos siempre esperan tu confirmación."
        backHref="/control-vip/mas"
      />
      <CerrarBacklogAuditoria pendientes={backlogViejo} />
      <CorreccionMacrosActivos />
      <AuditoriaHallazgos hallazgos={hallazgos} />
    </div>
  );
}
