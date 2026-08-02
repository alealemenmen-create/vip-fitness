import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ReporteAlumno } from "@/app/admin/alumnos/data";
import type { FilaRanking } from "@/lib/ranking/data";

const MODELO_ASISTENTE = "claude-sonnet-5";

export type HallazgoAsistente = {
  alumnoId: string | null;
  nombre: string | null;
  prioridad: "alta" | "media" | "positiva";
  detalle: string;
};

export type PropuestaRetoIA = {
  nombre: string;
  descripcion: string;
  reglaPublica: string;
  razon: string;
  modalidad: "duelo";
  metrica: "progreso_vip";
  puntosEnJuego: number;
  alumnoIds: [string, string];
  alumnos: [string, string];
};

export type BorradorNoticiaIA = {
  titulo: string;
  mensaje: string;
};

export type RespuestaAsistenteVip = {
  ok: boolean;
  titulo: string;
  resumen: string;
  hallazgos: HallazgoAsistente[];
  propuestaReto: PropuestaRetoIA | null;
  borradorNoticia: BorradorNoticiaIA | null;
  usoIA: boolean;
  aviso: string | null;
};

const RespuestaSchema = z.object({
  titulo: z.string().min(4).max(80),
  resumen: z.string().min(20).max(650),
  hallazgos: z
    .array(
      z.object({
        alumnoAlias: z.string().nullable(),
        prioridad: z.enum(["alta", "media", "positiva"]),
        detalle: z.string().min(10).max(220),
      })
    )
    .max(8),
  reto: z
    .object({
      nombre: z.string().min(5).max(70),
      descripcion: z.string().min(12).max(240),
      reglaPublica: z.string().min(20).max(300),
      razon: z.string().min(12).max(220),
    })
    .nullable(),
  noticia: z
    .object({
      titulo: z.string().min(5).max(90),
      mensaje: z.string().min(20).max(500),
    })
    .nullable(),
});

type AlumnoAnonimo = {
  alias: string;
  alumnoId: string;
  nombre: string;
  estado: ReporteAlumno["estado"];
  datos: {
    sesiones: string;
    diasSinEntrenar: number | null;
    diasConComida: number;
    kcalPromedio: number | null;
    kcalObjetivo: number | null;
    variacionPeso30d: number | null;
    energiaPromedio: number | null;
    diasConSeguimiento: number;
    molestiasReportadas: boolean;
    puntosSemana: number;
  };
};

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function intencionDe(solicitud: string) {
  const texto = normalizar(solicitud);
  return {
    nutricion: /nutric|comida|caloria|aliment/.test(texto),
    entrenamiento: /entren|rutina|sesion|ejercicio/.test(texto),
    progreso: /progreso|peso|foto|seguimiento/.test(texto),
    noticia: /noticia|anuncio|public/.test(texto),
    reto: /reto|duelo|desafio|compet/.test(texto),
  };
}

function anonimizar(reportes: ReporteAlumno[], ranking: FilaRanking[]): AlumnoAnonimo[] {
  const puntos = new Map(ranking.map((fila) => [fila.alumnoId, fila.puntos]));
  return reportes.map((reporte, indice) => ({
    alias: `A${indice + 1}`,
    alumnoId: reporte.alumnoId,
    nombre: reporte.nombre,
    estado: reporte.estado,
    datos: {
      sesiones: `${reporte.sesionesHechas}/${reporte.sesionesAsignadas} (${reporte.pctSesiones}%)`,
      diasSinEntrenar: reporte.diasSinEntrenar,
      diasConComida: reporte.diasConComida,
      kcalPromedio: reporte.kcalPromedio,
      kcalObjetivo: reporte.kcalObjetivo,
      variacionPeso30d: reporte.pesoVariacion,
      energiaPromedio: reporte.energiaPromedio,
      diasConSeguimiento: reporte.diasConSeguimiento,
      molestiasReportadas: reporte.molestias.length > 0,
      puntosSemana: puntos.get(reporte.alumnoId) ?? 0,
    },
  }));
}

