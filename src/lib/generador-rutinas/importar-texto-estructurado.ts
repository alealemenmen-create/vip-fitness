import type { RutinaExtraida, GrupoMuscular } from "@/lib/ai/extraerRutina";

export const FORMATO_RUTINA_SIN_IA = `RUTINA: Nombre de la rutina
DIA 1: Pecho y tríceps
Press de banca | 4 | 8-10 | 120 | - | - | Controla el descenso | -
Aperturas con mancuerna | 3 | 12 | 0 | Biserie (1/2) | todas | Sin descanso, sigue con fondos | -
Fondos inclinados | 3 | 10-12 | 90 | Biserie (2/2) | todas | Descansa al terminar ambos ejercicios | -
Extensión de tríceps en polea | 3 | 10-12 | 60 | Drop set | ultima | Reduce el peso 25% y continúa hasta casi el fallo | -

DESCANSO: Recuperación activa

DIA 2: Espalda y bíceps
Jalón al pecho | 4 | 8-12 | 90 | - | - | Lleva los codos hacia abajo | -
Curl con mancuernas | 3 | 10-12 | 60 | Rest-pause | 3 | Haz una pausa de 15 segundos y completa repeticiones extra | -`;

const sinAcentos = (valor: string) => valor.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function clasificarGrupo(textoOriginal: string): GrupoMuscular | null {
  const texto = sinAcentos(textoOriginal);
  if (/press.*banca|apertura|pectoral|pecho|fondos inclinados/.test(texto)) return "pecho";
  if (/jalon|remo|dominada|pullover|espalda|dorsal/.test(texto)) return "espalda";
  if (/sentadilla|prensa|femoral|cuadriceps|glute|aductor|abductor|pantorrilla|gemelo|pierna/.test(texto)) return "piernas";
  if (/hombro|elevacion lateral|press militar|press arnold|face pull|pajaro/.test(texto)) return "hombros";
  if (/biceps|triceps|curl|extension.*polea|press frances|brazo/.test(texto)) return "brazos";
  if (/abdominal|core|plancha|crunch|vacuum/.test(texto)) return "core";
  if (/cardio|bicicleta|cinta|caminata|trote|eliptica|remo ergometro/.test(texto)) return "cardio";
  return null;
}

function inferirGrupo(nombre: string, dia: string): GrupoMuscular | null {
  return clasificarGrupo(nombre) ?? clasificarGrupo(dia);
}

function leerSeriesTecnica(valor: string | undefined, seriesProgramadas: number): number[] | null {
  if (!valor || valor === "-" || /^(todas?|todo)$/i.test(valor)) return null;
  if (/^(ultima|última)$/i.test(valor)) return [seriesProgramadas];
  const numeros = valor.split(/[,;+]/).map((parte) => Number(parte.trim()))
    .filter((numero) => Number.isInteger(numero) && numero >= 1 && numero <= seriesProgramadas);
  return numeros.length > 0 ? [...new Set(numeros)].sort((a, b) => a - b) : null;
}

/** Lector gratuito y determinista del formato con barras verticales. Devuelve
 * null cuando el texto es libre para que el llamador pueda recurrir a IA. */
export function importarRutinaEstructurada(texto: string): RutinaExtraida | null {
  const lineas = texto.split(/\r?\n/).map((linea) => linea.trim()).filter(Boolean);
  const tieneFormato = lineas.some((linea) => /^d[ií]a\s+\d+\s*:/i.test(linea))
    && lineas.some((linea) => linea.split("|").length >= 4);
  if (!tieneFormato) return null;

  let nombreRutina = "Rutina importada";
  const dias: RutinaExtraida["dias"] = [];
  let actual: RutinaExtraida["dias"][number] | null = null;

  for (const linea of lineas) {
    const nombre = linea.match(/^rutina\s*:\s*(.+)$/i);
    if (nombre) {
      nombreRutina = nombre[1].trim() || nombreRutina;
      continue;
    }

    const descanso = linea.match(/^descanso\s*:\s*(.*)$/i);
    if (descanso) {
      actual = null;
      dias.push({
        numero: dias.length + 1,
        nombre: descanso[1].trim() || "Descanso",
        tipo: "descanso",
        descripcion: descanso[1].trim() || null,
        ejercicios: [],
      });
      continue;
    }

    const encabezado = linea.match(/^d[ií]a\s+\d+\s*:\s*(.+)$/i);
    if (encabezado) {
      actual = {
        numero: dias.length + 1,
        nombre: encabezado[1].trim() || `Sesión ${dias.length + 1}`,
        tipo: "entrenamiento",
        descripcion: null,
        ejercicios: [],
      };
      dias.push(actual);
      continue;
    }

    if (!actual || actual.tipo !== "entrenamiento") continue;
    const columnas = linea.split("|").map((columna) => columna.trim());
    if (columnas.length < 4) continue;
    const nombreEjercicio = columnas[0].replace(/^\d+[.)-]?\s*/, "").trim();
    const series = Number(columnas[1]);
    const reps = columnas[2];
    const descansoSegundos = Number(columnas[3].replace(/\s*s(?:eg)?\.?$/i, ""));
    if (!nombreEjercicio || !Number.isInteger(series) || series < 1 || series > 20 || !reps) continue;

    const tecnica = columnas[4] && columnas[4] !== "-" ? columnas[4] : null;
    const selectorSeries = columnas[5];
    const tecnicaSeries = tecnica ? leerSeriesTecnica(selectorSeries, series) : null;
    const tecnicaInstruccion = columnas[6] && columnas[6] !== "-" ? columnas[6] : null;
    const observacion = columnas[7] && columnas[7] !== "-" ? columnas[7] : null;
    actual.ejercicios.push({
      orden: actual.ejercicios.length + 1,
      nombre: nombreEjercicio,
      series,
      reps,
      descansoSegundos: Number.isFinite(descansoSegundos) ? Math.max(0, Math.min(600, descansoSegundos)) : 60,
      tecnicaTipo: tecnica,
      tecnicaSeries,
      tecnicaInstruccion,
      observacion,
      grupoMuscular: inferirGrupo(nombreEjercicio, actual.nombre),
    });
  }

  const conEjercicios = dias.some((dia) => dia.tipo === "entrenamiento" && dia.ejercicios.length > 0);
  return conEjercicios ? { nombreRutina, dias } : null;
}
