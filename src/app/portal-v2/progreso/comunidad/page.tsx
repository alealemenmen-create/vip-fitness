import { ComunidadV2 } from "@/components/v2/ComunidadV2";
import { obtenerComunidadV2 } from "./data";

export default async function ComunidadV2Page() {
  const datos = await obtenerComunidadV2();
  return <ComunidadV2 datos={datos} />;
}
