import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { construirReporteVip } from "@/lib/asistente/reportes";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";
import type { RespuestaIaVip, TipoReporteVip } from "@/lib/asistente/tipos";
import { hoyISO } from "@/lib/date";

const MODELO = "claude-sonnet-5";
const PRECIO_ENTRADA_MILLON = 3;
const PRECIO_SALIDA_MILLON = 15;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const IntencionSchema = z.object({
  herramienta: z.enum(["atencion", "nutricion", "entrenamiento", "progreso", "noticia"]),
  alumno: z.string().trim().max(80).nullable(),
});

const RedaccionSchema = z.object({
  titulo: z.string().min(4).max(80),
  resumen: z.string().min(20).max(650),
  noticia: z
    .object({
      titulo: z.string().min(5).max(90),
      mensaje: z.string().min(20).max(500),
    })
    .nullable(),
});

type Consumo = { entrada: number; salida: number };

function costo(consumo: Consumo): number {
  return (
    (consumo.entrada / 1_000_000) * PRECIO_ENTRADA_MILLON +
    (consumo.salida / 1_000_000) * PRECIO_SALIDA_MILLON
  );
}

async function presupuestoDisponible(supabase: SupabaseServerClient) {
  const { data: config, error: errorConfig } = await supabase
    .from("configuracion_gimnasio")
    .select("asistente_ia_activo, presupuesto_ia_mensual_usd")
    .eq("id", true)
    .maybeSingle();

  if (errorConfig || !config) {
    return { ok: false as const, mensaje: "Aplica la migración 0037 para activar la IA con control de presupuesto." };
  }
  if (!config.asistente_ia_activo) {
    return { ok: false as const, mensaje: "El Asistente VIP con IA está pausado en la configuración." };
  }

  const inicioMes = `${hoyISO().slice(0, 7)}-01T00:00:00.000Z`;
  const { data: usos, error: errorUsos } = await supabase
    .from("asistente_uso_ia")
    .select("costo_usd")
    .gte("created_at", inicioMes);
  if (errorUsos) {
    return { ok: false as const, mensaje: "No fue posible verificar el presupuesto de IA." };
  }

  const gastado = (usos ?? []).reduce((total, uso) => total + Number(uso.costo_usd), 0);
  const limite = Number(config.presupuesto_ia_mensual_usd);
  if (gastado >= limite) {
    return { ok: false as const, mensaje: `Se alcanzó el presupuesto mensual de IA de US$${limite.toFixed(2)}.` };
  }
  return { ok: true as const, gastado, limite };
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function coincidenciasNombre(reportes: ReporteAlumno[], nombre: string | null): ReporteAlumno[] {
  if (!nombre) return reportes;
  const buscado = normalizar(nombre);
  return reportes.filter((reporte) => normalizar(reporte.nombre).includes(buscado));
}

export async function consultarConHerramientasVip({
  solicitud,
  usuarioId,
  supabase,
  reportes,
}: {
  solicitud: string;
  usuarioId: string;
  supabase: SupabaseServerClient;
  reportes: ReporteAlumno[];
}): Promise<{ respuesta: RespuestaIaVip | null; reporte: ReturnType<typeof construirReporteVip> | null; error: string | null }> {
  const presupuesto = await presupuestoDisponible(supabase);
  if (!presupuesto.ok) return { respuesta: null, reporte: null, error: presupuesto.mensaje };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { respuesta: null, reporte: null, error: "Falta configurar la clave de Anthropic para activar la IA." };

  const client = new Anthropic({ apiKey });
  try {
    const seleccion = await client.messages.parse({
      model: MODELO,
      max_tokens: 180,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(IntencionSchema) },
      messages: [{
        role: "user",
        content: `Clasifica esta solicitud del entrenador y elige exactamente una herramienta permitida.
Herramientas: atencion, nutricion, entrenamiento, progreso, noticia.
Extrae el nombre del alumno solo si la solicitud identifica uno. No respondas la pregunta.
Solicitud: ${solicitud}`,
      }],
    });
    const intencion = seleccion.parsed_output;
    if (!intencion) return { respuesta: null, reporte: null, error: "La IA no pudo identificar un reporte seguro." };

    const coincidencias = coincidenciasNombre(reportes, intencion.alumno);
    if (intencion.alumno && coincidencias.length === 0) {
      return { respuesta: null, reporte: null, error: `No encontramos un alumno que coincida con “${intencion.alumno}”.` };
    }
    if (intencion.alumno && coincidencias.length > 1) {
      const opciones = coincidencias.slice(0, 5).map((alumno) => alumno.nombre).join(", ");
      return { respuesta: null, reporte: null, error: `Hay más de una coincidencia: ${opciones}. Escribe el nombre completo.` };
    }

    const tipoReporte: TipoReporteVip = intencion.herramienta === "noticia" ? "atencion" : intencion.herramienta;
    const seleccionados = intencion.alumno ? coincidencias : reportes;
    const reporte = construirReporteVip(tipoReporte, seleccionados);
    const anonimos = reporte.alumnos.map((alumno, indice) => ({
      alias: `A${indice + 1}`,
      estado: alumno.estado,
      motivo: alumno.motivo,
      metricas: alumno.metricas,
    }));

    const redaccion = await client.messages.parse({
      model: MODELO,
      max_tokens: 650,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(RedaccionSchema) },
      messages: [{
        role: "user",
        content: `Eres el Asistente VIP de un entrenador. Redacta una respuesta breve y accionable usando únicamente el reporte anónimo.
No calcules cifras nuevas. No diagnostiques lesiones ni prescribas tratamientos. Si faltan datos, dilo.
No menciones nombres: Portal VIP mostrará las tarjetas identificadas al entrenador.
Solo crea el campo noticia cuando la herramienta sea "noticia"; debe ser positiva, verificable y quedar como borrador.
Solicitud original: ${solicitud}
Herramienta ejecutada: ${intencion.herramienta}
Periodo: ${reporte.periodo}
Total evaluado: ${reporte.totalEvaluados}
Resultados anónimos: ${JSON.stringify(anonimos)}`,
      }],
    });
    const salida = redaccion.parsed_output;
    if (!salida) return { respuesta: null, reporte, error: "La IA no produjo una respuesta válida." };

    const consumo: Consumo = {
      entrada: seleccion.usage.input_tokens + redaccion.usage.input_tokens,
      salida: seleccion.usage.output_tokens + redaccion.usage.output_tokens,
    };
    const costoUsd = costo(consumo);

    const { error: errorUso } = await supabase.from("asistente_uso_ia").insert({
      usuario_id: usuarioId,
      herramienta: intencion.herramienta,
      modelo: MODELO,
      tokens_entrada: consumo.entrada,
      tokens_salida: consumo.salida,
      costo_usd: costoUsd,
    });
    if (errorUso) return { respuesta: null, reporte, error: "La respuesta se calculó, pero no pudo auditarse; se ocultó por seguridad." };

    let borrador: RespuestaIaVip["borradorNoticia"] = null;
    if (intencion.herramienta === "noticia" && salida.noticia) {
      const { data, error } = await supabase
        .from("borradores_noticias")
        .insert({
          titulo: salida.noticia.titulo,
          mensaje: salida.noticia.mensaje,
          creado_por: usuarioId,
          generado_con_ia: true,
        })
        .select("id")
        .single();
      if (!error) borrador = { id: data.id, ...salida.noticia };
    }

    return {
      reporte,
      error: null,
      respuesta: {
        titulo: salida.titulo,
        resumen: salida.resumen,
        herramienta: intencion.herramienta,
        usoIA: true,
        costoUsd,
        aviso: `Datos calculados por Portal VIP · IA usada solo para interpretar y redactar · US$${costoUsd.toFixed(4)}`,
        borradorNoticia: borrador,
      },
    };
  } catch (error) {
    console.error("Asistente VIP:", error);
    return { respuesta: null, reporte: null, error: "La IA no está disponible ahora. Los cuatro reportes manuales siguen funcionando sin costo." };
  }
}

