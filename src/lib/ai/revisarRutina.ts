import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import { serializarRutinaATexto } from "@/lib/generador-rutinas/serializar";
import { describirInventario } from "@/lib/gimnasio/inventario";
import { METODO_VIP_PARA_AUDITORIA } from "@/lib/generador-rutinas/metodo-vip";
import type {
  BriefGenerador,
  EjercicioGenerador,
  PerfilEntrenamiento,
} from "@/lib/generador-rutinas/tipos";

/** Segunda opinión sobre la rutina que ya armó el motor de reglas.
 *
 * El motor sigue siendo la única fuente que ELIGE los ejercicios: es
 * determinista, respeta cupos por grupo y solo usa la biblioteca real. Lo que
 * el motor no puede hacer es leer texto libre — "molestia en la rodilla
 * derecha al bajar escaleras", "operada de hombro hace 8 meses", "odio el
 * peso muerto" — y cruzarlo con los ejercicios concretos que quedaron en la
 * semana. Eso es lo que revisa esta capa: no genera la rutina, la audita y
 * propone cambios puntuales que el entrenador aprueba uno por uno.
 *
 * Por eso nunca devuelve una rutina completa: devuelve un veredicto, hallazgos
 * y una lista de cambios acotados. Si la IA falla o no está configurada, el
 * borrador se publica igual — la revisión es un plus, no un requisito. */

const CambioSchema = z.object({
  dia: z.number(),
  orden: z.number(),
  ejercicioActual: z.string(),
  accion: z.enum(["reemplazar", "quitar", "ajustar"]),
  /** Nombre EXACTO de un ejercicio del catálogo entregado. El servidor lo
   * resuelve a un id real; si no calza con ninguno, el cambio se muestra
   * como sugerencia pero no se puede aplicar de un clic. */
  reemplazoNombre: z.string().nullable(),
  series: z.number().nullable(),
  reps: z.string().nullable(),
  descansoSegundos: z.number().nullable(),
  tecnicaTipo: z.string().nullable(),
  tecnicaInstruccion: z.string().nullable(),
  motivo: z.string(),
});

const HallazgoSchema = z.object({
  categoria: z.enum(["seguridad", "objetivo", "volumen", "variedad", "tecnica", "otro"]),
  gravedad: z.enum(["alta", "media", "baja"]),
  detalle: z.string(),
});

const RevisionSchema = z.object({
  veredicto: z.enum(["aprobada", "ajustes_sugeridos", "revisar_con_cuidado"]),
  resumen: z.string(),
  hallazgos: z.array(HallazgoSchema),
  cambios: z.array(CambioSchema),
});

export type RevisionRutina = z.infer<typeof RevisionSchema>;
export type CambioSugerido = z.infer<typeof CambioSchema>;
export type HallazgoRevision = z.infer<typeof HallazgoSchema>;

/** Un cambio ya cruzado contra la biblioteca real: `ejercicioId` viene del
 * catálogo del gimnasio, no del modelo. */
export type CambioResuelto = CambioSugerido & {
  ejercicioId: string | null;
  grupoMuscular: EjercicioGenerador["grupoMuscular"] | null;
  /** false cuando pidió reemplazar por un ejercicio que no existe en la
   * biblioteca, o cuando apunta a un día/orden que no está en el borrador. */
  aplicable: boolean;
};

export type RevisionResuelta = Omit<RevisionRutina, "cambios"> & {
  cambios: CambioResuelto[];
  revisadaEn: string;
};

export type RevisionResultado =
  | { ok: true; revision: RevisionResuelta }
  | { ok: false; error: string };

