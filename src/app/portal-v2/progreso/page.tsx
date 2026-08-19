import { cargarProgresoV2Action } from "./actions";
import { ProgresoDashboardV2 } from "@/components/v2/ProgresoDashboardV2";

export default async function ProgresoV2Page() {
  const cargaInicial = await cargarProgresoV2Action();
  return <ProgresoDashboardV2 cargaInicial={cargaInicial} />;
}
