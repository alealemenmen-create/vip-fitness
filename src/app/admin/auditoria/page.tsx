import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { AuditoriaHallazgos } from "@/components/admin/AuditoriaHallazgos";
import { CorreccionMacrosActivos } from "@/components/admin/CorreccionMacrosActivos";

export default async function AuditoriaPage() {
  await requireRol(["entrenador", "admin"]);
  const hallazgos = await obtenerHallazgosPendientes();

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
      <CorreccionMacrosActivos />
      <AuditoriaHallazgos hallazgos={hallazgos} />
    </div>
  );
}
