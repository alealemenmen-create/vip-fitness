import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerRankingSemanal } from "@/lib/ranking/data";
import { semanaAnteriorLunesISO } from "@/lib/date";
import type {
  CategoriaReconocimiento,
  DesgloseSemanaJSON,
} from "@/lib/supabase/types";

const MODELO_RECONOCIMIENTOS = "claude-sonnet-5";

export type ConfiguracionReconocimientos = {
  activos: boolean;
  maxPorSemana: number;
  minPuntaje: number;
  incluirEntrenamiento: boolean;
  incluirAlimentacion: boolean;
  incluirRanking: boolean;
  incluirConstancia: boolean;
};

export type ResultadoGeneracionReconocimientos = {
  ok: boolean;
  semanaInicio: string;
  publicados: number;
  omitidos: number;
  usoIA: boolean;
  mensaje: string;
};

type Candidato = {
  alias: string;
  alumnoId: string;
  nombre: string;
  categoria: CategoriaReconocimiento;
  puntaje: number;
  metricas: Record<string, number>;
};

type Redaccion = {
  candidatoId: string;
  categoria: CategoriaReconocimiento;
  titulo: string;
  mensaje: string;
};

const RedaccionesSchema = z.object({
  reconocimientos: z
    .array(
      z.object({
        candidatoId: z.string(),
        categoria: z.enum(["entrenamiento", "alimentacion", "ranking", "constancia"]),
        titulo: z.string().min(4).max(70),
        mensaje: z.string().min(20).max(220),
      })
    )
    .max(5),
});

const CONFIG_DEFAULT: ConfiguracionReconocimientos = {
  activos: true,
  maxPorSemana: 3,
  minPuntaje: 55,
  incluirEntrenamiento: true,
  incluirAlimentacion: true,
  incluirRanking: true,
  incluirConstancia: true,
};

export async function obtenerConfiguracionReconocimientos(): Promise<ConfiguracionReconocimientos> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("configuracion_gimnasio")
    .select(
      "reconocimientos_activos, max_reconocimientos_semana, min_puntaje_reconocimiento, incluir_entrenamiento, incluir_alimentacion, incluir_ranking, incluir_constancia"
    )
    .eq("id", true)
    .maybeSingle();

  // Permite desplegar el código antes de correr la migración 0020.
  if (error || !data) return CONFIG_DEFAULT;

  return {
    activos: data.reconocimientos_activos,
    maxPorSemana: data.max_reconocimientos_semana,
    minPuntaje: data.min_puntaje_reconocimiento,
    incluirEntrenamiento: data.incluir_entrenamiento,
    incluirAlimentacion: data.incluir_alimentacion,
    incluirRanking: data.incluir_ranking,
    incluirConstancia: data.incluir_constancia,
  };
}

function categoriaHabilitada(
  categoria: CategoriaReconocimiento,
  config: ConfiguracionReconocimientos
): boolean {
  if (categoria === "entrenamiento") return config.incluirEntrenamiento;
  if (categoria === "alimentacion") return config.incluirAlimentacion;
  if (categoria === "ranking") return config.incluirRanking;
  return config.incluirConstancia;
}

function valorCategoria(
  desglose: DesgloseSemanaJSON,
  categoria: CategoriaReconocimiento
): number {
  if (categoria === "entrenamiento") return Math.max(0, desglose.asistencia);
  if (categoria === "alimentacion") return Math.max(0, desglose.alimentacion);
  if (categoria === "constancia") return Math.max(0, desglose.app);
  return Math.max(0, desglose.total);
}

