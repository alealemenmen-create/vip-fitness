import { MasV2 } from "@/components/v2/MasV2";
import { cargarMasV2Action } from "./actions";

export default async function MasV2Page() {
  const cargaInicial = await cargarMasV2Action();
  return <MasV2 cargaInicial={cargaInicial} />;
}
