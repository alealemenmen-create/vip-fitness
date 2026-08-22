import { normalizar } from "@/lib/alimentos/emparejar";
import type { Ejercicio, EquipoEjercicio } from "./tipos";

/**
 * Cruza el nombre suelto que la IA sacó del PDF contra la biblioteca de
 * ejercicios. Es el mismo problema que ya estaba resuelto para los alimentos
 * (`src/lib/alimentos/emparejar.ts`) y sigue el mismo criterio: nada de IA,
 * solo comparación de texto normalizado, y si no llega al umbral se devuelve
 * `null` para que el entrenador lo resuelva a mano.
 *
 * La diferencia con los alimentos es `aliases`: cada entrenador nombra distinto
 * el mismo movimiento ("jalón al pecho", "jalón amplio", "lat pulldown"), así
 * que la biblioteca guarda todas las formas conocidas y acá se comparan todas.
 *
 * Preferir `null` antes que un emparejado dudoso es deliberado: mostrarle al
 * alumno el dibujo de otro ejercicio es peor que no mostrarle ninguno.
 */

const PALABRAS_VACIAS = new Set([
  "de", "del", "la", "el", "los", "las", "con", "sin", "a", "al", "en", "y", "o",
  "para", "tipo", "estilo", "maquina", "ejercicio",
]);

/**
 * Abreviaturas que los entrenadores escriben a mano en las rutinas. Sin esto,
 * el desambiguador de equipo de más abajo queda ciego justo cuando más falta
 * hace: el caso real que lo motivó fue "Press inclinado manc.", que terminó
 * vinculado a "Press inclinado con barra" en 67 rutinas — `/\bmancuerna/` no
 * reconoce "manc.", así que el alumno vio una barra donde su rutina decía
 * mancuernas.
 *
 * Se expande DESPUÉS de normalizar (que ya convirtió el punto en espacio), y
 * se aplica a los dos lados de la comparación: los alias de la biblioteca
 * también vienen escritos con abreviaturas.
 */
const ABREVIATURAS: Record<string, string> = {
  manc: "mancuerna",
  mancs: "mancuerna",
  mancuernas: "mancuerna",
  db: "mancuerna",
  bb: "barra",
  unilat: "unilateral",
  ext: "extension",
  exts: "extension",
  maq: "maquina",
  maqu: "maquina",
  pol: "polea",
  elev: "elevacion",
  sent: "sentadilla",
};

/** Palabras que a veces encabezan el nombre pero describen la ejecución, no el
 * ejercicio: "Isometría hip thrust" sigue siendo un hip thrust. Se usan para
 * elegir cuál es la palabra principal del movimiento. */
const MODIFICADORES_DELANTE = new Set([
  "isometria", "isometrico", "isometrica", "vacuum", "super", "mega", "mini",
  "giant", "drop", "medio", "media", "mitad", "activacion",
]);

/** Minúsculas, sin tildes ni puntuación, y con las abreviaturas expandidas.
 * Es la forma canónica que usa todo este archivo para comparar. */
function clave(texto: string): string {
  return normalizar(texto)
    .split(" ")
    .map((palabra) => ABREVIATURAS[palabra] ?? palabra)
    .join(" ");
}

function tokens(texto: string): string[] {
  return clave(texto)
    .split(" ")
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t))
    .filter((t) => t.length > 1 && !PALABRAS_VACIAS.has(t));
}

/**
 * Zona del cuerpo que nombra el texto. Sirve para vetar emparejados que el
 * puntaje por palabras deja pasar pero que cambian de músculo: el caso real
 * fue "Press de hombro en Smith", que quedó vinculado a "Press de banca en
 * Smith" por compartir 2 de 3 palabras (0,666, justo sobre el umbral).
 *
 * "banca" cuenta como pecho a propósito: en la práctica es lo que distingue
 * un press de pecho de uno de hombro cuando el resto del nombre es igual.
 */
