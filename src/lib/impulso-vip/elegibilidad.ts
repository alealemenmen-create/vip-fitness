import type { TipoIntervencionEnVivo } from "./en-vivo";

export type NivelExperiencia = "principiante" | "intermedio" | "avanzado";
export type IntensidadImpulso = "ninguna" | "baja" | "media" | "alta";

export interface EvaluarTecnicaIntensivaInput {
  ejercicioVinculado: boolean;
  perfilEjercicioRevisado: boolean;
  intensidadMaxima: IntensidadImpulso;
  tecnicasPermitidas: TipoIntervencionEnVivo[];
  tecnicasConRetroceso: TipoIntervencionEnVivo[];
  experiencia: NivelExperiencia | null;
  tieneRestriccionMedica: boolean;
  dolorActivo: boolean;
  registroConfiable: boolean;
  rirCalibracion: number;
  tecnicasIntensasSesion: number;
}

export type ElegibilidadTecnicaIntensiva = {
  tecnica: "drop_set" | "rest_pause" | "fallo_controlado" | null;
  requiereSupervision: boolean;
  motivosBloqueo: string[];
};

/** Selecciona una sola tecnica intensa. Seguridad y dosificacion ganan
 * siempre: cualquier incertidumbre devuelve null y conserva el cierre
 * controlado que ya existe. */
export function evaluarTecnicaIntensiva(
  input: EvaluarTecnicaIntensivaInput
): ElegibilidadTecnicaIntensiva {
  const bloqueos: string[] = [];
  if (!input.ejercicioVinculado) bloqueos.push("ejercicio_sin_vincular");
  if (!input.perfilEjercicioRevisado) bloqueos.push("perfil_ejercicio_sin_revisar");
  if (input.intensidadMaxima === "ninguna" || input.intensidadMaxima === "baja") bloqueos.push("intensidad_no_autorizada");
  if (!input.experiencia || input.experiencia === "principiante") bloqueos.push("experiencia_insuficiente");
  if (input.tieneRestriccionMedica) bloqueos.push("ficha_medica_requiere_revision");
  if (input.dolorActivo) bloqueos.push("dolor_activo");
  if (!input.registroConfiable) bloqueos.push("registro_no_verificable");
  if (input.rirCalibracion <= 0) bloqueos.push("sin_margen_en_serie_anterior");
  if (input.tecnicasIntensasSesion >= 3) bloqueos.push("limite_sesion_alcanzado");
  if (bloqueos.length > 0) return { tecnica: null, requiereSupervision: false, motivosBloqueo: bloqueos };

  const retroceder = new Set(input.tecnicasConRetroceso);
  const permitidas = new Set(input.tecnicasPermitidas.filter((tecnica) => !retroceder.has(tecnica)));
  if (input.intensidadMaxima === "alta" && input.experiencia === "avanzado" && permitidas.has("rest_pause")) {
    return { tecnica: "rest_pause", requiereSupervision: true, motivosBloqueo: [] };
  }
  if (permitidas.has("drop_set")) {
    return { tecnica: "drop_set", requiereSupervision: true, motivosBloqueo: [] };
  }
  // El fallo dinamico necesita autorizacion alta explicita; nunca es el
  // respaldo generico cuando no se reconoce otra tecnica.
  if (input.intensidadMaxima === "alta" && input.experiencia === "avanzado" && permitidas.has("fallo_controlado")) {
    return { tecnica: "fallo_controlado", requiereSupervision: true, motivosBloqueo: [] };
  }
  return {
    tecnica: null,
    requiereSupervision: false,
    motivosBloqueo: [retroceder.size > 0 ? "memoria_indica_retroceder" : "sin_tecnica_compatible"],
  };
}
