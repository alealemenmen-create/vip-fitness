import { MasV2 } from "@/components/v2/MasV2";
import { cargarMasV2Action } from "./actions";
import { leerDespliegueActual } from "@/lib/novedades-deploy";

export default async function MasV2Page() {
  const cargaInicial = await cargarMasV2Action();
  // Mismo dato que ya usa `registrarDespliegueActual` (admin/layout.tsx) para
  // el historial de Novedades -- acá solo se muestra, no se registra de
  // nuevo. `null` fuera de producción (dev/preview), la pantalla se ve igual
  // que siempre en ese caso.
  const despliegue = leerDespliegueActual();
  return <MasV2 cargaInicial={cargaInicial} version={despliegue?.sha.slice(0, 7) ?? null} />;
}