function elegirDuelo(alumnos: AlumnoAnonimo[]): [AlumnoAnonimo, AlumnoAnonimo] | null {
  const elegibles = alumnos
    .filter(
      (alumno) =>
        alumno.estado !== "atencion" &&
        alumno.datos.puntosSemana > 0 &&
        !alumno.datos.molestiasReportadas
    )
    .sort((a, b) => b.datos.puntosSemana - a.datos.puntosSemana);
  if (elegibles.length < 2) return null;

  let mejor: [AlumnoAnonimo, AlumnoAnonimo] = [elegibles[0], elegibles[1]];
  let diferencia = Math.abs(
    elegibles[0].datos.puntosSemana - elegibles[1].datos.puntosSemana
  );
  for (let i = 0; i < elegibles.length; i += 1) {
    for (let j = i + 1; j < elegibles.length; j += 1) {
      const actual = Math.abs(
        elegibles[i].datos.puntosSemana - elegibles[j].datos.puntosSemana
      );
      if (actual < diferencia) {
        mejor = [elegibles[i], elegibles[j]];
        diferencia = actual;
      }
    }
  }
  return mejor;
}

function hallazgosDeRespaldo(alumnos: AlumnoAnonimo[]): HallazgoAsistente[] {
  const requierenAtencion = alumnos
    .filter((alumno) => alumno.estado === "atencion")
    .slice(0, 5)
    .map((alumno) => ({
      alumnoId: alumno.alumnoId,
      nombre: alumno.nombre,
      prioridad: "alta" as const,
      detalle:
        alumno.datos.diasSinEntrenar === null
          ? "Todavía no registra entrenamientos; conviene revisar su inicio de plan."
          : `Lleva ${alumno.datos.diasSinEntrenar} días sin entrenar y registra comidas ${alumno.datos.diasConComida}/7 días.`,
    }));
  const destacados = alumnos
    .filter((alumno) => alumno.estado === "destacado")
    .slice(0, 2)
    .map((alumno) => ({
      alumnoId: alumno.alumnoId,
      nombre: alumno.nombre,
      prioridad: "positiva" as const,
      detalle: `Mantiene ${alumno.datos.sesiones} sesiones y ${alumno.datos.diasConComida}/7 días con comidas registradas.`,
    }));
  return [...requierenAtencion, ...destacados];
}

function retoDeRespaldo(
  pareja: [AlumnoAnonimo, AlumnoAnonimo] | null
): PropuestaRetoIA | null {
  if (!pareja) return null;
  return {
    nombre: "Duelo de Constancia VIP",
    descripcion: "Una competencia corta y equilibrada basada en acciones verificadas por la aplicación.",
    reglaPublica:
      "Gana quien obtenga más Puntos VIP durante el periodo. Solo cuentan entrenamientos finalizados, alimentación cerrada y registros de progreso verificados.",
    razon: `Se eligió una pareja con rendimiento semanal similar para evitar una ventaja evidente.`,
    modalidad: "duelo",
    metrica: "progreso_vip",
    puntosEnJuego: 500,
    alumnoIds: [pareja[0].alumnoId, pareja[1].alumnoId],
    alumnos: [pareja[0].nombre, pareja[1].nombre],
  };
}

function respuestaDeRespaldo(
  solicitud: string,
  alumnos: AlumnoAnonimo[]
): RespuestaAsistenteVip {
  const intencion = intencionDe(solicitud);
  const pareja = intencion.reto ? elegirDuelo(alumnos) : null;
  const hallazgos = hallazgosDeRespaldo(alumnos);
  const aRevisar = alumnos.filter((alumno) => alumno.estado === "atencion").length;
  const destacados = alumnos.filter((alumno) => alumno.estado === "destacado").length;
  const mejor = [...alumnos].sort(
    (a, b) => b.datos.puntosSemana - a.datos.puntosSemana
  )[0];

  return {
    ok: true,
    titulo: intencion.reto ? "Propuesta de reto equilibrado" : "Resumen del equipo",
    resumen: `Revisé ${alumnos.length} alumnos con datos verificados: ${aRevisar} necesitan atención y ${destacados} muestran un rendimiento destacado. Los datos insuficientes se mantienen como pendientes, sin suposiciones.`,
    hallazgos,
    propuestaReto: retoDeRespaldo(pareja),
    borradorNoticia:
      intencion.noticia && mejor
        ? {
            titulo: "La constancia marca la diferencia",
            mensaje: `${mejor.nombre} lidera el progreso semanal con ${mejor.datos.puntosSemana.toLocaleString("es-CL")} Puntos VIP. Felicitaciones por mantener un trabajo integral y verificable.`,
          }
        : null,
    usoIA: false,
    aviso:
      "Respuesta calculada por la aplicación. La redacción con IA no estuvo disponible, pero los indicadores siguen siendo reales.",
  };
}

