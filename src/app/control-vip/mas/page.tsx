import { requireControlVipV2 } from "@/lib/auth";
import { obtenerColaPendientes } from "@/lib/pendientes/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DirectorioPanel } from "@/components/admin/DirectorioPanel";

/** Directorio completo de Control VIP V2 (doc §5.2/§10 Fase 1: "Más completo
 * y permisos visibles"). Reusa `DirectorioPanel` tal cual usa `/admin/mas`,
 * solo que con el inventario de destinos nuevo. */
export default async function ControlVipV2MasPage() {
  const sesion = await requireControlVipV2();
  const esAdmin = sesion.rol === "admin";
  const colaPendientes = await obtenerColaPendientes();
  const pendientesHoy = colaPendientes.reduce((total, c) => total + c.cantidad, 0);

  return (
    <div className="space-y-4 pb-8">
      <AdminPageHeader
        eyebrow="Control VIP V2 · Piloto"
        title="Más"
        description="Todo el panel nuevo. Lo que todavía no tiene pantalla propia abre en el panel actual."
      />
      <DirectorioPanel
        rol={esAdmin ? "admin" : "entrenador"}
        fuente="control-vip-v2"
        contadores={{ hoy: pendientesHoy }}
      />
    </div>
  );
}
