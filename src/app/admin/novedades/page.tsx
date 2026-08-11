import { requireRol } from "@/lib/auth";
import { obtenerNovedades } from "@/lib/novedades";
import { Novedades } from "@/components/admin/Novedades";
import { MarcarNovedadesVistas } from "@/components/admin/MarcarNovedadesVistas";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/** Sección propia, no una gaveta más de Configuración: pedido explícito del
 * entrenador ("una nueva sección con el registro de actualizaciones"). Antes
 * vivía adentro de una gaveta plegada de Configuración, sin ninguna forma de
 * saber si había algo nuevo — `MarcarNovedadesVistas` es lo que apaga el
 * contador de la navegación al entrar acá. */
export default async function NovedadesAdminPage() {
  await requireRol(["entrenador", "admin"]);
  const novedades = await obtenerNovedades();

  return (
    <div className="space-y-4 pb-4">
      <AdminPageHeader
        eyebrow="Registro de cambios"
        title="Actualizaciones"
        description="Qué se arregló o se agregó en la app, en orden — para no tener que preguntar cada vez."
      />
      <MarcarNovedadesVistas ultimaEn={novedades[0]?.creadoEn ?? null} />
      <Novedades novedades={novedades} />
    </div>
  );
}
