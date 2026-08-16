import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRol } from "@/lib/auth";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DESTINOS_RUTINAS } from "@/lib/admin/destinos";

export const metadata = { title: "Rutinas · Panel VIP" };

/**
 * Puerta única de Rutinas (instructivo §4.1 y §9.1).
 *
 * En celular existían "Armar" como pestaña suelta y "Documentos" como otra,
 * mientras el generador y las rutinas ya hechas no aparecían en ningún lado:
 * había que girar el teléfono para llegar a la barra lateral. Las cuatro
 * puertas viven ahora en una sola pantalla que explica **cuándo** usar cada
 * una — el instructivo señala que "Armar rutina" y "Generador de rutinas"
 * llevan a experiencias muy parecidas sin decir en qué se diferencian.
 *
 * Es una pantalla de navegación: no toca datos, no arma nada y no cambia
 * ninguna de las cuatro herramientas a las que lleva.
 */
export default async function RutinasPage() {
  await requireRol(["entrenador", "admin"]);

  return (
    <div className="pb-10">
      <AdminPageHeader
        eyebrow="Armado y asignación"
        title="Rutinas"
        description="Las cuatro herramientas de rutinas, con lo que hace cada una. El alumno se elige adentro."
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {DESTINOS_RUTINAS.map((destino) => {
          const Icon = destino.icon;
          return (
            <Link
              key={destino.href}
              href={destino.href}
              className="tarjeta-panel flex items-center gap-3 transition-colors hover:border-vip/40"
            >
              <span className="item-menu-panel-icono size-11 shrink-0 rounded-xl">
                <Icon size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-body font-semibold text-text">{destino.label}</strong>
                <span className="mt-1 block text-caption text-text-secondary">{destino.detalle}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-text-tertiary" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
