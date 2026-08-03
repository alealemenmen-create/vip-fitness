import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { construirReporteVip } from "@/lib/asistente/reportes";
import { contarDatosCategoria } from "@/lib/asistente/eliminacion";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";
import {
  ETIQUETA_CATEGORIA_ELIMINACION,
  type CategoriaEliminacion,
  type RespuestaIaVip,
  type TipoReporteVip,
} from "@/lib/asistente/tipos";
import { hoyISO } from "@/lib/date";
import { createAdminClient } from "@/lib/supabase/admin";

const MODELO = "claude-sonnet-5";
const PRECIO_ENTRADA_MILLON = 3;
const PRECIO_SALIDA_MILLON = 15;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const IntencionSchema = z.object({
  herramienta: z.enum(["atencion", "nutricion", "entrenamiento", "progreso", "noticia", "eliminar_datos"]),
  alumno: z.string().trim().max(80).nullable(),
  /** Solo aplica cuando herramienta === "eliminar_datos". null si el pedido
   * no dejó en claro cuál de las 4 — nunca hay que adivinar acá: la app le
   * pide al entrenador que aclare. */
  categoriaEliminar: z.enum(["entrenamiento", "comida", "progreso", "ranking"]).nullable(),
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
Herramientas: atencion, nutricion, entrenamiento, progreso, noticia, eliminar_datos.
"eliminar_datos" es SOLO cuando el entrenador pide explícitamente borrar/eliminar datos guardados de
un alumno (ej. "borra el historial de entrenamiento de Fulano", "elimina sus registros de comida").
Para "eliminar_datos" también extrae categoriaEliminar, una de: entrenamiento, comida, progreso, ranking.
"historial de entrenamiento" o "historial" junto a la palabra entrenamiento = categoría "entrenamiento".
Si no queda claro CUÁL de las 4 categorías (por ejemplo solo dice "borra su historial" sin más
contexto), dejá categoriaEliminar en null — NUNCA elijas una categoría al azar, la app le va a pedir
al entrenador que aclare. Para las demás herramientas, categoriaEliminar siempre va null.
Extrae el nombre del alumno solo si la solicitud identifica uno. No respondas la pregunta.
Solicitud: ${solicitud}`,
      }],
    });
    const intencion = seleccion.parsed_output;
    if (!intencion) return { respuesta: null, reporte: null, error: "La IA no pudo identificar un reporte seguro." };

    if (intencion.herramienta === "eliminar_datos" && !intencion.alumno) {
      return { respuesta: null, reporte: null, error: "Decime el nombre del alumno para poder borrar sus datos." };
    }

    const coincidencias = coincidenciasNombre(reportes, intencion.alumno);
    if (intencion.alumno && coincidencias.length === 0) {
      return { respuesta: null, reporte: null, error: `No encontramos un alumno que coincida con “${intencion.alumno}”.` };
    }
    if (intencion.alumno && coincidencias.length > 1) {
      const opciones = coincidencias.slice(0, 5).map((alumno) => alumno.nombre).join(", ");
      return { respuesta: null, reporte: null, error: `Hay más de una coincidencia: ${opciones}. Escribe el nombre completo.` };
    }

    // "eliminar_datos" no arma reporte ni pasa por la segunda llamada de
    // redacción: es determinístico (conteo real de tablas) y la IA NUNCA
    // borra nada acá — solo arma la propuesta. Confirmar es una acción
    // humana aparte (ver confirmarEliminacionDatos en admin/asistente/actions.ts).
    if (intencion.herramienta === "eliminar_datos") {
      if (!intencion.categoriaEliminar) {
        const nombreAlumno = coincidencias[0]?.nombre ?? intencion.alumno;
        return {
          respuesta: null,
          reporte: null,
          error: `¿Qué querés borrar de ${nombreAlumno}? Decime: entrenamiento, comida, progreso o ranking.`,
        };
      }

      const categoria: CategoriaEliminacion = intencion.categoriaEliminar;
      const alumnoObjetivo = coincidencias[0];
      const admin = createAdminClient();
      const resumen = await contarDatosCategoria(admin, alumnoObjetivo.alumnoId, categoria);
      const totalFilas = resumen.reduce((total, fila) => total + fila.cantidad, 0);

      const consumoSolo: Consumo = {
        entrada: seleccion.usage.input_tokens,
        salida: seleccion.usage.output_tokens,
      };
      const costoUsdSolo = costo(consumoSolo);
      const { error: errorUsoEliminar } = await supabase.from("asistente_uso_ia").insert({
        usuario_id: usuarioId,
        herramienta: "eliminar_datos",
        modelo: MODELO,
        tokens_entrada: consumoSolo.entrada,
        tokens_salida: consumoSolo.salida,
        costo_usd: costoUsdSolo,
      });
      if (errorUsoEliminar) {
        return { respuesta: null, reporte: null, error: "No se pudo auditar el uso de IA; se canceló por seguridad." };
      }

      if (totalFilas === 0) {
        return {
          reporte: null,
          error: null,
          respuesta: {
            titulo: "No hay nada que borrar",
            resumen: `${alumnoObjetivo.nombre} no tiene datos de ${ETIQUETA_CATEGORIA_ELIMINACION[categoria].toLowerCase()} registrados.`,
            herramienta: "eliminar_datos",
            usoIA: true,
            costoUsd: costoUsdSolo,
            aviso: "No se creó ninguna solicitud de borrado porque no hay datos en esa categoría.",
            borradorNoticia: null,
            solicitudEliminacion: null,
          },
        };
      }

      const { data: solicitud, error: errorSolicitud } = await supabase
        .from("solicitudes_eliminacion_datos")
        .insert({
          alumno_id: alumnoObjetivo.alumnoId,
          categoria,
          resumen,
          creado_por: usuarioId,
          generado_con_ia: true,
        })
        .select("id")
        .single();
      if (errorSolicitud || !solicitud) {
        return {
          respuesta: null,
          reporte: null,
          error: "No fue posible preparar la solicitud de borrado. ¿Corriste la migración 0041?",
        };
      }

      return {
        reporte: null,
        error: null,
        respuesta: {
          titulo: "Solicitud de borrado lista para confirmar",
          resumen: `${alumnoObjetivo.nombre} · ${ETIQUETA_CATEGORIA_ELIMINACION[categoria]}`,
          herramienta: "eliminar_datos",
          usoIA: true,
          costoUsd: costoUsdSolo,
          aviso: "Esto todavía NO borró nada. Hay que confirmarlo abajo, aparte de este mensaje.",
          borradorNoticia: null,
          solicitudEliminacion: {
            id: solicitud.id,
            alumnoId: alumnoObjetivo.alumnoId,
            alumnoNombre: alumnoObjetivo.nombre,
            categoria,
            resumen,
          },
        },
      };
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
        // El costo NO va acá: iba mezclado en esta misma frase y quedaba
        // fácil de pasar por alto. Ahora tiene su propia línea abajo
        // (ver AsistenteVipPanel), separada y visible.
        aviso: "Datos calculados por Portal VIP · IA usada solo para interpretar y redactar.",
        borradorNoticia: borrador,
        solicitudEliminacion: null,
      },
    };
  } catch (error) {
    console.error("Asistente VIP:", error);
    return { respuesta: null, reporte: null, error: "La IA no está disponible ahora. Los cuatro reportes manuales siguen funcionando sin costo." };
  }
}