const SISTEMA = `Eres el segundo par de ojos de un entrenador personal chileno con años de experiencia en gimnasio y culturismo. Recibes una rutina que ya generó su sistema de reglas y la auditas antes de que se publique al alumno.

No aplicas un criterio genérico de internet. Auditas con este método concreto:

${METODO_VIP_PARA_AUDITORIA}

Tu trabajo es detectar lo que un sistema automático no puede ver: el cruce entre los ejercicios concretos de la semana y lo que la persona escribió en su ficha con sus propias palabras (molestias, lesiones, operaciones, condiciones médicas, medicamentos, ejercicios que no quiere hacer).

Cómo trabajas:
- Priorizas la seguridad de la persona por sobre la prolijidad del programa. Una molestia de rodilla y una sentadilla profunda en la misma semana es un hallazgo, aunque el resto de la rutina esté impecable.
- Eres concreto: en vez de "cuidado con el hombro", dices qué ejercicio del día 2 es el problema y por cuál conviene cambiarlo.
- No diagnosticas ni recomiendas tratamientos, medicamentos, dosis ni sustancias. Si algo excede lo que se resuelve ajustando ejercicios (dolor agudo, operación reciente sin alta, síntomas cardíacos), lo marcas con gravedad alta y dices que corresponde derivar a un profesional de la salud antes de entrenar eso.
- Si la rutina está bien, lo dices sin inventar problemas. Un veredicto "aprobada" con cambios vacíos es una respuesta correcta y esperada.
- Revisa la semana completa antes de mirar cambios aislados: frecuencia por grupo,
  balance bíceps/tríceps, volumen directo, orden, recuperación y dosis de técnicas.
- No elimines intensidad solo por prudencia genérica. Si el perfil es avanzado y
  la ejecución es estable, la exigencia y cercanía al fallo son parte del método.
- Escribes en español de Chile, tuteando, directo y breve. Sin relleno ni disclaimers largos.

NORMA OBLIGATORIA — el catálogo es el gimnasio:
El catálogo que te entregan no es una sugerencia ni una lista de ejemplos: es el inventario real de VIP Fitness. Si una máquina o un ejercicio no está ahí, en el gimnasio no existe. No hay caminadora, trotadora, elíptica ni escaladora porque no están en el catálogo; sí hay bicicleta estática porque sí está.
- Nunca nombras, sugieres ni mencionas —ni en "reemplazoNombre", ni en los hallazgos, ni en el resumen— una máquina o ejercicio que no esté en el catálogo. Ni siquiera como alternativa o comentario al pasar.
- Si crees que falta un estímulo y no hay con qué cubrirlo, lo dices con lo que SÍ existe, o lo dejas como hallazgo sin proponer cambio. Nunca inventas el equipo que falta.
- Ese hallazgo sí es útil: el entrenador puede cargar una máquina o un ejercicio nuevo en la biblioteca y desde ahí queda disponible. Pero mientras no esté en el catálogo, no existe para esta rutina — el hallazgo describe el hueco, el cambio nunca lo asume cubierto.
- Sí puedes proponer una técnica o una variante de ejecución sobre un ejercicio que ya está en el catálogo (por ejemplo un curl 21 sobre el curl con barra, un tempo más lento, un rango parcial): eso no necesita equipo nuevo. Lo que no puedes es inventar la máquina.
- El motivo es concreto: el alumno lee esta rutina y va al gimnasio a hacerla. Si le aparece un ejercicio que no puede hacer porque no existe la máquina, la rutina pierde toda credibilidad y queda claro que nadie la revisó.

Reglas duras para los cambios que propones:
- En "reemplazoNombre" usas SIEMPRE el nombre exacto de un ejercicio del catálogo que te entregan, copiado tal cual, sin reformular.
- El reemplazo debe trabajar el mismo grupo muscular que el ejercicio que sale, salvo que expliques por qué no.
- "dia" y "orden" tienen que coincidir con los números que ves en la rutina.
- Los campos que no cambias van en null. Si solo bajas las series, mandas series con el número nuevo y el resto en null.
- Propones pocos cambios y buenos. Cinco cambios bien fundados valen más que quince cosméticos.`;