const FAMILIAS_ZONA: [RegExp, string][] = [
  // "al pecho" es una dirección, no el músculo trabajado: "jalón al pecho" y
  // "remo al pecho" son de espalda. Sin esta excepción, el veto los separaba
  // de su propia entrada de la biblioteca.
  [/(?<!\bal\s)\b(pecho|pectoral|pectorale|banca|bench)\b/, "pecho"],
  [/\b(hombro|hombros|deltoide|deltoides|militar)\b/, "hombro"],
  [/\b(espalda|dorsal|dorsale|dorsales|trapecio|lumbar|lumbares)\b/, "espalda"],
  [/\b(bicep|biceps)\b/, "bicep"],
  [/\b(tricep|triceps)\b/, "tricep"],
  [/\b(cuadricep|cuadriceps)\b/, "cuadricep"],
  [/\b(femoral|femorale|isquio|isquiotibial|isquiotibiales)\b/, "femoral"],
  [/\b(gluteo|gluteos)\b/, "gluteo"],
  [/\b(gemelo|gemelos|pantorrilla|pantorrillas|soleo)\b/, "gemelo"],
  [/\b(abdominal|abdominale|abdominales|abdomen|oblicuo|oblicuos)\b/, "abdomen"],
  [/\b(antebrazo|antebrazos)\b/, "antebrazo"],
];

function zonasMencionadas(textoNormalizado: string): Set<string> {
  const zonas = new Set<string>();
  for (const [patron, familia] of FAMILIAS_ZONA) {
    if (patron.test(textoNormalizado)) zonas.add(familia);
  }
  return zonas;
}

/** `grupo_muscular` como señal de zona, solo donde el dato es tan preciso como
 * las familias de arriba. "brazos" y "piernas" abarcan músculos que este veto
 * necesita distinguir (bíceps de tríceps, cuádriceps de femoral), así que no
 * aportan nada y se dejan afuera a propósito. */
const ZONA_POR_GRUPO: Partial<Record<Ejercicio["grupoMuscular"], string>> = {
  pecho: "pecho",
  espalda: "espalda",
  hombros: "hombro",
};

/**
 * Zona del ejercicio mirándolo entero, no solo el texto que casualmente
 * coincidió. Hace falta porque los alias son abreviados y suelen omitir el
 * músculo: "press smith" es alias de "Press de banca en Smith" y no dice
 * "banca" por ningún lado, así que comparando solo contra el alias, un "press
 * de hombro en Smith" pasaba el veto y se llevaba la foto del pecho.
 */
function zonasDelEjercicio(ejercicio: EjercicioParaEmparejar, nombreCoincidente: string): Set<string> {
  const zonas = zonasMencionadas(clave(ejercicio.nombre));
  for (const zona of zonasMencionadas(clave(nombreCoincidente))) zonas.add(zona);
  const porGrupo = ZONA_POR_GRUPO[ejercicio.grupoMuscular];
  if (porGrupo) zonas.add(porGrupo);
  return zonas;
}

/** Dos textos hablan de músculos distintos: no son el mismo ejercicio por más
 * palabras que compartan. Si alguno no nombra zona, no hay nada que vetar. */
function zonasEnConflicto(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const zona of a) if (b.has(zona)) return false;
  return true;
}

/**
 * Equipo que el propio nombre del PDF menciona. Es la señal más fuerte para
 * elegir entre variantes del mismo movimiento, y sale de un dato estructurado
 * (`ejercicios.equipo`) en vez de adivinarse del texto.
 *
 * El caso que lo hizo necesario: "Press banca con mancuernas" empataba en
 * puntaje con "Press de banca" (barra) y ganaba por orden de lista, así que le
 * mostraba al alumno una barra para un ejercicio con mancuernas.
 */
const EQUIPO_EN_TEXTO: [RegExp, EquipoEjercicio][] = [
  [/\bmancuerna/, "mancuerna"],
  [/\b(smith|multipower)\b/, "smith"],
  [/\b(polea|cable)/, "polea"],
  [/\bkettlebell/, "kettlebell"],
  [/\bbanda/, "banda"],
  [/\bbarra\b/, "barra"],
  // "máquina" queda deliberadamente afuera: un Smith, un Hammer, una prensa y
  // un pec deck son todos "máquina", así que no distingue nada — el propio
  // archivo ya la trata como palabra vacía más abajo. Usarla como veto mandaba
  // "Press inclinado en máquina" a la prensa de piernas, porque descartaba al
  // press inclinado (barra) y dejaba ganar a un alias lejano.
];

function equipoMencionado(textoNormalizado: string): EquipoEjercicio | null {
  for (const [patron, equipo] of EQUIPO_EN_TEXTO) {
    if (patron.test(textoNormalizado)) return equipo;
  }
  return null;
}

export type ConfianzaEjercicio = "exacta" | "alta" | "media";

