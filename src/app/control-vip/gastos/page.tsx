import { CircleDollarSign } from "lucide-react";
import { requireControlVipV2Admin } from "@/lib/auth";
import { obtenerGastosApp } from "@/lib/gastos/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GastosAppManager } from "@/components/admin/GastosAppManager";
import { Card } from "@/components/ui/Card";
import { hoyISO } from "@/lib/date";

/** Misma pantalla que `/admin/gastos`, mismos componentes y datos. */
export default async function ControlVipV2GastosPage() {
  await requireControlVipV2Admin();
  const { disponible, gastos, pagos } = await obtenerGastosApp();
  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader eyebrow="Control VIP V2 · Piloto" title="Gastos de la app" description="Controla cuánto cuesta mantener VIP Fitness y recibe avisos antes de cada pago." backHref="/control-vip/mas" />
      {!disponible ? (
        <Card className="border border-warning/40" padding="p-5"><CircleDollarSign size={22} className="text-warning" /><p className="text-body mt-2 font-bold text-text">Falta activar el control de gastos</p><p className="text-caption mt-1 text-text-secondary">Corre la migración 0070_gastos_app.sql. Después aparecerán los servicios iniciales de PAGOS_SERVICIOS.md.</p></Card>
      ) : <GastosAppManager gastos={gastos} pagos={pagos} hoy={hoyISO()} />}
    </div>
  );
}
