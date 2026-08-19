import { ComunidadV2 } from "@/components/v2/ComunidadV2";
import { obtenerComunidadV2 } from "./data";

export default async function ComunidadV2Page() {
  let datos = null;
  let errorCarga: string | null = null;
  try {
    datos = await obtenerComunidadV2();
  } catch {
    errorCarga = "No pudimos cargar Comunidad. Tus datos se conservan; revisa la conexión e inténtalo nuevamente.";
  }
  return <ComunidadV2 datos={datos} errorCarga={errorCarga} />;
}