/**
 * Lo mínimo que necesita este archivo para emparejar — genérico sobre `T`
 * (que en la práctica casi siempre es `Ejercicio` completo, pero
 * `RutinaDraftEditor.tsx` solo tiene la versión liviana `EjercicioBiblioteca`
 * que le pasa el servidor) para no obligar a nadie a armar un `Ejercicio`
 * completo con 25 campos de relleno solo para poder emparejar un nombre.
 */
export type EjercicioParaEmparejar = Pick<Ejercicio, "id" | "nombre" | "slug" | "aliases" | "grupoMuscular" | "equipo">;

export type EmparejamientoEjercicio<T extends EjercicioParaEmparejar = Ejercicio> = {
  ejercicio: T;
  confianza: ConfianzaEjercicio;
} | null;

/** Todas las formas de nombrar un ejercicio: su nombre, su slug y sus alias. */
function nombresDe(ejercicio: EjercicioParaEmparejar): string[] {
  return [ejercicio.nombre, ejercicio.slug.replace(/-/g, " "), ...ejercicio.aliases];
}

/** Adjetivos que describen CÓMO se hace el ejercicio, no cuál es. Sacarlos
 * deja el nombre del movimiento: "Dominadas estrictas" → "Dominadas". */
const CALIFICADORES =
  /\b(estrict[ao]s?|lent[ao]s?|pesad[ao]s?|liger[ao]s?|parcial(?:es)?|gigantes?|abiert[ao]s?|cerrad[ao]s?|isometrias?|alt[ao]s?|reps?)\b/g;

/**
 * Variantes progresivamente más simples del nombre, de la más fiel a la más
 * recortada. Los entrenadores escriben cosas como "Dominadas o jalón pesado" o
 * "Pantorrilla de pie / máquina" cuando le dan al alumno una alternativa: en
 * esos casos vale emparejar con la primera opción, que es la principal.
 */
function variantes(nombrePdf: string): string[] {
  const lista = [nombrePdf];

  // Lo que va entre paréntesis suele ser una aclaración, no el ejercicio.
  const sinParentesis = nombrePdf.replace(/\([^)]*\)/g, " ").trim();
  if (sinParentesis && sinParentesis !== nombrePdf) lista.push(sinParentesis);

  // Primera opción cuando se ofrecen varias.
  const primeraOpcion = sinParentesis.split(/\s+o\s+|\s*\/\s*|\s*\+\s*/i)[0]?.trim();
  if (primeraOpcion && !lista.includes(primeraOpcion)) lista.push(primeraOpcion);

  // Sin los adjetivos de ejecución.
  const sinCalificadores = primeraOpcion?.toLowerCase().replace(CALIFICADORES, " ").trim();
  if (sinCalificadores && sinCalificadores.length > 2 && !lista.includes(sinCalificadores)) {
    lista.push(sinCalificadores);
  }

  return lista;
}

export function emparejarEjercicio<T extends EjercicioParaEmparejar>(
  nombrePdf: string,
  biblioteca: T[]
): EmparejamientoEjercicio<T> {
  for (const [i, variante] of variantes(nombrePdf).entries()) {
    const r = emparejarExacto(variante, biblioteca);
    // Solo el nombre tal cual puede dar confianza máxima: si hubo que recortar
    // el texto para que emparejara, el entrenador debería poder revisarlo.
    if (r) return i === 0 ? r : { ...r, confianza: r.confianza === "exacta" ? "alta" : "media" };
  }
  return null;
}

/**
 * Dos ejercicios distintos de la biblioteca que reclaman el mismo alias.
 *
 * Mientras existe una colisión así, ese texto es indecidible: "extensión
 * unilateral" está registrado a la vez en "Extensión unilateral de cuádriceps"
 * y en "Extensión unilateral de tríceps", que son músculos distintos. Antes,
 * `emparejarExacto` devolvía el primero que apareciera en el orden de la lista
 * —o sea, qué foto veía el alumno dependía del orden en que la base devolvió
 * las filas— y por eso un alumno terminó reportando que veía un cuádriceps en
 * su extensión de tríceps.
 *
 * La galería usa esto para pedirle al entrenador que resuelva a quién
 * pertenece el alias, en vez de ofrecer combinar dos ejercicios legítimos.
 */
export type AliasEnDisputa = {
  alias: string;
  ejercicios: Ejercicio[];
};

