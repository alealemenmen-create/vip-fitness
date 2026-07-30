import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/** Etiqueta de caché de la configuración del gimnasio. La pantalla de
 * Configuración la invalida al guardar (ver admin/configuracion/actions.ts). */
export const TAG_CONFIG_SUPERVISION = "configuracion-supervision";

export type ConfiguracionSupervision = {
  diasSinEntrenarAlerta: number;
  pctEntrenamientoAtencion: number;
  pctEntrenamientoDestacado: number;
  diasComidaAtencion: number;
  diasComidaDestacado: number;
};

export const CONFIG_SUPERVISION_DEFAULT: ConfiguracionSupervision = {
  diasSinEntrenarAlerta: 7,
  pctEntrenamientoAtencion: 50,
  pctEntrenamientoDestacado: 85,
  diasComidaAtencion: 2,
  diasComidaDestacado: 5,
};

/**
 * Una fila fija de configuración que solo cambia cuando el entrenador la
 * edita a mano, pero que se leía en cada carga del panel (y una vez por cada
 * cálculo de indicadores). Cacheada hasta que la pantalla de Configuración
 * la invalide por etiqueta.
 */
export const obtenerConfiguracionSupervision = unstable_cache(
  async (): Promise<ConfiguracionSupervision> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("configuracion_gimnasio")
      .select(
        "dias_sin_entrenar_alerta, pct_entrenamiento_atencion, pct_entrenamiento_destacado, dias_comida_atencion, dias_comida_destacado"
      )
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return CONFIG_SUPERVISION_DEFAULT;
    return {
      diasSinEntrenarAlerta: data.dias_sin_entrenar_alerta,
      pctEntrenamientoAtencion: data.pct_entrenamiento_atencion,
      pctEntrenamientoDestacado: data.pct_entrenamiento_destacado,
      diasComidaAtencion: data.dias_comida_atencion,
      diasComidaDestacado: data.dias_comida_destacado,
    };
  },
  ["configuracion-supervision"],
  { tags: [TAG_CONFIG_SUPERVISION] }
);