function describirPerfil(perfil: PerfilEntrenamiento): string {
  const l = (etiqueta: string, valor: string | number | null | undefined) =>
    valor === null || valor === undefined || valor === "" ? null : `- ${etiqueta}: ${valor}`;
  return [
    l("Sexo", perfil.sexo),
    l("Edad", perfil.edad),
    l("Experiencia", perfil.experiencia),
    l("Objetivo principal declarado", perfil.objetivoPrincipal),
    l("Objetivo secundario", perfil.objetivoSecundario),
    l("Días disponibles por semana", perfil.diasDisponibles),
    l("Minutos por sesión", perfil.minutosSesion),
    l("Nivel de cardio actual", perfil.cardioNivel),
    l("Preferencia de equipo", perfil.preferenciaEquipo),
    l("Estilo de entrenamiento acordado", perfil.estiloEntrenamiento),
    l("Intensidad deseada", perfil.intensidadDeseada),
    l("Categoría de competencia", perfil.categoriaCompetencia === "ninguna" ? null : perfil.categoriaCompetencia),
    l("Ayudas ergogénicas (solo para calibrar volumen tolerable)", perfil.ayudasErgogenicas),
    l("Otras actividades que realiza", perfil.actividadesAdicionales),
    l("Ejercicios que le gustan", perfil.ejerciciosPreferidos),
    l("Ejercicios que NO quiere hacer", perfil.ejerciciosNoDeseados),
    l("Molestias actuales (texto del alumno)", perfil.molestias),
    l("Lesiones diagnosticadas (texto del alumno)", perfil.lesionesDiagnosticadas),
    l("Operaciones previas (texto del alumno)", perfil.operacionesPrevias),
    l("Condiciones médicas (texto del alumno)", perfil.condicionesMedicas),
    l("Medicamentos relevantes (texto del alumno)", perfil.medicamentosRelevantes),
    perfil.requiereRevision ? "- La ficha está marcada como PENDIENTE DE REVISIÓN por datos de salud." : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function describirBrief(brief: BriefGenerador): string {
  return [
    `- Objetivo que eligió el entrenador para esta rutina: ${brief.objetivo}`,
    `- Prioridad del bloque: ${brief.prioridad}`,
    `- Distribución: ${brief.distribucion}`,
    `- Días: ${brief.dias}, ${brief.ejerciciosPorSesion} ejercicios por sesión, ${brief.minutosSesion} min`,
    brief.grupoPrioritario ? `- Grupo prioritario: ${brief.grupoPrioritario}` : null,
    brief.enfoqueForma !== "ninguno" ? `- Enfoque de forma: ${brief.enfoqueForma}` : null,
    brief.inspiracionEstilo !== "ninguna" ? `- Inspiración de estilo: ${brief.inspiracionEstilo}` : null,
    brief.categoriaCompetencia !== "ninguna" ? `- Referencia física/categoría validada por el entrenador: ${brief.categoriaCompetencia}` : null,
    brief.evitarSaltos ? "- Restricción: sin impacto ni saltos" : null,
    brief.obligatorios.length ? `- Ejercicios que el entrenador exige incluir: ${brief.obligatorios.join(", ")}` : null,
    brief.prohibidos.length ? `- Ejercicios que el entrenador prohibió: ${brief.prohibidos.join(", ")}` : null,
    brief.cardio !== "ninguno" ? `- Cardio: ${brief.cardio} (${brief.cardioMinutos} min al final de la sesión)` : null,
    brief.observaciones ? `- Observaciones del entrenador: ${brief.observaciones}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** El catálogo va compacto y ordenado por grupo: es lo único que limita los
 * reemplazos a ejercicios que el gimnasio de verdad tiene. */
function describirCatalogo(biblioteca: EjercicioGenerador[]): string {
  const porGrupo = new Map<string, string[]>();
  for (const e of biblioteca) {
    const lista = porGrupo.get(e.grupoMuscular) ?? [];
    lista.push(`${e.nombre} (${e.equipo}, ${e.nivel})`);
    porGrupo.set(e.grupoMuscular, lista);
  }
  return [...porGrupo.entries()]
    .map(([grupo, nombres]) => `${grupo.toUpperCase()}: ${nombres.join(" | ")}`)
    .join("\n");
}

export async function revisarRutinaGenerada(params: {
  rutina: RutinaExtraida;
  perfil: PerfilEntrenamiento;
  brief: BriefGenerador;
  biblioteca: EjercicioGenerador[];
  reglasAplicadas: string[];
}): Promise<RevisionResultado> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Falta configurar la clave de IA en el servidor." };
  }

  const { rutina, perfil, brief, biblioteca, reglasAplicadas } = params;
  const client = new Anthropic({ apiKey });

  const mensaje = `FICHA DEL ALUMNO (la llenó él mismo desde su cuenta)
${describirPerfil(perfil) || "- Sin datos registrados."}

LO QUE PIDIÓ EL ENTRENADOR PARA ESTA RUTINA
${describirBrief(brief)}

REGLAS QUE YA APLICÓ EL MOTOR
${reglasAplicadas.map((r) => `- ${r}`).join("\n") || "- Sin reglas registradas."}

RUTINA GENERADA (el número al inicio de cada línea es el "orden" dentro del día)
${serializarRutinaATexto(rutina)}

MAQUINARIA Y EQUIPO DE LA SALA
${describirInventario()}

CATÁLOGO DE EJERCICIOS DE VIP FITNESS — los únicos que existen
Si algo no aparece en esta lista, el gimnasio no lo tiene. No lo nombres.
${describirCatalogo(biblioteca)}

Revisa esta rutina para esta persona en particular y responde con el veredicto, los hallazgos y los cambios concretos.`;

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SISTEMA,
      output_config: { effort: "high", format: zodOutputFormat(RevisionSchema) },
      messages: [{ role: "user", content: mensaje }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "La IA no pudo revisar esta rutina. Puedes publicarla igual o ajustarla a mano." };
    }
    if (!response.parsed_output) {
      return { ok: false, error: "La revisión llegó incompleta. Intenta de nuevo en unos minutos." };
    }

    return { ok: true, revision: resolverRevision(response.parsed_output, rutina, biblioteca) };
  } catch (err) {
    console.error("revisarRutinaGenerada error:", err);
    return { ok: false, error: "No fue posible revisar la rutina con IA en este momento. Puedes publicarla igual." };
  }
}

/** Cruza lo que propuso el modelo con la realidad: el ejercicio de reemplazo
 * tiene que existir en la biblioteca y el día/orden tiene que existir en el
 * borrador. Lo que no calza queda visible como sugerencia, pero sin botón de
 * aplicar — nunca se inventa un id. */
export function resolverRevision(
  revision: RevisionRutina,
  rutina: RutinaExtraida,
  biblioteca: EjercicioGenerador[]
): RevisionResuelta {
  const normalizar = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const porNombre = new Map(biblioteca.map((e) => [normalizar(e.nombre), e]));

  const cambios: CambioResuelto[] = revision.cambios.map((c) => {
    const dia = rutina.dias.find((d) => d.numero === c.dia);
    const existeDestino = Boolean(dia?.ejercicios[c.orden - 1]);
    const encontrado = c.reemplazoNombre ? porNombre.get(normalizar(c.reemplazoNombre)) : undefined;
    const necesitaReemplazo = c.accion === "reemplazar";
    return {
      ...c,
      ejercicioId: encontrado?.id ?? null,
      grupoMuscular: encontrado?.grupoMuscular ?? null,
      aplicable: existeDestino && (!necesitaReemplazo || Boolean(encontrado)),
    };
  });

  return { ...revision, cambios, revisadaEn: new Date().toISOString() };
}
