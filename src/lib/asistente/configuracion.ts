import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/date";

export type ConfiguracionAsistenteVip = {
  disponible: boolean;
  activo: boolean;
  presupuestoMensualUsd: number;
  gastadoMesUsd: number;
  consultasMes: number;
};

export async function obtenerConfiguracionAsistenteVip(): Promise<ConfiguracionAsistenteVip> {
  const supabase = await createClient();
  const { data: config, error } = await supabase
    .from("configuracion_gimnasio")
    .select("asistente_ia_activo, presupuesto_ia_mensual_usd")
    .eq("id", true)
    .maybeSingle();
  if (error || !config) {
    return { disponible: false, activo: false, presupuestoMensualUsd: 10, gastadoMesUsd: 0, consultasMes: 0 };
  }
  const inicioMes = `${hoyISO().slice(0, 7)}-01T00:00:00.000Z`;
  const { data: usos } = await supabase.from("asistente_uso_ia").select("costo_usd").gte("created_at", inicioMes);
  return {
    disponible: true,
    activo: config.asistente_ia_activo,
    presupuestoMensualUsd: Number(config.presupuesto_ia_mensual_usd),
    gastadoMesUsd: (usos ?? []).reduce((total, uso) => total + Number(uso.costo_usd), 0),
    consultasMes: usos?.length ?? 0,
  };
}

