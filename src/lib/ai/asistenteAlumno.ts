import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hoyISO } from "@/lib/date";
import type { ContextoAlumnoVip } from "@/lib/asistente/alumno";

const MODELO = "claude-sonnet-5";
const RespuestaSchema = z.object({
  respuesta: z.string().min(20).max(900),
  avisoSeguridad: z.string().max(250).nullable(),
});

export type RespuestaAlumnoVip = {
  texto: string;
  aviso: string | null;
  costoUsd: number;
};

export async function responderAlumnoVip(
  alumnoId: string,
  pregunta: string,
  contexto: ContextoAlumnoVip
): Promise<{ respuesta: RespuestaAlumnoVip | null; error: string | null }> {
  const admin = createAdminClient();
  const { data: config, error: errorConfig } = await admin
    .from("configuracion_gimnasio")
    .select("asistente_ia_activo, presupuesto_ia_mensual_usd")
    .eq("id", true)
    .maybeSingle();
  if (errorConfig || !config) return { respuesta: null, error: "El Asistente VIP todavía no está activado." };
  if (!config.asistente_ia_activo) return { respuesta: null, error: "El Asistente VIP está pausado temporalmente." };

  const inicioMes = `${hoyISO().slice(0, 7)}-01T00:00:00.000Z`;
  const { data: usos } = await admin.from("asistente_uso_ia").select("costo_usd").gte("created_at", inicioMes);
  const gastado = (usos ?? []).reduce((total, uso) => total + Number(uso.costo_usd), 0);
  if (gastado >= Number(config.presupuesto_ia_mensual_usd)) {
    return { respuesta: null, error: "El asistente alcanzó su límite mensual. Tus recordatorios e historial siguen disponibles." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { respuesta: null, error: "El Asistente VIP todavía no está configurado." };

  try {
    const client = new Anthropic({ apiKey });
    const salida = await client.messages.parse({
      model: MODELO,
      max_tokens: 750,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(RespuestaSchema) },
      messages: [{
        role: "user",
        content: `Eres el Asistente VIP personal de un alumno de gimnasio.
Puedes explicar ejercicios, alimentación general, suplementación general, recuperación, motivación y el historial entregado.
No diagnostiques ni trates lesiones. Ante dolor intenso, síntomas preocupantes o una posible lesión, indica detener el ejercicio y consultar al entrenador o a un profesional de salud.
No cambies la rutina ni el plan alimentario del entrenador. No inventes datos. Responde claro y breve en español.

Pregunta: ${pregunta}
Contexto personal calculado por Portal VIP: ${JSON.stringify(contexto)}`,
      }],
    });
    const parsed = salida.parsed_output;
    if (!parsed) return { respuesta: null, error: "No fue posible preparar una respuesta segura." };
    const costoUsd = (salida.usage.input_tokens / 1_000_000) * 3 + (salida.usage.output_tokens / 1_000_000) * 15;
    await admin.from("asistente_uso_ia").insert({
      usuario_id: alumnoId,
      herramienta: "alumno",
      modelo: MODELO,
      tokens_entrada: salida.usage.input_tokens,
      tokens_salida: salida.usage.output_tokens,
      costo_usd: costoUsd,
    });
    return { respuesta: { texto: parsed.respuesta, aviso: parsed.avisoSeguridad, costoUsd }, error: null };
  } catch (error) {
    console.error("Asistente VIP alumno:", error);
    return { respuesta: null, error: "No pude responder ahora. Tu historial sigue disponible abajo." };
  }
}