export async function generarRespuestaAsistente(
  solicitud: string,
  reportes: ReporteAlumno[],
  ranking: FilaRanking[]
): Promise<RespuestaAsistenteVip> {
  const alumnos = anonimizar(reportes, ranking);
  if (alumnos.length === 0) {
    return {
      ok: false,
      titulo: "Sin datos para analizar",
      resumen: "Todavía no hay alumnos disponibles para preparar este reporte.",
      hallazgos: [],
      propuestaReto: null,
      borradorNoticia: null,
      usoIA: false,
      aviso: null,
    };
  }

  const respaldo = respuestaDeRespaldo(solicitud, alumnos);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return respaldo;

  const intencion = intencionDe(solicitud);
  const pareja = intencion.reto ? elegirDuelo(alumnos) : null;
  const mapaAlias = new Map(alumnos.map((alumno) => [alumno.alias, alumno]));
  const datosIA = [
    ...alumnos.filter((alumno) => alumno.estado === "atencion").slice(0, 20),
    ...alumnos.filter((alumno) => alumno.estado === "destacado").slice(0, 10),
    ...alumnos.filter((alumno) => alumno.estado === "normal").slice(0, 10),
  ].map(({ alias, estado, datos }) => ({ alias, estado, ...datos }));

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: MODELO_ASISTENTE,
      max_tokens: 1800,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(RespuestaSchema) },
      messages: [
        {
          role: "user",
          content: `Eres el Asistente VIP para el entrenador de un gimnasio chileno.

Solicitud: ${solicitud}

Límites:
- Usa únicamente los datos entregados. Si falta un dato, dilo; no lo inventes.
- No diagnostiques, no prescribas tratamientos y no juzgues cuerpos ni alimentos.
- Las molestias solo sirven para recomendar revisión humana, nunca para crear retos.
- Prioriza acciones concretas y explica cada conclusión con su indicador.
- Devuelve alias, nunca nombres.
- Crea noticia solo si la solicitud lo pide.
- Crea reto solo si la solicitud lo pide y existe una pareja preseleccionada.
- El reto debe medir Puntos VIP verificados, durar pocos días y no castigar a quien pierda.
- La IA propone; el entrenador revisa y publica.

Pareja segura preseleccionada: ${
            pareja
              ? `${pareja[0].alias} (${pareja[0].datos.puntosSemana}) vs ${pareja[1].alias} (${pareja[1].datos.puntosSemana})`
              : "ninguna"
          }

Resumen completo: ${alumnos.length} alumnos; ${alumnos.filter((alumno) => alumno.estado === "atencion").length} requieren atención; ${alumnos.filter((alumno) => alumno.estado === "destacado").length} destacados.
Datos anónimos priorizados para redactar (${datosIA.length}):
${JSON.stringify(datosIA)}`,
        },
      ],
    });

    const salida = response.parsed_output;
    if (!salida) return respaldo;

    const hallazgos = salida.hallazgos.reduce<HallazgoAsistente[]>((lista, hallazgo) => {
      if (hallazgo.alumnoAlias === null) {
        lista.push({ alumnoId: null, nombre: null, prioridad: hallazgo.prioridad, detalle: hallazgo.detalle });
        return lista;
      }
      const alumno = mapaAlias.get(hallazgo.alumnoAlias);
      if (alumno) {
        lista.push({
          alumnoId: alumno.alumnoId,
          nombre: alumno.nombre,
          prioridad: hallazgo.prioridad,
          detalle: hallazgo.detalle,
        });
      }
      return lista;
    }, []);

    const propuestaReto =
      salida.reto && pareja
        ? {
            ...salida.reto,
            modalidad: "duelo" as const,
            metrica: "progreso_vip" as const,
            puntosEnJuego: 500,
            alumnoIds: [pareja[0].alumnoId, pareja[1].alumnoId] as [string, string],
            alumnos: [pareja[0].nombre, pareja[1].nombre] as [string, string],
          }
        : null;

    return {
      ok: true,
      titulo: salida.titulo,
      resumen: salida.resumen,
      hallazgos,
      propuestaReto,
      borradorNoticia: salida.noticia,
      usoIA: true,
      aviso: "La IA redactó el análisis; las cifras y la selección de alumnos fueron calculadas por VIP.",
    };
  } catch (error) {
    console.error("asistenteVip IA:", error);
    return respaldo;
  }
}