export function detectarAliasEnDisputa(biblioteca: Ejercicio[]): AliasEnDisputa[] {
  const porClave = new Map<string, { alias: string; ejercicios: Map<string, Ejercicio> }>();
  for (const ejercicio of biblioteca) {
    for (const nombre of [ejercicio.nombre, ...ejercicio.aliases]) {
      const k = clave(nombre);
      if (!k) continue;
      const grupo = porClave.get(k) ?? { alias: nombre, ejercicios: new Map<string, Ejercicio>() };
      grupo.ejercicios.set(ejercicio.id, ejercicio);
      porClave.set(k, grupo);
    }
  }
  return Array.from(porClave.values())
    .filter((grupo) => grupo.ejercicios.size > 1)
    .map((grupo) => ({ alias: grupo.alias, ejercicios: Array.from(grupo.ejercicios.values()) }))
    .sort((a, b) => a.alias.localeCompare(b.alias, "es", { sensitivity: "base" }));
}

function emparejarExacto<T extends EjercicioParaEmparejar>(
  nombrePdf: string,
  biblioteca: T[]
): EmparejamientoEjercicio<T> {
  const objetivo = clave(nombrePdf);
  if (!objetivo) return null;

  const zonasObjetivo = zonasMencionadas(objetivo);
  const equipoPedido = equipoMencionado(objetivo);

  /**
   * Un candidato queda descartado, por más que el texto se parezca, cuando
   * nombra otro músculo o pide otro equipo. Son las dos señales que convierten
   * un parecido de palabras en un ejercicio distinto:
   *
   *   - Zona: "Press de hombro en Smith" no es "Press de banca en Smith".
   *   - Equipo: "Press inclinado manc." no es "Press inclinado con barra".
   *
   * El equipo VETA, ya no solo desempata. Antes, mencionar mancuernas apenas
   * inclinaba la balanza cuando dos candidatos empataban en puntaje; si el de
   * barra puntuaba un poco más alto, ganaba igual.
   */
  function vetado(ejercicio: T, nombreCandidato: string): boolean {
    if (zonasEnConflicto(zonasObjetivo, zonasDelEjercicio(ejercicio, nombreCandidato))) return true;
    if (equipoPedido === null) return false;
    // El veto exige que el candidato NOMBRE su propio equipo, no que lo tenga
    // cargado en la ficha. Con la ficha alcanzaba para romper emparejados
    // buenos: "Peso muerto con banda" perdía su "Peso muerto" (barra) y
    // "Hip Thrust Máquina" perdía su "Hip thrust", quedándose sin foto por un
    // matiz de montaje. Cuando el nombre del candidato sí dice el equipo, en
    // cambio, la contradicción es explícita y ahí sí son ejercicios distintos:
    // "Press inclinado manc." contra "Press inclinado con barra".
    const equipoCandidato =
      equipoMencionado(clave(ejercicio.nombre)) ?? equipoMencionado(clave(nombreCandidato));
    return equipoCandidato !== null && equipoCandidato !== equipoPedido;
  }

  // 1. Coincidencia exacta contra nombre, slug o alias.
  //
  //    Se recorre la biblioteca ENTERA antes de decidir, en vez de devolver el
  //    primero que coincida: dos ejercicios distintos pueden tener registrado
  //    el mismo alias (ver `detectarAliasEnDisputa`), y en ese caso el texto es
  //    indecidible. Devolver `null` lo deja sin foto y lo manda a la cola del
  //    entrenador, que es exactamente lo que este archivo promete desde el
  //    principio: preferir ninguna foto antes que la del ejercicio equivocado.
  const exactos = new Map<string, T>();
  for (const ejercicio of biblioteca) {
    if (nombresDe(ejercicio).some((n) => clave(n) === objetivo)) {
      exactos.set(ejercicio.id, ejercicio);
    }
  }
  if (exactos.size === 1) {
    return { ejercicio: exactos.values().next().value!, confianza: "exacta" };
  }
  if (exactos.size > 1) return null;

  // 2. Uno contiene al otro ("press banca" dentro de "press de banca plano").
  //
  //    No alcanza con que uno contenga al otro: hay que mirar cuánto texto
  //    sobra. "Trepar la cuerda" contiene "cuerda" (salto a la cuerda) y son
  //    ejercicios completamente distintos — emparejarlos le mostraría al
  //    alumno el dibujo equivocado, que es peor que no mostrarle ninguno.
  //    Exigiendo que el más corto sea al menos el 60% del más largo, las
  //    palabras que sobran no pueden cambiar de qué ejercicio se habla.
  if (objetivo.length >= 5) {
    for (const ejercicio of biblioteca) {
      for (const nombre of nombresDe(ejercicio)) {
        const n = clave(nombre);
        if (n.length < 5) continue;
        if (!n.includes(objetivo) && !objetivo.includes(n)) continue;
        if (vetado(ejercicio, nombre)) continue;
        const proporcion = Math.min(n.length, objetivo.length) / Math.max(n.length, objetivo.length);
        if (proporcion >= 0.6) return { ejercicio, confianza: "alta" };
      }
    }
  }

  // 3. Palabras en común, quedándose con el mejor puntaje.
  const tokensObjetivo = tokens(nombrePdf);
  if (tokensObjetivo.length === 0) return null;

  // La palabra que encabeza el nombre es la que dice QUÉ movimiento es
  // ("press", "curl", "remo", "patada"); el resto lo matiza. Si el candidato
  // ni la menciona, comparten adornos, no el ejercicio: "Patada lateral en
  // polea" puntuaba 2 de 3 contra el alias "lateral polea" de las elevaciones
  // laterales de hombro, y le mostraba un hombro a quien hacía glúteo.
  //
  // Se saltean los modificadores que a veces van adelante ("Isometría hip
  // thrust", "Vacuum con russian twist"): describen cómo se ejecuta, no qué
  // ejercicio es, y tomarlos como palabra principal dejaba sin foto a
  // ejercicios que emparejaban perfecto.
  const principalObjetivo = tokensObjetivo.find((t) => !MODIFICADORES_DELANTE.has(t)) ?? tokensObjetivo[0];

  let mejor:
    | { ejercicio: T; puntaje: number; sobrantes: number; equipoOk: boolean }
    | null = null;
  for (const ejercicio of biblioteca) {
    for (const nombre of nombresDe(ejercicio)) {
      const tokensNombre = tokens(nombre);
      if (tokensNombre.length === 0) continue;
      if (vetado(ejercicio, nombre)) continue;
      if (!tokensNombre.includes(principalObjetivo)) continue;
      const comunes = tokensObjetivo.filter((t) => tokensNombre.includes(t)).length;
      if (comunes === 0) continue;
      // Palabras que quedan sin compartir de los dos lados. Sirve para
      // desempatar: "press banca con mancuernas" empataba en puntaje entre
      // "press banca plano" (sobra banca/plano) y "press mancuernas" (solo
      // sobra banca), y ganaba el primero de la lista por puro orden — o sea
      // le mostraba al alumno una barra cuando el ejercicio era con
      // mancuernas. Gana el que deja menos palabras sueltas.
      const sobrantes = tokensObjetivo.length + tokensNombre.length - 2 * comunes;
      // Se divide por el nombre MÁS LARGO, no por el más corto (que es lo que
      // hace la versión de alimentos). Con el más corto, cualquier ejercicio
      // de una sola palabra puntúa perfecto contra cualquier frase que la
      // mencione: "Trepar la cuerda" daba 1.0 contra "Cuerda" (saltar la
      // cuerda). Dividir por el más largo obliga a que las palabras que sobran
      // también cuenten.
      const puntaje = comunes / Math.max(tokensObjetivo.length, tokensNombre.length);
      const equipoOk = equipoPedido !== null && ejercicio.equipo === equipoPedido;

      // Desempate en dos escalones: primero manda el equipo que nombra el PDF
      // (barra contra mancuernas es OTRO ejercicio, no un matiz), y recién
      // después cuántas palabras quedan sueltas.
      const gana =
        !mejor ||
        puntaje > mejor.puntaje ||
        (puntaje === mejor.puntaje &&
          (equipoOk !== mejor.equipoOk ? equipoOk : sobrantes < mejor.sobrantes));
      if (gana) mejor = { ejercicio, puntaje, sobrantes, equipoOk };
    }
  }

  // Umbral alto a propósito: con 0.5 entraban cosas como "press militar" →
  // "press banca", que comparten la palabra "press" y nada más.
  //
  // Pero tiene que dejar pasar 2 de 3 palabras, que es el caso más común de
  // todos ("remo sentado en polea" contra el alias "remo sentado"). Como 2/3
  // es 0.6666…, un umbral de 0.67 lo rechazaba por centésimas.
  if (mejor && mejor.puntaje >= 0.66) {
    return { ejercicio: mejor.ejercicio, confianza: "media" };
  }
  return null;
}
