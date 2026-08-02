import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/** Etiqueta de caché de la configuración del registro público. La pantalla de
 * Configuración la invalida al guardar (ver admin/configuracion/actions.ts). */
export const TAG_CONFIG_REGISTRO = "configuracion-registro";

export type ConfiguracionRegistro = {
  /** Muestra el aviso de "esto es una prueba" en la pantalla de inscripción. */
  betaAviso: boolean;
  /** Con esto en false, el registro termina al mandar los datos: la persona no
   * ve datos bancarios ni se le pide comprobante. Es el estado de la beta. */
  pagoActivo: boolean;
  pagoMonto: number | null;
  banco: string | null;
  tipoCuenta: string | null;
  numeroCuenta: string | null;
  rut: string | null;
  titular: string | null;
  correo: string | null;
  instrucciones: string | null;
  /** Solo dígitos con código de país, ej: 56912345678. */
  whatsapp: string | null;
};

export const CONFIG_REGISTRO_DEFAULT: ConfiguracionRegistro = {
  betaAviso: true,
  pagoActivo: false,
  pagoMonto: null,
  banco: null,
  tipoCuenta: null,
  numeroCuenta: null,
  rut: null,
  titular: null,
  correo: null,
  instrucciones: null,
  whatsapp: null,
};

/**
 * Se lee en cada visita al link público, que es la página más expuesta del
 * portal: cacheada por etiqueta como la de supervisión, para que una ronda de
 * inscripciones no se traduzca en una consulta por visita.
 *
 * Si la migración 0033 todavía no está aplicada, la consulta falla y se
 * devuelven los valores por defecto — o sea, registro sin pago, que es
 * exactamente el comportamiento que había antes de esta migración.
 */
export const obtenerConfiguracionRegistro = unstable_cache(
  async (): Promise<ConfiguracionRegistro> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("configuracion_gimnasio")
      .select(
        "registro_beta_aviso, pago_registro_activo, pago_monto, pago_banco, pago_tipo_cuenta, pago_numero_cuenta, pago_rut, pago_titular, pago_correo, pago_instrucciones, whatsapp_gimnasio"
      )
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return CONFIG_REGISTRO_DEFAULT;

    return {
      betaAviso: data.registro_beta_aviso,
      pagoActivo: data.pago_registro_activo,
      pagoMonto: data.pago_monto,
      banco: data.pago_banco,
      tipoCuenta: data.pago_tipo_cuenta,
      numeroCuenta: data.pago_numero_cuenta,
      rut: data.pago_rut,
      titular: data.pago_titular,
      correo: data.pago_correo,
      instrucciones: data.pago_instrucciones,
      whatsapp: data.whatsapp_gimnasio,
    };
  },
  ["configuracion-registro"],
  { tags: [TAG_CONFIG_REGISTRO] }
);
