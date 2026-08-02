import Link from "next/link";
import { ChevronRight, Link2, UserRoundPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Puerta de entrada a las solicitudes desde la pantalla de Alumnos.
 *
 * Cambia de tono según haya o no gente esperando: con solicitudes pendientes
 * es lo primero que se ve y va resaltado; sin ninguna, se reduce a un renglón
 * discreto que recuerda que existe el link para compartir.
 */
export function AvisoSolicitudes({ pendientes }: { pendientes: number }) {
  if (pendientes === 0) {
    return (
      <Link
        href="/admin/solicitudes"
        className="radius-control flex items-center gap-1.5 border border-dashed border-border px-2.5 py-1.5 text-caption text-text-tertiary"
      >
        <Link2 size={12} />
        <span className="flex-1">Link de inscripción para alumnos nuevos</span>
        <ChevronRight size={12} />
      </Link>
    );
  }

  return (
    <Link href="/admin/solicitudes" className="block">
      <Card padding="p-2" className="border border-vip/40">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-vip/15">
            <UserRoundPlus size={13} className="text-vip" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-caption font-medium leading-tight text-text">
              {pendientes === 1
                ? "1 persona quiere inscribirse"
                : `${pendientes} personas quieren inscribirse`}
            </p>
            <p className="text-[9px] leading-tight text-text-tertiary">Revisa y acepta sus solicitudes</p>
          </div>
          <ChevronRight size={13} className="shrink-0 text-text-tertiary" />
        </div>
      </Card>
    </Link>
  );
}