function candidatosDesdeSemanas(
  actuales: Array<{
    alumno_id: string;
    puntos: number;
    desglose: DesgloseSemanaJSON;
    perfiles: { nombre: string } | null;
  }>,
  anteriores: Map<string, DesgloseSemanaJSON>,
  config: ConfiguracionReconocimientos
): Candidato[] {
  const todasLasCategorias: CategoriaReconocimiento[] = [
    "entrenamiento",
    "alimentacion",
    "constancia",
    "ranking",
  ];
  const categorias = todasLasCategorias.filter((categoria) =>
    categoriaHabilitada(categoria, config)
  );

  const maximos = new Map<CategoriaReconocimiento, number>();
  for (const categoria of categorias) {
    maximos.set(
      categoria,
      Math.max(1, ...actuales.map((fila) => valorCategoria(fila.desglose, categoria)))
    );
  }

  const ordenTotal = [...actuales]
    .sort((a, b) => b.puntos - a.puntos)
    .map((fila) => fila.alumno_id);

  const candidatos = actuales
    .filter((fila) => fila.puntos > 0 && fila.perfiles?.nombre)
    .map((fila) => {
      const previo = anteriores.get(fila.alumno_id);
      const opciones = categorias.map((categoria) => {
        const actual = valorCategoria(fila.desglose, categoria);
        const anterior = previo ? valorCategoria(previo, categoria) : 0;
        const maximo = maximos.get(categoria) ?? 1;
        const rendimiento = Math.min(65, Math.round((actual / maximo) * 65));
        const mejora =
          anterior <= 0
            ? actual > 0
              ? 12
              : 0
            : Math.max(0, Math.min(20, Math.round(((actual - anterior) / anterior) * 20)));
        const posicion = ordenTotal.indexOf(fila.alumno_id);
        const aporteRanking =
          categoria === "ranking" ? Math.max(0, 15 - posicion * 4) : Math.min(15, fila.puntos > 0 ? 8 : 0);
        return {
          categoria,
          puntaje: Math.max(0, Math.min(100, rendimiento + mejora + aporteRanking)),
          actual,
          anterior,
        };
      });

      opciones.sort((a, b) => b.puntaje - a.puntaje);
      const mejor = opciones[0];
      return {
        alias: "",
        alumnoId: fila.alumno_id,
        nombre: fila.perfiles!.nombre,
        categoria: mejor.categoria,
        puntaje: mejor.puntaje,
        metricas: {
          puntosSemana: fila.puntos,
          valorCategoria: mejor.actual,
          valorSemanaAnterior: mejor.anterior,
        },
      };
    })
    .filter((candidato) => candidato.puntaje >= config.minPuntaje)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, 12);

  return candidatos.map((candidato, indice) => ({
    ...candidato,
    alias: `C${indice + 1}`,
  }));
}

function redaccionesDeRespaldo(candidatos: Candidato[], maximo: number): Redaccion[] {
  const textos: Record<
    CategoriaReconocimiento,
    { titulo: string; mensaje: string }
  > = {
    entrenamiento: {
      titulo: "Una semana de entrenamiento que inspira",
      mensaje:
        "Su compromiso con cada sesión destacó esta semana. La constancia se construye paso a paso, y este avance merece reconocimiento.",
    },
    alimentacion: {
      titulo: "Constancia con su plan de alimentación",
      mensaje:
        "Mantuvo un seguimiento responsable y sostenido de su plan. Ese cuidado diario también forma parte de un gran progreso.",
    },
    ranking: {
      titulo: "Protagonista de la semana VIP",
      mensaje:
        "Su rendimiento integral estuvo entre los más destacados. Disciplina, equilibrio y continuidad hicieron la diferencia.",
    },
    constancia: {
      titulo: "La constancia también es una victoria",
      mensaje:
        "Se mantuvo presente y comprometido durante la semana. Los resultados duraderos nacen justamente de esa continuidad.",
    },
  };

  return candidatos.slice(0, maximo).map((candidato) => ({
    candidatoId: candidato.alias,
    categoria: candidato.categoria,
    ...textos[candidato.categoria],
  }));
}

async function redactarConIA(
  candidatos: Candidato[],
  maximo: number
): Promise<{ redacciones: Redaccion[]; usoIA: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { redacciones: redaccionesDeRespaldo(candidatos, maximo), usoIA: false };
  }

  const datosAnonimos = candidatos.map((candidato) => ({
    candidatoId: candidato.alias,
    categoriaSugerida: candidato.categoria,
    puntajeMerito: candidato.puntaje,
    indicadores: candidato.metricas,
  }));

  const client = new Anthropic({ apiKey });
  try {
    const response = await client.messages.parse({
      model: MODELO_RECONOCIMIENTOS,
      max_tokens: 1200,
      thinking: { type: "disabled" },
      output_config: { format: zodOutputFormat(RedaccionesSchema) },
      messages: [
        {
          role: "user",
          content: `Actúas como editor de noticias positivas para un gimnasio chileno.
Selecciona hasta ${maximo} personas con mérito real de la lista anónima.

Reglas:
- Puedes elegir menos personas si los méritos no son suficientemente claros.
- Evita repetir la misma categoría cuando existan alternativas comparables.
- Redacta en español natural, cálido y profesional.
- No inventes cifras, lesiones, peso, calorías, diagnósticos ni objetivos.
- No incluyas nombres: solo devuelve candidatoId.
- No compares negativamente a nadie ni menciones quién quedó último.
- El título y el mensaje deben poder publicarse delante de todos los alumnos.

Candidatos:
${JSON.stringify(datosAnonimos)}`,
        },
      ],
    });

    const permitidos = new Map(candidatos.map((candidato) => [candidato.alias, candidato]));
    const usados = new Set<string>();
    const validas = (response.parsed_output?.reconocimientos ?? [])
      .filter((redaccion) => {
        const candidato = permitidos.get(redaccion.candidatoId);
        if (
          !candidato ||
          usados.has(redaccion.candidatoId) ||
          redaccion.categoria !== candidato.categoria
        ) {
          return false;
        }
        usados.add(redaccion.candidatoId);
        return true;
      })
      .slice(0, maximo);

    if (validas.length === 0) {
      return { redacciones: redaccionesDeRespaldo(candidatos, maximo), usoIA: false };
    }
    return { redacciones: validas, usoIA: true };
  } catch (error) {
    console.error("reconocimientosSemanales IA:", error);
    return { redacciones: redaccionesDeRespaldo(candidatos, maximo), usoIA: false };
  }
}

