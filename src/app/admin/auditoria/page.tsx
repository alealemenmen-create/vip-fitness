import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { AuditoriaHallazgos } from "@/components/admin/AuditoriaHallazgos";

export default async function AuditoriaPage() {
  await requireRol(["entrenador", "admin"]);
  const hallazgos = await obtenerHallazgosPendientes();

  return (
    <div className="space-y-4 pb-8">
      <Link href="/admin/configuracion" className="flex items-center gap-2">
        <ArrowLeft size={20} className="text-text-secondary" />
        <span className="text-h3 text-text">Auditoría de Puntos VIP</span>
      </Link>
      <p className="text-secondary text-text-secondary">
        Patrones detectados automáticamente en los últimos 90 días. Nada se descuenta solo —
        cada hallazgo espera tu revisión.
      </p>
      <AuditoriaHallazgos hallazgos={hallazgos} />
    </div>
  );
}
