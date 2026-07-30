import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { direccionObjetivo } from "@/lib/noticias/data";

const MODELO_MOTIVACION = "claude-sonnet-5";
const KG_UMBRAL = 2; // mismo umbral que las noticias públicas de peso

type DireccionObjetivo = "bajar" | "subir";

type Candidato = {
  alias: string;
  alumnoId: string;
  entrenadorId: string;
  direccion: DireccionObjetivo;
  cambioKg: number;
  mes: string;
};

const MensajesSchema = z.object({
  mensajes: z
    .array(
      z.object({
        candidatoId: z.string(),
        titulo: z.string().min(4).max(70),
        texto: z.string().min(20).max(400),
      })
    )
    .max(20),
});

export type ResultadoMotivacionPeso = {
  ok: boolean;
  generadas: number;
  mensaje: string;
};

function mensajeDeRespaldo(direccion: DireccionObjetivo): { titulo: string; texto: string } {
  return direccion === "bajar"
    ? {
        titulo: "Un empujón para esta semana",
        texto:
          "Este mes el peso se movió un poco al revés de tu objetivo. Es parte normal del proceso — lo que marca la diferencia es seguir constante con tu plan. ¡Vamos que se puede!",
      }
    : {
        titulo: "Un empujón para esta semana",
        texto:
          "Este mes el peso se movió un poco al revés de tu objetivo de ganar masa. Reforcemos la alimentación y el descanso esta semana — la constancia siempre termina rindiendo frutos.",
      };
}

/**
 * Detecta alumnos cuyo peso del mes se movió EN CONTRA de su objetivo (lo
 * opuesto de la noticia pública de `src/lib/noticias/data.ts`) y les deja un
 * mensaje motivacional privado como nota del entrenador — nunca público, y
 * sin mencionar el número exacto de kg para no sonar alarmista. Idempotente
 * por alumno+mes vía `clave_origen`.
 */
export async function generarMotivacionPeso(): Promise<ResultadoMotivacionPeso> {
  const admin = createAdminClient();
  const hoy = new Date();
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const desdeISO = `${mes}-01`;

  const [{ data: alumnos }, { data: pesos }, { data: notasExistentes, error: errorNotas }] =
    await Promise.all([
      admin.from("alumno_perfil").select("user_id, objetivo, entrenador_id"),
      admin
        .from("pesos_corporales")
        .select("alumno_id, fecha, peso_kg")
        .gte("fecha", desdeISO)
        .order("fecha", { ascending: true }),
      admin
        .from("notas_entrenador")
        .select("clave_origen")
        .eq("generado_con_ia", true)
        .not("clave_origen", "is", null),
    ]);

  if (errorNotas) {
    return {
      ok: false,
      generadas: 0,
      mensaje: "No se pudo revisar el historial. Verifica que la migración 0021 esté aplicada.",
    };
  }

  const yaGeneradas = new Set((notasExistentes ?? []).map((n) => n.clave_origen));

  const pesosPorAlumno = new Map<string, { fecha: string; peso: number }[]>();
  for (const p of pesos ?? []) {
    const lista = pesosPorAlumno.get(p.alumno_id) ?? [];
    lista.push({ fecha: p.fecha, peso: p.peso_kg });
    pesosPorAlumno.set(p.alumno_id, lista);
  }

  const candidatos: Candidato[] = [];
  for (const alumno of alumnos ?? []) {
    if (!alumno.entrenador_id) continue;
    const direccion = direccionObjetivo(alumno.objetivo);
    if (direccion === "desconocida") continue;

    const registros = pesosPorAlumno.get(alumno.user_id);
    if (!registros || registros.length < 2) continue;

    const inicial = registros[0].peso;
    const final = registros[registros.length - 1].peso;
    const cambio = Math.round((final - inicial) * 10) / 10;

    const vaEnContra =
      (direccion === "bajar" && cambio >= KG_UMBRAL) ||
      (direccion === "subir" && cambio <= -KG_UMBRAL);
    if (!vaEnContra) continue;

    const claveOrigen = `motivacion-peso:${alumno.user_id}:${mes}`;
    if (yaGeneradas.has(claveOrigen)) continue;

    candidatos.push({
      alias: `C${candidatos.length + 1}`,
      alumnoId: alumno.user_id,
      entrenadorId: alumno.entrenador_id,
      direccion,
      cambioKg: Math.abs(cambio),
      mes,
    });
  }

  if (candidatos.length === 0) {
    return { ok: true, generadas: 0, mensaje: "Nadie necesita un mensaje de motivación este mes." };
  }

  const mensajesIA = await redactarMotivacion(candidatos);

  const filas = candidatos.map((c) => {
    const generado = mensajesIA.find((m) => m.candidatoId === c.alias);
    const respaldo = mensajeDeRespaldo(c.direccion);
    return {
      alumno_id: c.alumnoId,
      entrenador_id: c.entrenadorId,
      texto: `${generado?.titulo ?? respaldo.titulo}\n\n${generado?.texto ?? respaldo.texto}`,
      fecha_inicio: hoy.toISOString().slice(0, 10),
      marcar_nueva: true,
      importante: false,
      generado_con_ia: true,
      clave_origen: `motivacion-peso:${c.alumnoId}:${c.mes}`,
    };
  });

  const { error } = await admin
    .from("notas_entrenador")
    .upsert(filas, { onConflict: "clave_origen", ignoreDuplicates: true });

  if (error) {
    return {
      ok: false,
      generadas: 0,
      mensaje: "No se pudieron guardar los mensajes. Verifica que la migración 0021 esté aplicada.",
    };
  }

  return {
    ok: true,
    generadas: filas.length,
    mensaje: `Se generaron ${filas.length} mensajes de motivación privados.`,
  };
}

async function redactarMotivacion(
  candidatos: Candidato[]
): Promise<{ candidatoId: string; titulo: string; texto: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const datosAnonimos = candidatos.map((c) => ({
    candidatoId: c.alias,
    objetivoDireccion: c.direccion,
  }));

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: MODELO_MOTIVACION,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(MensajesSchema) },
      messages: [
        {
          role: "user",
          content: `Eres un entrenador personal cálido y profesional de un gimnasio chileno.
Cada persona de la lista tuvo un cambio de peso este mes que fue EN CONTRA de su objetivo
("objetivoDireccion" indica hacia dónde quería ir: "bajar" o "subir").

Para cada una, escribe un mensaje PRIVADO (solo lo ve esa persona, nadie más), breve, cálido
y motivador — nunca de reproche ni culpa. No menciones ningún número de kg. No des consejos
médicos ni nutricionales específicos. Recuérdale que un mes no define el proceso y anímalo a
seguir constante.

Personas:
${JSON.stringify(datosAnonimos)}`,
        },
      ],
    });
    return response.parsed_output?.mensajes ?? [];
  } catch (error) {
    console.error("motivacionPeso IA:", error);
    return [];
  }
}
