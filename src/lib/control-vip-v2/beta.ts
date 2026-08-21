import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CuentaBetaControlVipV2 = {
  id: string;
  nombre: string;
  rol: "entrenador" | "admin";
  habilitado: boolean;
};

/** Todas las cuentas de staff (entrenador/admin), para el toggle de piloto en Configuración. */
export async function obtenerCuentasBetaControlVipV2(): Promise<CuentaBetaControlVipV2[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("perfiles")
    .select("id, nombre, rol, control_vip_v2_habilitado")
    .in("rol", ["entrenador", "admin"])
    .order("rol", { ascending: false })
    .order("nombre", { ascending: true });

  return (data ?? []).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    rol: fila.rol as "entrenador" | "admin",
    habilitado: fila.control_vip_v2_habilitado === true,
  }));
}
