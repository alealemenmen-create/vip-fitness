import { CircleDollarSign } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { obtenerGastosApp } from "@/lib/gastos/data";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GastosAppManager } from "@/components/admin/GastosAppManager";
import { Card } from "@/components/ui/Card";
import { hoyISO } from "@/lib/date";

export default async function GastosAppPage() {
  await requireRol(["entrenador", "admin"]);
  const { disponible, gastos, pagos } = await obtenerGastosApp();
  return (
    <div className="space-y-6 pb-8">
      <AdminPageHeader eyebrow="Más · Administración" title="Gastos de la app" description="Controla cuánto cuesta mantener VIP Fitness y recibe avisos antes de cada pago." backHref="/admin/configuracion" />
      {!disponible ? (
        <Card className="border border-warning/40" padding="p-5"><CircleDollarSign size={22} className="text-warning" /><p className="text-body mt-2 font-bold text-text">Falta activar el control de gastos</p><p className="text-caption mt-1 text-text-secondary">Corre la migración 0070_gastos_app.sql. Después aparecerán los servicios iniciales de PAGOS_SERVICIOS.md.</p></Card>
      ) : <GastosAppManager gastos={gastos} pagos={pagos} hoy={hoyISO()} />}
    </div>
  );
}
