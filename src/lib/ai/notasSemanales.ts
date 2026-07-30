import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerIndicadores, type EstadoAlumno } from "@/app/admin/alumnos/data";
import { semanaActualISO } from "@/lib/date";

const MODELO_NOTAS = "claude-sonnet-5";

type Candidato = {
  alias: string;
  alumnoId: string;
  entrenadorId: string;
  estado: EstadoAlumno;
};

const NotasSchema = z.object({
  notas: z
    .array(
      z.object({
        candidatoId: z.string(),
        texto: z.string().min(20).max(300),
      })
    )
    .max(20),
});

export type ResultadoNotasSemanales = {
  ok: boolean;
  generadas: number;
  mensaje: string;
};

function notaDeRespaldo(estado: EstadoAlumno): string {
  if (estado === "atencion") {
    return "Esta semana bajó un poco el ritmo. Nada grave — retomemos de a poco: una sesión más y registrar las comidas ya hace la diferencia. ¡Vamos con todo esta semana!";
  }
  if (estado === "destacado") {
    return "Excelente semana — el esfuerzo se nota. Sigamos exactamente así, con esa misma constancia.";
  }
  return "Buena semana en general. Sigamos sumando de a poco, cada entrenamiento y cada comida registrada cuentan.";
}

/**
 * Si el entrenador no le dejó ninguna nota manual a un alumno durante la
 * semana, la IA genera una — de ánimo si viene flojo, de refuerzo positivo si
 * viene destacado — usando el mismo semáforo que ya se ve en `/admin/alumnos`
 * (nunca datos médicos ni cifras exactas). Idempotente por alumno+semana.
 */
export async function generarNotasSemanalesAutomaticas(): Promise<ResultadoNotasSemanales> {
  const admin = createAdminClient();
  const semanaInicio = semanaActualISO()[0].fecha;

  const [{ data: alumnos }, { data: notasManualesSemana, error: errorNotas }] = await Promise.all([
    admin.from("alumno_perfil").select("user_id, entrenador_id"),
    admin
      .from("notas_entrenador")
      .select("alumno_id, clave_origen")
      .eq("generado_con_ia", false)
      .gte("created_at", `${semanaInicio}T00:00:00Z`),
  ]);

  if (errorNotas) {
    return {
      ok: false,
      generadas: 0,
      mensaje: "No se pudo revisar el historial. Verifica que la migración 0021 esté aplicada.",
    };
  }

  const { data: notasIAExistentes } = await admin
    .from("notas_entrenador")
    .select("clave_origen")
    .eq("generado_con_ia", true)
    .not("clave_origen", "is", null);

  const yaTieneNotaManual = new Set((notasManualesSemana ?? []).map((n) => n.alumno_id));
  const yaGeneradas = new Set((notasIAExistentes ?? []).map((n) => n.clave_origen));

  const alumnosSinNota = (alumnos ?? []).filter(
    (a) => a.entrenador_id && !yaTieneNotaManual.has(a.user_id)
  );
  if (alumnosSinNota.length === 0) {
    return { ok: true, generadas: 0, mensaje: "Todos los alumnos ya tienen nota esta semana." };
  }

  const indicadores = await obtenerIndicadores(
    admin,
    alumnosSinNota.map((a) => a.user_id)
  );

  const candidatos: Candidato[] = [];
  for (const alumno of alumnosSinNota) {
    const claveOrigen = `nota-semanal:${alumno.user_id}:${semanaInicio}`;
    if (yaGeneradas.has(claveOrigen)) continue;
    const indicador = indicadores.get(alumno.user_id);
    if (!indicador) continue;

    candidatos.push({
      alias: `C${candidatos.length + 1}`,
      alumnoId: alumno.user_id,
      entrenadorId: alumno.entrenador_id!,
      estado: indicador.estado,
    });
  }

  if (candidatos.length === 0) {
    return { ok: true, generadas: 0, mensaje: "No hay alumnos nuevos que necesiten nota esta semana." };
  }

  const notasIA = await redactarNotas(candidatos);

  const filas = candidatos.map((c) => ({
    alumno_id: c.alumnoId,
    entrenador_id: c.entrenadorId,
    texto: notasIA.find((n) => n.candidatoId === c.alias)?.texto ?? notaDeRespaldo(c.estado),
    fecha_inicio: new Date().toISOString().slice(0, 10),
    marcar_nueva: true,
    importante: false,
    generado_con_ia: true,
    clave_origen: `nota-semanal:${c.alumnoId}:${semanaInicio}`,
  }));

  const { error } = await admin
    .from("notas_entrenador")
    .upsert(filas, { onConflict: "clave_origen", ignoreDuplicates: true });

  if (error) {
    return {
      ok: false,
      generadas: 0,
      mensaje: "No se pudieron guardar las notas. Verifica que la migración 0021 esté aplicada.",
    };
  }

  return {
    ok: true,
    generadas: filas.length,
    mensaje: `La IA generó ${filas.length} nota(s) para alumnos sin nota esta semana.`,
  };
}

async function redactarNotas(
  candidatos: Candidato[]
): Promise<{ candidatoId: string; texto: string }[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const datosAnonimos = candidatos.map((c) => ({ candidatoId: c.alias, estado: c.estado }));

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: MODELO_NOTAS,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(NotasSchema) },
      messages: [
        {
          role: "user",
          content: `Eres un entrenador personal cálido y profesional de un gimnasio chileno.
El entrenador todavía no le escribió una nota a estas personas esta semana. "estado" indica cómo
vienen: "atencion" (bajaron el ritmo), "normal" (van bien) o "destacado" (vienen excelente).

Para cada una escribe una nota corta y personal como si la escribiera el entrenador:
- "atencion": ánimo y motivación para retomar, nunca de reto ni culpa.
- "destacado": refuerzo positivo, felicitarla por su constancia.
- "normal": aliento general para seguir sumando.

No inventes cifras, pesos, calorías ni datos médicos. No la firmes ni te presentes.

Personas:
${JSON.stringify(datosAnonimos)}`,
        },
      ],
    });
    return response.parsed_output?.notas ?? [];
  } catch (error) {
    console.error("notasSemanales IA:", error);
    return [];
  }
}