export async function generarReconocimientosSemanales(
  forzar = false
): Promise<ResultadoGeneracionReconocimientos> {
  const semanaInicio = semanaAnteriorLunesISO();
  const config = await obtenerConfiguracionReconocimientos();
  if (!config.activos && !forzar) {
    return {
      ok: true,
      semanaInicio,
      publicados: 0,
      omitidos: 0,
      usoIA: false,
      mensaje: "Los reconocimientos automáticos están pausados.",
    };
  }

  // Cierra primero las semanas pendientes usando la misma fuente del ranking.
  await obtenerRankingSemanal();

  const admin = createAdminClient();
  const semanaPrevia = new Date(`${semanaInicio}T12:00:00Z`);
  semanaPrevia.setUTCDate(semanaPrevia.getUTCDate() - 7);
  const semanaPreviaISO = semanaPrevia.toISOString().slice(0, 10);

  const [{ data: existentes }, { data: filasActuales }, { data: filasAnteriores }] =
    await Promise.all([
      admin
        .from("reconocimientos_semanales")
        .select("alumno_id")
        .eq("semana_inicio", semanaInicio),
      admin
        .from("ranking_semanas")
        .select(
          "alumno_id, puntos, desglose, perfiles!ranking_semanas_alumno_id_fkey(nombre)"
        )
        .eq("semana_inicio", semanaInicio),
      admin
        .from("ranking_semanas")
        .select("alumno_id, desglose")
        .eq("semana_inicio", semanaPreviaISO),
    ]);

  const yaPublicados = new Set((existentes ?? []).map((fila) => fila.alumno_id));
  const anteriores = new Map(
    (filasAnteriores ?? []).map((fila) => [fila.alumno_id, fila.desglose])
  );
  const candidatos = candidatosDesdeSemanas(
    (filasActuales ?? []).map((fila) => ({
      alumno_id: fila.alumno_id,
      puntos: fila.puntos,
      desglose: fila.desglose,
      perfiles: fila.perfiles as unknown as { nombre: string } | null,
    })),
    anteriores,
    config
  ).filter((candidato) => !yaPublicados.has(candidato.alumnoId));

  if (candidatos.length === 0) {
    return {
      ok: true,
      semanaInicio,
      publicados: 0,
      omitidos: yaPublicados.size,
      usoIA: false,
      mensaje:
        yaPublicados.size > 0
          ? "Los reconocimientos de esa semana ya estaban publicados."
          : "Esta semana todavía no hay méritos suficientes para publicar.",
    };
  }

  const { redacciones, usoIA } = await redactarConIA(candidatos, config.maxPorSemana);
  const candidatoPorAlias = new Map(candidatos.map((candidato) => [candidato.alias, candidato]));
  const filas = redacciones
    .map((redaccion) => {
      const candidato = candidatoPorAlias.get(redaccion.candidatoId);
      if (!candidato) return null;
      return {
        semana_inicio: semanaInicio,
        alumno_id: candidato.alumnoId,
        categoria: redaccion.categoria,
        titulo: redaccion.titulo,
        mensaje: redaccion.mensaje,
        puntaje: candidato.puntaje,
        metricas: candidato.metricas,
        generado_con_ia: usoIA,
        modelo: usoIA ? MODELO_RECONOCIMIENTOS : null,
      };
    })
    .filter((fila): fila is NonNullable<typeof fila> => fila !== null);

  const { error } = await admin
    .from("reconocimientos_semanales")
    .upsert(filas, { onConflict: "semana_inicio,alumno_id", ignoreDuplicates: true });

  if (error) {
    return {
      ok: false,
      semanaInicio,
      publicados: 0,
      omitidos: 0,
      usoIA,
      mensaje:
        "No se pudieron guardar los reconocimientos. Verifica que la migración 0020 esté aplicada.",
    };
  }

  return {
    ok: true,
    semanaInicio,
    publicados: filas.length,
    omitidos: Math.max(0, candidatos.length - filas.length),
    usoIA,
    mensaje:
      filas.length > 0
        ? `Se publicaron ${filas.length} reconocimientos semanales.`
        : "La IA decidió no publicar reconocimientos esta semana.",
  };
}
