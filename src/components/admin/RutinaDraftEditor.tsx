"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Search, Copy, RefreshCcw, Pencil, Check, AlertTriangle, CircleCheckBig, WandSparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { publicarRutinaAVariosAlumnos } from "@/app/admin/archivos/actions";
import { RevisionIAPanel } from "@/components/admin/RevisionIAPanel";
import { serializarRutinaATexto } from "@/lib/generador-rutinas/serializar";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { CambioResuelto, RevisionResuelta } from "@/lib/ai/revisarRutina";
import type { TipoProgresionImpulso } from "@/lib/supabase/types";
import { PLANES_ENTRENAMIENTO, type CodigoPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import { esBaseEstructural, patronMovimiento, prioridadEstructural, type PatronMovimiento } from "@/lib/rutinas/patrones";
import { detectarHallazgosRutina, type HallazgoRutina } from "@/lib/rutinas/validacion";
import { NIVELES_ARMADO, type NivelArmado } from "@/lib/generador-rutinas/niveles-armado";

/** Revisión de IA del borrador. Opcional: solo el flujo del generador la pasa
 * — desde un PDF importado no hay ficha ni brief contra qué contrastar. */
export type RevisarRutinaFn = (
  rutina: RutinaExtraida
) => Promise<{ ok: true; revision: RevisionResuelta } | { ok: false; error: string }>;

/** Biblioteca real para el selector de ejercicios (tarea: "que yo presione
 * sobre el ejercicio y se me dé una lista para elegir, no que tenga que
 * escribir"). Opcional: si no llega (otros llamadores de este editor que
 * todavía no la pasan), el nombre sigue siendo un campo de texto libre. */
export type EjercicioBiblioteca = {
  id: string;
  nombre: string;
  grupo: string;
  equipo: string;
  patronMovimiento?: PatronMovimiento | null;
};

type EjercicioExtraido = RutinaExtraida["dias"][number]["ejercicios"][number];

/** Config de progresión de Impulso VIP para este ejercicio ASIGNADO — no es
 * parte de lo que extrae la IA del PDF (por eso vive aparte de
 * `EjercicioExtraidoSchema` en extraerRutina.ts, no mezclado ahí: es una
 * decisión del entrenador, no algo que deba adivinar la IA). Opcionales para
 * que un borrador viejo (`RutinaExtraida` plano, sin estos campos) siga
 * siendo válido — `conDefaultsProgresion` los completa al cargar. */
type ConfigProgresionBorrador = {
  aptoProgresion?: boolean;
  tipoProgresion?: TipoProgresionImpulso;
  incrementoKg?: number;
  requiereAutorizacion?: boolean;
  /** Se copia desde la galería al elegir el ejercicio. No se muestra al
   * alumno; permite validar por biomecánica sin adivinar por el nombre. */
  patronMovimiento?: PatronMovimiento | null;
};

type Ejercicio = EjercicioExtraido & ConfigProgresionBorrador;
type Dia = Omit<RutinaExtraida["dias"][number], "ejercicios"> & { ejercicios: Ejercicio[] };
export type RutinaConProgresion = Omit<RutinaExtraida, "dias"> & { dias: Dia[] };

// Progresión automática encendida por defecto: el entrenador pidió que
// Impulso VIP corra para todos los alumnos sin tener que prenderlo ejercicio
// por ejercicio. Se puede apagar puntualmente desde acá si un ejercicio
// puntual no debería progresar solo (ver el checkbox más abajo).
const DEFAULTS_PROGRESION: ConfigProgresionBorrador = {
  aptoProgresion: true,
  tipoProgresion: "doble",
  // 5kg: el escalón de disco más común en la sala (ver mismo default en
  // motor.ts).
  incrementoKg: 5,
  requiereAutorizacion: false,
};

const EJERCICIO_VACIO: Ejercicio = {
  orden: 0,
  nombre: "",
  series: 3,
  reps: "10-12",
  descansoSegundos: 60,
  tecnicaTipo: null,
  tecnicaInstruccion: null,
  observacion: null,
  grupoMuscular: null,
  ...DEFAULTS_PROGRESION,
};

const TIPOS_PROGRESION: { value: TipoProgresionImpulso; label: string }[] = [
  { value: "doble", label: "Doble progresión (reps y después peso)" },
  { value: "solo_peso", label: "Solo peso" },
  { value: "solo_reps", label: "Solo repeticiones" },
  { value: "manual", label: "Manual (yo la ajusto)" },
];

const GRUPOS_MUSCULARES: { value: NonNullable<Ejercicio["grupoMuscular"]>; label: string }[] = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "piernas", label: "Piernas" },
  { value: "hombros", label: "Hombros" },
  { value: "brazos", label: "Brazos" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
];
const LABEL_GRUPO = new Map(GRUPOS_MUSCULARES.map((g) => [g.value, g.label]));

type GrupoVisual = { etiqueta: string; color: string };
type ObjetivoAutomatico = "pecho" | "espalda" | "piernas" | "hombros" | "biceps" | "triceps" | "core" | "cardio";
type EstiloAutomatico = "balance_vip" | "clasica" | "arnold" | "nueva_escuela" | "heavy_duty" | "sulek" | "cbum" | "ppl" | "powerbuilding" | "olympia";
type AlcanceAutomatico = "grupo" | "sesion" | "rutina";
type OrganizacionAutomatica = "por_grupos" | "alternado" | "biseries";
type CardioAutomatico = "ninguno" | "bicicleta" | "spinning";
type ConfigAutomatico = {
  diaIndice: number;
  alcance: AlcanceAutomatico;
  objetivo: ObjetivoAutomatico;
  estilo: EstiloAutomatico;
  organizacion: OrganizacionAutomatica;
  incluirCore: boolean;
  tecnicasPermitidas: string[];
  cardioInicio: CardioAutomatico;
  cardioInicioMinutos: number;
  cardioFinal: CardioAutomatico;
  cardioFinalMinutos: number;
};

const ETIQUETA_OBJETIVO: Record<ObjetivoAutomatico, string> = {
  pecho: "Pecho", espalda: "Espalda", piernas: "Piernas", hombros: "Hombros",
  biceps: "Bíceps", triceps: "Tríceps", core: "Core", cardio: "Cardio",
};
const ETIQUETA_ORGANIZACION: Record<OrganizacionAutomatica, string> = {
  por_grupos: "Por grupos", alternado: "Alternado", biseries: "Biseries agonista–antagonista",
};

type ProgramaVip = {
  nombre: string;
  descripcion: string;
  niveles: NivelArmado[];
  organizacion: OrganizacionAutomatica;
  tecnicas: string[];
};

/** Programas originales VIP. La referencia externa aporta la idea de un
 * catálogo por objetivos y fases; las fórmulas, nombres y reglas son propias.
 * Cada programa sigue usando la biblioteca real del gimnasio. */
const PROGRAMAS_VIP: Record<EstiloAutomatico, ProgramaVip> = {
  balance_vip: { nombre: "Base VIP", descripcion: "Hipertrofia equilibrada y progresión clara.", niveles: ["principiante", "intermedio", "avanzado", "olympia", "profesional", "estandar", "competitivo", "senior"], organizacion: "por_grupos", tecnicas: [] },
  ppl: { nombre: "Fundamentos PPL", descripcion: "Empuje, tracción y piernas con dificultad adaptada.", niveles: ["principiante", "intermedio", "avanzado", "olympia", "profesional", "estandar", "competitivo"], organizacion: "por_grupos", tecnicas: [] },
  clasica: { nombre: "Volumen Clásico", descripcion: "Trabajo culturista por grupos y accesorios de alto volumen.", niveles: ["intermedio", "avanzado", "olympia", "profesional", "estandar", "competitivo"], organizacion: "por_grupos", tecnicas: ["Drop set"] },
  arnold: { nombre: "Doble Frecuencia", descripcion: "Parejas musculares, volumen alto y rotación semanal.", niveles: ["intermedio", "avanzado", "olympia", "profesional", "competitivo"], organizacion: "biseries", tecnicas: ["Drop set"] },
  nueva_escuela: { nombre: "Tensión Inteligente", descripcion: "RIR, ejecución controlada y volumen recuperable.", niveles: ["intermedio", "avanzado", "olympia", "profesional", "estandar", "competitivo"], organizacion: "por_grupos", tecnicas: ["Tempo controlado", "Rest-pause"] },
  heavy_duty: { nombre: "Intensidad Esencial", descripcion: "Menos series, máxima intención y fallo dosificado.", niveles: ["avanzado", "olympia", "profesional", "competitivo"], organizacion: "por_grupos", tecnicas: ["Fallo muscular", "Rest-pause"] },
  sulek: { nombre: "Volumen Libre VIP", descripcion: "Sesiones densas, accesorios abundantes y remates intensos.", niveles: ["avanzado", "olympia", "profesional", "competitivo"], organizacion: "alternado", tecnicas: ["Drop set", "Fallo muscular"] },
  cbum: { nombre: "Escultura Moderna", descripcion: "Balance estético, frecuencia y detalle competitivo.", niveles: ["avanzado", "olympia", "profesional", "competitivo"], organizacion: "alternado", tecnicas: ["Drop set", "Rest-pause"] },
  powerbuilding: { nombre: "Hierro Híbrido", descripcion: "Fuerza en bases y volumen culturista en accesorios.", niveles: ["intermedio", "avanzado", "olympia", "profesional", "estandar", "competitivo"], organizacion: "por_grupos", tecnicas: ["Cluster set"] },
  olympia: { nombre: "Camino a Tarima", descripcion: "Volumen competitivo, biseries y finalizadores avanzados.", niveles: ["olympia", "profesional", "competitivo"], organizacion: "biseries", tecnicas: ["FST-7", "Drop set"] },
};

function programasParaNivel(nivel: NivelArmado): [EstiloAutomatico, ProgramaVip][] {
  return (Object.entries(PROGRAMAS_VIP) as [EstiloAutomatico, ProgramaVip][]).filter(([, programa]) => programa.niveles.includes(nivel));
}

export function objetivosMuscularesDia(dia: Pick<Dia, "nombre" | "descripcion" | "ejercicios">): ObjetivoAutomatico[] {
  const texto = `${dia.nombre} ${dia.descripcion ?? ""}`.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const objetivos = new Set<ObjetivoAutomatico>();
  const menciones: { objetivo: ObjetivoAutomatico; indice: number }[] = [
    { objetivo: "pecho", indice: texto.search(/pecho/) },
    { objetivo: "espalda", indice: texto.search(/espalda/) },
    { objetivo: "piernas", indice: texto.search(/pierna|glute|cuadr|femoral|aductor|abductor|pantorr/) },
    { objetivo: "hombros", indice: texto.search(/hombro|deltoide/) },
    { objetivo: "biceps", indice: texto.search(/biceps|braquial/) },
    { objetivo: "triceps", indice: texto.search(/triceps/) },
    { objetivo: "core", indice: texto.search(/core|abdominal|oblicuo/) },
    { objetivo: "cardio", indice: texto.search(/cardio|aerob/) },
  ];
  menciones.filter((item) => item.indice >= 0).sort((a, b) => a.indice - b.indice).forEach((item) => objetivos.add(item.objetivo));
  for (const ejercicio of dia.ejercicios) {
    const patron = ejercicio.patronMovimiento ?? patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular);
    if (patron.startsWith("biceps_")) objetivos.add("biceps");
    else if (patron.startsWith("triceps_")) objetivos.add("triceps");
    else if (patron.startsWith("pecho_")) objetivos.add("pecho");
    else if (patron.startsWith("espalda_")) objetivos.add("espalda");
    else if (patron.startsWith("pierna_")) objetivos.add("piernas");
    else if (patron.startsWith("hombro_")) objetivos.add("hombros");
    else if (patron === "core") objetivos.add("core");
    else if (patron === "cardio") objetivos.add("cardio");
  }
  return [...objetivos];
}

function objetivoDePatron(patron: PatronMovimiento): ObjetivoAutomatico | null {
  if (patron.startsWith("biceps_")) return "biceps";
  if (patron.startsWith("triceps_")) return "triceps";
  if (patron.startsWith("pecho_")) return "pecho";
  if (patron.startsWith("espalda_")) return "espalda";
  if (patron.startsWith("pierna_")) return "piernas";
  if (patron.startsWith("hombro_")) return "hombros";
  if (patron === "core" || patron === "cardio") return patron;
  return null;
}

export function opcionesBibliotecaParaObjetivo(
  biblioteca: EjercicioBiblioteca[],
  objetivo: ObjetivoAutomatico
): { ejercicio: EjercicioBiblioteca; patron: PatronMovimiento }[] {
  return biblioteca
    .map((ejercicio) => ({
      ejercicio,
      patron: ejercicio.patronMovimiento ?? patronMovimiento(ejercicio.nombre, ejercicio.grupo),
    }))
    .filter((item) => objetivoDePatron(item.patron) === objetivo);
}

/** Colores de lectura del borrador. Bíceps y tríceps se separan aunque la
 * base todavía los guarde juntos como `brazos`. */
function grupoVisual(ejercicio: Pick<Ejercicio, "nombre" | "grupoMuscular">): GrupoVisual {
  const patron = "patronMovimiento" in ejercicio && ejercicio.patronMovimiento
    ? ejercicio.patronMovimiento as PatronMovimiento
    : patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular);
  if (patron.startsWith("biceps_")) return { etiqueta: "Bíceps", color: "#6fa4a0" };
  if (patron.startsWith("triceps_")) return { etiqueta: "Tríceps", color: "#9a84b9" };
  const grupos: Record<NonNullable<Ejercicio["grupoMuscular"]>, GrupoVisual> = {
    pecho: { etiqueta: "Pecho", color: "#c9787f" },
    espalda: { etiqueta: "Espalda", color: "#728fb8" },
    piernas: { etiqueta: "Piernas", color: "#78a27c" },
    hombros: { etiqueta: "Hombros", color: "#b99a62" },
    brazos: { etiqueta: "Brazos", color: "#8f86a7" },
    core: { etiqueta: "Core", color: "#b77f97" },
    cardio: { etiqueta: "Cardio", color: "#76a98a" },
  };
  return ejercicio.grupoMuscular ? grupos[ejercicio.grupoMuscular] : { etiqueta: "Ejercicio", color: "#94a3b8" };
}

function colorTecnicaVisual(tipo: string | null | undefined): string | null {
  const tecnica = (tipo ?? "").toLowerCase();
  if (tecnica.includes("biserie")) return "var(--color-tecnica-biserie)";
  if (tecnica.includes("superserie")) return "var(--color-tecnica-superserie)";
  if (tecnica.includes("triserie")) return "var(--color-tecnica-triserie)";
  if (tecnica.includes("giant") || tecnica.includes("serie gigante")) return "var(--color-tecnica-giant)";
  if (tecnica.includes("circuito")) return "var(--color-tecnica-circuito)";
  return null;
}

/** Línea de resumen para el día colapsado: "6 ejercicios · Pecho · Hombros". */
function resumenDia(dia: Dia): string {
  if (dia.tipo === "descanso") return "Descanso";
  const grupos = Array.from(
    new Set(dia.ejercicios.map((e) => e.grupoMuscular).filter((g): g is NonNullable<Ejercicio["grupoMuscular"]> => Boolean(g) && g !== "cardio"))
  );
  const cantidad = `${dia.ejercicios.length} ejercicio${dia.ejercicios.length === 1 ? "" : "s"}`;
  return grupos.length > 0 ? `${cantidad} · ${grupos.map((g) => LABEL_GRUPO.get(g) ?? g).join(" · ")}` : cantidad;
}

/** Grupo muscular más repetido en el día — para pre-filtrar el selector de
 * ejercicios al agregar uno nuevo (si el día ya es "Espalda", lo lógico es
 * arrancar mostrando ejercicios de espalda, no la biblioteca entera). */
function grupoDominante(dia: Dia): string | null {
  const conteo = new Map<string, number>();
  for (const e of dia.ejercicios) {
    if (!e.grupoMuscular || e.grupoMuscular === "cardio") continue;
    conteo.set(e.grupoMuscular, (conteo.get(e.grupoMuscular) ?? 0) + 1);
  }
  let mejor: string | null = null;
  let max = 0;
  for (const [grupo, n] of conteo) {
    if (n > max) { max = n; mejor = grupo; }
  }
  return mejor;
}

function gruposPlanificados(dia: Dia): string[] {
  const texto = `${dia.nombre} ${dia.descripcion ?? ""}`.toLowerCase();
  const grupos = new Set<string>();
  if (texto.includes("pecho")) grupos.add("pecho");
  if (texto.includes("espalda")) grupos.add("espalda");
  if (/pierna|glúte|glute|cuádr|cuadr|femoral|aductor|abductor|pantorr/.test(texto)) grupos.add("piernas");
  if (/hombro|deltoide/.test(texto)) grupos.add("hombros");
  if (/bíceps|biceps|tríceps|triceps|brazo/.test(texto)) grupos.add("brazos");
  if (/core|abdominal|oblicuo/.test(texto)) grupos.add("core");
  if (grupos.size === 0) {
    const dominante = grupoDominante(dia);
    if (dominante) grupos.add(dominante);
  }
  return [...grupos];
}

/** Una fila por ejercicio, no una ficha.
 *
 * Antes se dibujaban los 7 campos apilados siempre: con una rutina de 7 días y
 * 8 ejercicios por día eran 56 bloques altísimos, imposibles de repasar. Ahora
 * queda a la vista lo que de verdad se corrige (nombre, series, reps, descanso)
 * y el resto se despliega solo si el entrenador lo necesita. La vista previa
 * estructurada mantiene visibles técnicas y observaciones sin inflar el editor. */
/** Lista buscable de la biblioteca real, filtrada por el grupo muscular que
 * se está trabajando — "que yo presione sobre el ejercicio y se me dé una
 * lista para elegir, por grupo muscular". Vive aparte de EjercicioForm para
 * no inflar ese componente con la lógica de filtro/búsqueda. */
function SelectorEjercicioInline({
  gruposSugeridos,
  biblioteca,
  onElegir,
  onCerrar,
}: {
  gruposSugeridos: string[];
  biblioteca: EjercicioBiblioteca[];
  onElegir: (e: EjercicioBiblioteca) => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState(gruposSugeridos.length > 0 ? "__plan__" : "");
  const gruposDisponibles = useMemo(
    () => Array.from(new Set(biblioteca.map((ejercicio) => ejercicio.grupo))).sort(),
    [biblioteca]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return biblioteca
      .filter((e) => !grupoFiltro || (grupoFiltro === "__plan__" ? gruposSugeridos.includes(e.grupo) : e.grupo === grupoFiltro))
      .filter((e) => !q || `${e.nombre} ${e.grupo} ${e.equipo}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [biblioteca, busqueda, grupoFiltro, gruposSugeridos]);

  return (
    <div className="radius-control mt-1.5 border border-vip bg-surface-2 p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Search size={14} className="shrink-0 text-text-tertiary" />
        <input
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ejercicio…"
          className="min-w-0 flex-1 bg-transparent text-caption text-text outline-none"
        />
        <button type="button" onClick={onCerrar} className="text-caption shrink-0 text-text-tertiary">
          Cancelar
        </button>
      </div>
      <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
        {gruposSugeridos.length > 0 && (
          <button type="button" onClick={() => setGrupoFiltro("__plan__")} className={`radius-control shrink-0 border px-2 py-1 text-[9px] font-semibold ${grupoFiltro === "__plan__" ? "border-[#c7a25c] text-[#c7a25c]" : "border-border text-text-tertiary"}`}>
            Esta sesión
          </button>
        )}
        <button
          type="button"
          onClick={() => setGrupoFiltro("")}
          className={`radius-control shrink-0 border px-2 py-1 text-[9px] font-semibold ${!grupoFiltro ? "border-[#c7a25c] text-[#c7a25c]" : "border-border text-text-tertiary"}`}
        >
          Todos
        </button>
        {gruposDisponibles.map((grupo) => (
          <button
            key={grupo}
            type="button"
            onClick={() => setGrupoFiltro(grupo)}
            className={`radius-control shrink-0 border px-2 py-1 text-[9px] font-semibold capitalize ${grupoFiltro === grupo ? "border-vip text-vip" : "border-border text-text-tertiary"}`}
          >
            {grupo}
          </button>
        ))}
      </div>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {visibles.length === 0 && <p className="text-micro px-1 py-2 text-text-tertiary">Sin resultados.</p>}
        {visibles.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onElegir(e)}
            className="radius-control flex w-full items-center justify-between gap-2 bg-surface px-2 py-1.5 text-left active:bg-vip active:text-black"
          >
            <span className="text-caption truncate">{e.nombre}</span>
            <span className="text-micro shrink-0 text-text-tertiary">{e.grupo} · {e.equipo}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Elegir la técnica de una lista real en vez de escribirla a mano.
 *
 * Antes esto era un campo de texto libre con el placeholder "Biserie (1/2)":
 * el entrenador tenía que acordarse del nombre exacto Y de la numeración. Una
 * técnica mal tipeada no la reconocía nadie — ni el color de la vista previa
 * ni la auditoría de IA.
 *
 * Las ENCADENADAS no se guardan en un solo ejercicio: unen a varios seguidos.
 * Por eso al elegir una, el trabajo lo hace el día (`onEncadenar`), que
 * etiqueta los N ejercicios y crea los que falten para completarla. */
const EXPLICACION_TECNICA: Record<string, string> = {
  "Biserie": "Dos ejercicios seguidos; descansa solamente al completar ambos.",
  "Superserie": "Dos ejercicios seguidos, normalmente agonista-antagonista o dos patrones complementarios.",
  "Triserie": "Tres ejercicios seguidos; descansa al cerrar el bloque completo.",
  "Circuito": "Completa todos los ejercicios en orden y descansa al terminar la vuelta.",
  "Giant set": "Cuatro ejercicios encadenados para un mismo bloque muscular.",
  "Drop set": "En la última serie baja la carga y continúa sin descanso.",
  "Rest-pause": "Llega cerca del fallo, pausa brevemente y completa repeticiones adicionales.",
  "Fallo muscular": "Lleva la serie indicada hasta no poder completar otra repetición limpia.",
  "Tempo controlado": "Respeta una velocidad definida en cada fase de la repetición.",
  "Isometria": "Mantén la posición indicada durante el tiempo pautado.",
  "Cluster set": "Divide una serie pesada en bloques cortos con pausas internas.",
  "FST-7": "Realiza siete series de aislamiento con pausas cortas como remate localizado.",
  "Myo-reps": "Haz una serie de activación y luego mini-series con pausas breves.",
};

function explicacionTecnica(tecnica: TecnicaOpcion): string | null {
  return tecnica.descripcion ?? EXPLICACION_TECNICA[tecnica.nombre] ?? null;
}

/** Fórmula de arranque para no obligar al entrenador a completar tres campos
 * cada vez que elige un ejercicio nuevo. No toca un ejercicio que ya estaba
 * configurado: solo propone valores al llenar una fila vacía y todo sigue
 * siendo editable. El patrón biomecánico manda sobre el nombre visible. */
function prescripcionInicial(
  patron: PatronMovimiento,
  nivel: NivelArmado
): Pick<Ejercicio, "series" | "reps" | "descansoSegundos"> {
  if (patron === "cardio") return { series: 1, reps: "10-20 min", descansoSegundos: 0 };

  const base = esBaseEstructural(patron);
  if (nivel === "senior" || nivel === "principiante") {
    return base
      ? { series: 3, reps: "10-12", descansoSegundos: 120 }
      : { series: 2, reps: "12-15", descansoSegundos: 75 };
  }
  if (nivel === "competitivo" || nivel === "olympia") {
    return base
      ? { series: 5, reps: "15-12-10-8-8", descansoSegundos: 120 }
      : { series: 4, reps: "10-15", descansoSegundos: 60 };
  }
  if (nivel === "profesional") {
    return base
      ? { series: 5, reps: "6-10", descansoSegundos: 150 }
      : { series: 4, reps: "8-12", descansoSegundos: 75 };
  }
  if (nivel === "avanzado") {
    return base
      ? { series: 4, reps: "6-10", descansoSegundos: 120 }
      : { series: 4, reps: "10-15", descansoSegundos: 75 };
  }
  return base
    ? { series: 4, reps: "8-12", descansoSegundos: 90 }
    : { series: 3, reps: "10-15", descansoSegundos: 60 };
}

function prescripcionAutomatica(patron: PatronMovimiento, nivel: NivelArmado, estilo: EstiloAutomatico) {
  const base = prescripcionInicial(patron, nivel);
  if (estilo === "powerbuilding") {
    return esBaseEstructural(patron)
      ? { series: 5, reps: "4-6", descansoSegundos: 180 }
      : { series: 3, reps: "8-12", descansoSegundos: 90 };
  }
  if (estilo === "heavy_duty") {
    return esBaseEstructural(patron)
      ? { series: Math.max(3, base.series - 1), reps: "6-10", descansoSegundos: 150 }
      : { series: Math.max(2, base.series - 1), reps: "8-12", descansoSegundos: 90 };
  }
  if (estilo === "nueva_escuela") {
    return { ...base, reps: esBaseEstructural(patron) ? "6-10 · RIR 1-2" : "10-15 · RIR 1", descansoSegundos: Math.max(75, base.descansoSegundos ?? 75) };
  }
  if ((estilo === "arnold" || estilo === "sulek" || estilo === "clasica") && !esBaseEstructural(patron)) {
    return { ...base, series: Math.max(4, base.series), descansoSegundos: Math.min(75, base.descansoSegundos ?? 75) };
  }
  return base;
}

function formatoTecnica(tecnica: TecnicaOpcion): string {
  const partes = tecnica.tipo === "encadenada"
    ? [`${tecnica.cantidadEjercicios ?? 2} ejercicios`, `${tecnica.descansoInternoSeg ?? 0}s entre ejercicios`]
    : ["1 ejercicio"];
  if (tecnica.tipo === "individual" && (tecnica.descansoInternoSeg ?? 0) > 0) {
    partes.push(`${tecnica.descansoInternoSeg}s de pausa interna`);
  }
  partes.push(`${tecnica.descansoFinalSeg ?? 90}s al terminar`);
  if (tecnica.fatiga) partes.push(`fatiga ${tecnica.fatiga}`);
  if (tecnica.requiereSupervision) partes.push("supervisión");
  return partes.join(" · ");
}

function SelectorTecnica({
  valor,
  tecnicas,
  onLimpiar,
  onIndividual,
  onEncadenar,
}: {
  valor: string | null;
  tecnicas: TecnicaOpcion[];
  onLimpiar: () => void;
  onIndividual: (tecnica: TecnicaOpcion) => void;
  onEncadenar?: (tecnica: TecnicaOpcion) => void;
}) {
  const individuales = tecnicas.filter((t) => t.tipo === "individual");
  const encadenadas = tecnicas.filter((t) => t.tipo === "encadenada");

  // El valor guardado de una encadenada trae la numeración ("Biserie (1/2)"),
  // así que para reconocerla en la lista hay que comparar contra la parte de
  // adelante, no contra el texto completo.
  const nombreBase = valor?.replace(/\s*\(\d+\/\d+\)\s*$/, "") ?? "";
  const conocida = tecnicas.some((t) => t.nombre === nombreBase);

  const elegir = (nombre: string) => {
    if (!nombre) return onLimpiar();
    const tecnica = tecnicas.find((t) => t.nombre === nombre);
    if (!tecnica) return;
    if (tecnica.tipo === "encadenada" && onEncadenar) return onEncadenar(tecnica);
    onIndividual(tecnica);
  };

  return (
    <div>
      <Select value={conocida ? nombreBase : ""} onChange={(e) => elegir(e.target.value)} className="py-1.5">
        <option value="">Sin técnica especial</option>
        <optgroup label="Individuales (este ejercicio solo)">
          {individuales.map((t) => (
            <option key={t.nombre} value={t.nombre}>
              {t.nombre} · {formatoTecnica(t)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Encadenadas (unen varios ejercicios)">
          {encadenadas.map((t) => (
            <option key={t.nombre} value={t.nombre}>
              {t.nombre} · {formatoTecnica(t)}
            </option>
          ))}
        </optgroup>
      </Select>
      {conocida && (
        <div className="mt-1">
          <p className="text-micro text-vip">{formatoTecnica(tecnicas.find((t) => t.nombre === nombreBase)!)}</p>
          {explicacionTecnica(tecnicas.find((t) => t.nombre === nombreBase)!) && (
            <p className="text-micro text-text-tertiary">{explicacionTecnica(tecnicas.find((t) => t.nombre === nombreBase)!)}</p>
          )}
        </div>
      )}
      {valor && !conocida && (
        // Rutina vieja o texto escrito a mano: se respeta tal cual, no se
        // pisa en silencio con una técnica de la lista.
        <p className="text-micro mt-1 text-text-tertiary">
          Cargada a mano: <strong className="text-text-secondary">{valor}</strong>.{" "}
          <button type="button" onClick={onLimpiar} className="font-medium text-vip underline">
            Quitar
          </button>
        </p>
      )}
    </div>
  );
}

/** Una técnica real de `tecnicas_entrenamiento`. `cantidadEjercicios` es lo
 * que decide cuántos ejercicios encadena: biserie 2, triserie 3, giant set 4. */
export type TecnicaOpcion = {
  nombre: string;
  descripcion?: string | null;
  tipo: "individual" | "encadenada";
  cantidadEjercicios: number | null;
  descansoInternoSeg?: number;
  descansoFinalSeg?: number;
  fatiga?: "baja" | "media" | "alta";
  requiereSupervision?: boolean;
};

function EjercicioForm({
  numero,
  ejercicio,
  gruposSugeridos,
  biblioteca,
  tecnicas,
  onChange,
  onRemove,
  onEncadenar,
  nivelArmado = "estandar",
}: {
  numero: number;
  ejercicio: Ejercicio;
  gruposSugeridos: string[];
  biblioteca?: EjercicioBiblioteca[];
  /** Las técnicas reales del gimnasio. Sin esto el campo sigue siendo texto
   * libre, que es como funcionaba antes. */
  tecnicas?: TecnicaOpcion[];
  onChange: (e: Ejercicio) => void;
  onRemove: () => void;
  /** Elegir una técnica encadenada no es un dato de ESTE ejercicio: une a
   * varios seguidos. Lo resuelve el día, que es quien los conoce a todos. */
  onEncadenar?: (nombre: string, cantidad: number) => void;
  nivelArmado?: NivelArmado;
}) {
  // El resumen útil queda siempre visible. Técnica, observación y progresión
  // empiezan cerradas para que una rutina de 30 ejercicios no obligue a
  // recorrer una página interminable.
  const [ampliado, setAmpliado] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const [eligiendoTecnica, setEligiendoTecnica] = useState(false);
  const colorTecnica = colorTecnicaVisual(ejercicio.tecnicaTipo);
  const visual = grupoVisual(ejercicio);

  return (
    <div
      className="border-b bg-surface/40 px-2 py-2"
      style={{
        borderColor: "#30343a",
        boxShadow: colorTecnica
          ? `inset 3px 0 0 ${visual.color}, inset 0 -1px 0 ${colorTecnica}`
          : `inset 3px 0 0 ${visual.color}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-caption w-4 shrink-0 text-right text-text-tertiary">{numero}</span>
        {biblioteca ? (
          <button
            type="button"
            onClick={() => setEligiendo((v) => !v)}
            className="min-w-0 flex-1 truncate border-0 bg-transparent px-1 py-1 text-left text-secondary font-bold"
            style={{ fontWeight: 700, color: visual.color }}
          >
            {ejercicio.nombre || <span className="text-text-tertiary">Toca para elegir ejercicio…</span>}
          </button>
        ) : (
          <Input
            value={ejercicio.nombre}
            onChange={(e) => onChange({ ...ejercicio, nombre: e.target.value })}
            placeholder="Nombre del ejercicio"
            className="flex-1 py-1 font-semibold"
            style={{ fontWeight: 700, color: visual.color }}
          />
        )}
        <IconButton ariaLabel="Quitar ejercicio" onClick={onRemove}>
          <Trash2 size={15} className="text-error" />
        </IconButton>
      </div>

      {biblioteca && eligiendo && (
        <SelectorEjercicioInline
          gruposSugeridos={ejercicio.grupoMuscular ? [ejercicio.grupoMuscular] : gruposSugeridos}
          biblioteca={biblioteca}
          onCerrar={() => setEligiendo(false)}
          onElegir={(elegido) => {
            const nuevoPatron = elegido.patronMovimiento ?? patronMovimiento(elegido.nombre, elegido.grupo);
            const estabaVacio = !ejercicio.nombre.trim() && !ejercicio.ejercicioId;
            const propuesta = estabaVacio ? prescripcionInicial(nuevoPatron, nivelArmado) : null;
            onChange({
              ...ejercicio,
              ...(propuesta ?? {}),
              nombre: elegido.nombre,
              ejercicioId: elegido.id,
              grupoMuscular: (elegido.grupo as Ejercicio["grupoMuscular"]) ?? ejercicio.grupoMuscular,
              patronMovimiento: nuevoPatron,
            });
            setEligiendo(false);
          }}
        />
      )}

      {colorTecnica && ejercicio.tecnicaTipo && (
        <div className="mt-1.5 pl-[22px]">
          <span
            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ borderColor: colorTecnica, color: colorTecnica, backgroundColor: `color-mix(in srgb, ${colorTecnica} 12%, transparent)` }}
          >
            {ejercicio.tecnicaTipo}
          </span>
        </div>
      )}

      <div className="mt-1.5 grid grid-cols-[minmax(54px,.7fr)_minmax(108px,1.5fr)_minmax(70px,1fr)] gap-1.5 pl-[22px] max-[350px]:grid-cols-[52px_minmax(104px,1.35fr)_minmax(68px,1fr)] max-[350px]:gap-1">
        <label className="min-w-0 text-[10px] text-text-tertiary">
          <span className="mb-1 block">Series</span>
          <Input
            type="number"
            inputMode="numeric"
            min="1"
            value={ejercicio.series}
            onChange={(e) => onChange({ ...ejercicio, series: Number(e.target.value) })}
            className="!h-9 !min-w-0 !px-1 !py-1 !text-sm text-center font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
        <label className="min-w-0 text-[10px] text-text-tertiary">
          <span className="mb-1 block">Repeticiones</span>
          <Input
            value={ejercicio.reps}
            inputMode="text"
            onChange={(e) => onChange({ ...ejercicio, reps: e.target.value })}
            className="!h-9 !min-w-0 !px-1 !py-1 !text-sm text-center font-mono tabular-nums"
          />
        </label>
        <label className="min-w-0 text-[10px] text-text-tertiary">
          <span className="mb-1 block truncate">Descanso (s)</span>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={ejercicio.descansoSegundos ?? ""}
            onChange={(e) =>
              onChange({
                ...ejercicio,
                descansoSegundos: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="!h-9 !min-w-0 !px-1 !py-1 !text-sm text-center font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </label>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 pl-[22px]">
        {tecnicas && tecnicas.length > 0 && (
          <button
            type="button"
            onClick={() => setEligiendoTecnica((v) => !v)}
            className={`radius-control shrink-0 border px-2 py-1.5 text-[10px] font-semibold ${
              ejercicio.tecnicaTipo ? "border-vip/40 text-vip" : "border-border text-text-tertiary"
            }`}
          >
            {ejercicio.tecnicaTipo || "+ Técnica"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setAmpliado((v) => !v)}
          aria-label={ampliado ? "Ocultar detalles" : "Más detalles"}
          className="ml-auto flex shrink-0 items-center gap-1 py-1 text-[10px] text-text-tertiary"
        >
          Detalles {ampliado ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {eligiendoTecnica && tecnicas && tecnicas.length > 0 && (
        <div className="mt-1.5 border-t border-border pt-1.5 pl-[22px]">
          <SelectorTecnica
            valor={ejercicio.tecnicaTipo}
            tecnicas={tecnicas}
            onLimpiar={() => onChange({ ...ejercicio, tecnicaTipo: null, tecnicaInstruccion: null })}
            onIndividual={(tecnica) => {
              onChange({
                ...ejercicio,
                tecnicaTipo: tecnica.nombre,
                descansoSegundos: tecnica.descansoFinalSeg ?? ejercicio.descansoSegundos,
              });
              setEligiendoTecnica(false);
            }}
            onEncadenar={(tecnica) => {
              onEncadenar?.(tecnica.nombre, tecnica.cantidadEjercicios ?? 2);
              setEligiendoTecnica(false);
            }}
          />
        </div>
      )}

      {ampliado && (
        <div className="mt-2 space-y-1.5 pl-[22px]">
          <Select
            value={ejercicio.grupoMuscular ?? ""}
            onChange={(e) =>
              onChange({
                ...ejercicio,
                grupoMuscular: (e.target.value || null) as Ejercicio["grupoMuscular"],
              })
            }
            className="py-1.5"
          >
            <option value="">Grupo muscular sin especificar</option>
            {GRUPOS_MUSCULARES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </Select>
          {tecnicas && tecnicas.length > 0 ? (
            <SelectorTecnica
              valor={ejercicio.tecnicaTipo}
              tecnicas={tecnicas}
              onLimpiar={() => onChange({ ...ejercicio, tecnicaTipo: null })}
              onIndividual={(tecnica) => onChange({ ...ejercicio, tecnicaTipo: tecnica.nombre, descansoSegundos: tecnica.descansoFinalSeg ?? ejercicio.descansoSegundos })}
              onEncadenar={(tecnica) => onEncadenar?.(tecnica.nombre, tecnica.cantidadEjercicios ?? 2)}
            />
          ) : (
            <Input
              value={ejercicio.tecnicaTipo ?? ""}
              onChange={(e) => onChange({ ...ejercicio, tecnicaTipo: e.target.value || null })}
              placeholder="Técnica especial (ej: Biserie (1/2))"
              className="py-1.5"
            />
          )}
          {/* Antes solo aparecía con "Técnica especial" cargado (biserie,
              triserie...). La IA ahora también escribe acá una instrucción de
              ejecución para ejercicios sueltos que no tienen ninguna técnica
              con nombre — con la condición vieja, esa instrucción quedaba
              guardada pero invisible en este editor. */}
          <Textarea
            value={ejercicio.tecnicaInstruccion ?? ""}
            onChange={(e) =>
              onChange({ ...ejercicio, tecnicaInstruccion: e.target.value || null })
            }
            placeholder="Instrucción de la técnica"
            rows={2}
            className="py-1.5"
          />
          <Input
            value={ejercicio.observacion ?? ""}
            onChange={(e) => onChange({ ...ejercicio, observacion: e.target.value || null })}
            placeholder="Observación"
            className="py-1.5"
          />

          {/* Impulso VIP: encendido por defecto (ver DEFAULTS_PROGRESION) —
              se apaga puntualmente acá para el ejercicio que no corresponda. */}
          <div className="radius-control border border-border bg-surface-2 px-2.5 py-2">
            <label className="text-caption flex items-center gap-1.5 text-text-secondary">
              <input
                type="checkbox"
                checked={ejercicio.aptoProgresion ?? true}
                onChange={(e) => onChange({ ...ejercicio, aptoProgresion: e.target.checked })}
              />
              Progresión automática (Impulso VIP)
            </label>
            {ejercicio.aptoProgresion && (
              <div className="mt-1.5 space-y-1.5">
                <Select
                  value={ejercicio.tipoProgresion ?? "doble"}
                  onChange={(e) =>
                    onChange({ ...ejercicio, tipoProgresion: e.target.value as TipoProgresionImpulso })
                  }
                  className="py-1.5"
                >
                  {TIPOS_PROGRESION.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center gap-1.5">
                  <label className="text-caption shrink-0 text-text-tertiary">Incremento de carga</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={ejercicio.incrementoKg ?? 5}
                    onChange={(e) => onChange({ ...ejercicio, incrementoKg: Number(e.target.value) })}
                    className="w-16 px-1.5 py-1 text-center"
                  />
                  <span className="text-caption text-text-tertiary">kg</span>
                </div>
                <label className="text-caption flex items-center gap-1.5 text-text-secondary">
                  <input
                    type="checkbox"
                    checked={ejercicio.requiereAutorizacion ?? false}
                    onChange={(e) => onChange({ ...ejercicio, requiereAutorizacion: e.target.checked })}
                  />
                  Requiere mi aprobación para subir peso
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Vista previa editable: cada tarjeta se puede abrir para editar en el
 * lugar (reutiliza `EjercicioForm`, mismo formulario que el editor por día —
 * sin duplicar campos ni validación) y entre cada dos ejercicios aparece un
 * "+" para insertar uno nuevo justo ahí. Pedido explícito del entrenador:
 * "así yo mismo, desde la visualización del ejercicio, puedo arreglar la
 * rutina" — sin sacar el editor por día que ya existía arriba.
 */
export function VistaPreviaEstructurada({
  draft,
  biblioteca,
  onActualizarEjercicio,
  onInsertarEjercicio,
  onQuitarEjercicio,
  expandida = false,
  onAgregarDia,
  onQuitarDia,
  tecnicas,
  onEncadenar,
  onInsertarDescanso,
  onAplicarAGrupo,
  onGenerarAutomatico,
  hallazgos = [],
  diaActivo = 0,
  onCambiarDia,
  nivelArmado = "estandar",
}: {
  draft: RutinaConProgresion;
  biblioteca?: EjercicioBiblioteca[];
  onActualizarEjercicio: (diaIdx: number, ejIdx: number, ejercicio: Ejercicio) => void;
  onInsertarEjercicio: (diaIdx: number, posicion: number) => void;
  onQuitarEjercicio: (diaIdx: number, ejIdx: number) => void;
  /** Modo mesa de trabajo (herramienta de armado manual): sin la caja con
   * scroll propio, para que la rutina se lea entera y a lo ancho de la
   * pantalla. Dentro del generador sigue siendo una vista previa contenida. */
  expandida?: boolean;
  /** Solo en modo expandido: agregar y quitar días desde la misma vista. */
  onAgregarDia?: () => void;
  onQuitarDia?: (diaIdx: number) => void;
  tecnicas?: TecnicaOpcion[];
  onEncadenar?: (diaIdx: number, ejIdx: number, nombre: string, cantidad: number) => void;
  /** Mete un día de descanso en esa posición de la semana. */
  onInsertarDescanso?: (posicion: number) => void;
  /** Series o descanso de todo un grupo del día, de un toque. */
  onAplicarAGrupo?: (diaIdx: number, etiqueta: string, campo: "series" | "descansoSegundos", valor: number) => void;
  /** Varita VIP: completa desde la biblioteca un músculo, la sesión o toda la rutina. */
  onGenerarAutomatico?: (config: ConfigAutomatico) => void;
  /** Semáforo calculado en vivo por la mesa de armado. */
  hallazgos?: HallazgoRutina[];
  /** En la mesa manual se muestra una sola sesión para evitar el scroll. */
  diaActivo?: number;
  onCambiarDia?: (diaIdx: number) => void;
  nivelArmado?: NivelArmado;
}) {
  // Coordenadas de la tarjeta abierta para editar, no el ejercicio en sí:
  // así, al insertar uno nuevo, alcanza con apuntar a su posición para que
  // aparezca ya abierto (ver `insertar` más abajo).
  const [editando, setEditando] = useState<{ dia: number; ej: number } | null>(null);
  const [varitaDia, setVaritaDia] = useState<number | null>(null);
  const [alcanceAutomatico, setAlcanceAutomatico] = useState<AlcanceAutomatico>("grupo");
  const [estiloAutomatico, setEstiloAutomatico] = useState<EstiloAutomatico>("balance_vip");
  const [organizacionAutomatica, setOrganizacionAutomatica] = useState<OrganizacionAutomatica>("por_grupos");
  const [objetivoAutomatico, setObjetivoAutomatico] = useState<ObjetivoAutomatico>("pecho");
  const [incluirCore, setIncluirCore] = useState(false);
  const [tecnicasAutomaticas, setTecnicasAutomaticas] = useState<string[]>([]);
  const [cardioInicio, setCardioInicio] = useState<CardioAutomatico>("ninguno");
  const [cardioInicioMinutos, setCardioInicioMinutos] = useState(10);
  const [cardioFinal, setCardioFinal] = useState<CardioAutomatico>("ninguno");
  const [cardioFinalMinutos, setCardioFinalMinutos] = useState(15);
  const programasDisponibles = programasParaNivel(nivelArmado);

  const elegirPrograma = (programaId: EstiloAutomatico) => {
    const programa = PROGRAMAS_VIP[programaId];
    setEstiloAutomatico(programaId);
    setOrganizacionAutomatica(programa.organizacion);
    setTecnicasAutomaticas(programa.tecnicas.filter((nombre) => (tecnicas ?? []).some((tecnica) => tecnica.nombre === nombre)));
  };

  const insertar = (diaIdx: number, posicion: number) => {
    onInsertarEjercicio(diaIdx, posicion);
    setEditando({ dia: diaIdx, ej: posicion });
  };

  const indicesVisibles = expandida
    ? [Math.min(Math.max(0, diaActivo), Math.max(0, draft.dias.length - 1))]
    : draft.dias.map((_, indice) => indice);

  return (
    <div className={expandida ? "space-y-2" : "max-h-[34rem] space-y-3 overflow-y-auto pr-1"}>
      {!expandida && <p className="text-card-title font-bold text-text">{draft.nombreRutina}</p>}
      {expandida && draft.dias.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {draft.dias.map((dia, indice) => {
            const errores = hallazgos.filter((hallazgo) => hallazgo.diaIndice === indice && hallazgo.severidad === "error").length;
            return (
              <button
                key={`${dia.numero}-${indice}`}
                type="button"
                onClick={() => onCambiarDia?.(indice)}
                aria-pressed={diaActivo === indice}
                className={`radius-control flex shrink-0 items-center gap-1 border px-2 py-1.5 text-[10px] font-semibold ${
                  diaActivo === indice ? "border-[#78a6d1] bg-[#243c55] text-[#d9ecff]" : "border-[#394352] bg-[#1d222c] text-[#b9c2cf]"
                }`}
              >
                <span className={`size-1.5 rounded-full ${errores ? "bg-error" : "bg-success"}`} />
                S{indice + 1} · {dia.nombre || "Sin nombre"}
              </button>
            );
          })}
        </div>
      )}
      {indicesVisibles.map((diaIdx) => {
        const dia = draft.dias[diaIdx];
        const objetivosDia = objetivosMuscularesDia(dia).filter((objetivo) => objetivo !== "core" && objetivo !== "cardio");
        return (
        <Fragment key={`${dia.numero}-${dia.nombre}`}>
        <section id={`rutina-dia-${diaIdx}`} className={`scroll-mt-24 overflow-hidden ${expandida ? "" : "radius-control border border-border"}`}>
          <div className={`flex items-center justify-between gap-2 px-1 py-1.5 ${expandida ? "border-b border-border" : "bg-surface-2"}`}>
            <p className="text-caption truncate font-bold text-[#6f9bc6]">SESIÓN {dia.numero} · {dia.nombre}</p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-micro text-text-tertiary">
                {dia.tipo === "descanso" ? "Descanso" : `${dia.ejercicios.length} ejercicios`}
              </span>
              {onGenerarAutomatico && dia.tipo === "entrenamiento" && (
                <button
                  type="button"
                  onClick={() => {
                    setObjetivoAutomatico(objetivosDia[0] ?? "pecho");
                    const programaActualDisponible = programasDisponibles.some(([id]) => id === estiloAutomatico);
                    if (!programaActualDisponible && programasDisponibles[0]) elegirPrograma(programasDisponibles[0][0]);
                    setVaritaDia((actual) => actual === diaIdx ? null : diaIdx);
                  }}
                  aria-label={`Generar ejercicios automáticamente para ${dia.nombre}`}
                  className="flex items-center gap-1 rounded-lg border border-[#587c9c] bg-[#203246] px-2 py-1 text-[10px] font-semibold text-[#cde7ff]"
                >
                  <WandSparkles size={12} /> Generar
                </button>
              )}
              {onQuitarDia && draft.dias.length > 1 && (
                <button
                  type="button"
                  onClick={() => onQuitarDia(diaIdx)}
                  aria-label={`Quitar el día ${dia.numero}`}
                  title="Quitar este día"
                  className="grid size-6 place-items-center rounded-full border border-border text-text-tertiary active:bg-error active:text-white"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          {/* Series y descanso de todo un grupo del día, de un toque, en vez de
              abrir ejercicio por ejercicio. Los valores son los que se usan de
              verdad en sala; el que quiera otro sigue teniendo el lápiz. */}
          {onAplicarAGrupo && dia.tipo === "entrenamiento" && dia.ejercicios.length > 0 && (
            <details className="border-b border-border">
              <summary className="cursor-pointer px-1 py-1.5 text-[10px] font-semibold text-text-tertiary">
                Ajustes rápidos por grupo
              </summary>
              <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2">
              {Array.from(new Set(dia.ejercicios.map((e) => grupoVisual(e).etiqueta))).map((etiqueta) => {
                const color = dia.ejercicios.map(grupoVisual).find((v) => v.etiqueta === etiqueta)?.color;
                return (
                  <div key={etiqueta} className="flex items-center gap-1">
                    <span className="text-[9px] font-bold uppercase" style={{ color }}>
                      {etiqueta}
                    </span>
                    <select
                      aria-label={`Series de todo ${etiqueta} en el día ${dia.numero}`}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) onAplicarAGrupo(diaIdx, etiqueta, "series", Number(e.target.value));
                        e.target.value = "";
                      }}
                      className="radius-control border border-border bg-surface-2 px-1 py-0.5 text-[10px] text-text-secondary"
                    >
                      <option value="">series…</option>
                      {[2, 3, 4, 5, 6].map((s) => (
                        <option key={s} value={s}>
                          {s} series
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Descanso de todo ${etiqueta} en el día ${dia.numero}`}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          onAplicarAGrupo(diaIdx, etiqueta, "descansoSegundos", Number(e.target.value));
                        e.target.value = "";
                      }}
                      className="radius-control border border-border bg-surface-2 px-1 py-0.5 text-[10px] text-text-secondary"
                    >
                      <option value="">descanso…</option>
                      {[30, 45, 60, 90, 120, 150, 180].map((s) => (
                        <option key={s} value={s}>
                          {s}s
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              </div>
            </details>
          )}
          {dia.descripcion && <p className="text-micro border-t border-border px-2.5 py-1.5 text-text-tertiary">{dia.descripcion}</p>}
          {onGenerarAutomatico && varitaDia === diaIdx && dia.tipo === "entrenamiento" && (
            <div className="space-y-3 border-b border-[#303846] bg-[#151922] px-2.5 py-3 text-[#f4f7fb]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-caption font-semibold text-white">Varita VIP</p>
                <p className="text-[10px] text-[#a8b2c1]">Nivel: {NIVELES_ARMADO[nivelArmado].etiqueta}</p>
              </div>
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase text-[#a8b2c1]">Qué quieres completar</p>
                <div className="grid grid-cols-3 gap-1">
                  {([ ["grupo", "Un músculo"], ["sesion", "Esta sesión"], ["rutina", "Rutina completa"] ] as const).map(([valor, etiqueta]) => (
                    <button key={valor} type="button" onClick={() => setAlcanceAutomatico(valor)} aria-pressed={alcanceAutomatico === valor} className={`radius-control border px-1 py-2 text-[10px] font-semibold ${alcanceAutomatico === valor ? "border-[#78a6d1] bg-[#243c55] text-[#d9ecff]" : "border-[#394352] bg-[#1d222c] text-[#b9c2cf]"}`}>
                      {etiqueta}
                    </button>
                  ))}
                </div>
              </div>
              {alcanceAutomatico === "grupo" && (
                <label className="block">
                  <span className="mb-1 block text-[9px] font-semibold uppercase text-[#a8b2c1]">Grupo muscular</span>
                  <select value={objetivoAutomatico} onChange={(evento) => setObjetivoAutomatico(evento.target.value as ObjetivoAutomatico)} className="radius-control w-full border border-[#394352] bg-[#1d222c] px-2 py-2 text-caption text-white">
                    {(objetivosDia.length > 0 ? objetivosDia : ["pecho", "espalda", "piernas", "hombros", "biceps", "triceps"] as ObjetivoAutomatico[]).map((objetivo) => <option key={objetivo} value={objetivo}>{ETIQUETA_OBJETIVO[objetivo]}</option>)}
                  </select>
                </label>
              )}
              <div>
                <p className="mb-1 text-[9px] font-semibold uppercase text-[#a8b2c1]">Programa VIP · compatible con {NIVELES_ARMADO[nivelArmado].etiqueta}</p>
                <select value={estiloAutomatico} onChange={(evento) => elegirPrograma(evento.target.value as EstiloAutomatico)} className="radius-control w-full border border-[#394352] bg-[#1d222c] px-2 py-2 text-caption text-white">
                  {programasDisponibles.map(([valor, programa]) => <option key={valor} value={valor}>{programa.nombre}</option>)}
                </select>
                <p className="mt-1 text-[9px] text-[#9eabbc]">{PROGRAMAS_VIP[estiloAutomatico].descripcion}</p>
              </div>
              {alcanceAutomatico !== "grupo" && (
                <div>
                  <p className="mb-1 text-[9px] font-semibold uppercase text-[#a8b2c1]">Orden de los ejercicios</p>
                  <div className="grid grid-cols-3 gap-1">
                    {([ ["por_grupos", "Por grupos"], ["alternado", "Alternado"], ["biseries", "Biseries A/A"] ] as const).map(([valor, etiqueta]) => (
                      <button key={valor} type="button" onClick={() => setOrganizacionAutomatica(valor)} aria-pressed={organizacionAutomatica === valor} title={valor === "biseries" ? "Biseries agonista-antagonista: un ejercicio de cada grupo, sin descanso entre ambos" : undefined} className={`radius-control border px-1 py-2 text-[10px] font-semibold ${organizacionAutomatica === valor ? "border-[#9b8bc7] bg-[#352d4b] text-[#eee7ff]" : "border-[#394352] bg-[#1d222c] text-[#b9c2cf]"}`}>
                        {etiqueta}
                      </button>
                    ))}
                  </div>
                  {organizacionAutomatica === "biseries" && <p className="mt-1 text-[9px] text-[#b9aecf]">Une dos grupos como biserie agonista-antagonista y descansa al cerrar cada pareja.</p>}
                </div>
              )}
              <details className="radius-control border border-[#394352] bg-[#1d222c]">
                <summary className="cursor-pointer px-2 py-2 text-caption font-semibold text-[#d9dfe8]">Técnicas de intensidad · {tecnicasAutomaticas.length ? `${tecnicasAutomaticas.length} elegidas` : "ninguna"}</summary>
                <div className="flex flex-wrap gap-1.5 border-t border-[#303846] p-2">
                  {(tecnicas ?? []).filter((tecnica) => tecnica.tipo === "individual").map((tecnica) => {
                    const activa = tecnicasAutomaticas.includes(tecnica.nombre);
                    return <button key={tecnica.nombre} type="button" aria-pressed={activa} onClick={() => setTecnicasAutomaticas((actuales) => activa ? actuales.filter((nombre) => nombre !== tecnica.nombre) : [...actuales, tecnica.nombre])} className={`radius-control border px-2 py-1.5 text-[10px] font-semibold ${activa ? "border-[#75a99a] bg-[#203c36] text-[#d9fff2]" : "border-[#394352] bg-[#151922] text-[#aeb8c6]"}`}>{tecnica.nombre}</button>;
                  })}
                  <p className="w-full text-[9px] text-[#8f9aaa]">Las biseries se eligen arriba en “Orden”; aquí eliges drop set, fallo, rest-pause y las demás técnicas individuales.</p>
                </div>
              </details>
              <div className="grid grid-cols-2 gap-2">
                {([ ["inicio", cardioInicio, setCardioInicio, cardioInicioMinutos, setCardioInicioMinutos], ["final", cardioFinal, setCardioFinal, cardioFinalMinutos, setCardioFinalMinutos] ] as const).map(([posicion, modalidad, cambiarModalidad, minutos, cambiarMinutos]) => (
                  <div key={posicion} className="radius-control border border-[#394352] bg-[#1d222c] p-2">
                    <p className="mb-1 text-[9px] font-semibold uppercase text-[#a8b2c1]">Cardio al {posicion}</p>
                    <select value={modalidad} onChange={(evento) => cambiarModalidad(evento.target.value as CardioAutomatico)} className="w-full rounded-md border border-[#465263] bg-[#151922] px-1.5 py-1.5 text-[10px] text-white">
                      <option value="ninguno">Ninguno</option><option value="bicicleta">Bicicleta</option><option value="spinning">Spinning</option>
                    </select>
                    {modalidad !== "ninguno" && <label className="mt-1 flex items-center justify-between gap-1 text-[9px] text-[#a8b2c1]">Minutos <input type="number" min={3} max={60} value={minutos} onChange={(evento) => cambiarMinutos(Math.min(60, Math.max(3, Number(evento.target.value) || 3)))} className="w-14 rounded-md border border-[#465263] bg-[#151922] px-1.5 py-1 text-right text-[10px] text-white" /></label>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <label className="text-caption flex items-center gap-1.5 text-[#c8d0dc]"><input type="checkbox" checked={incluirCore} onChange={(evento) => setIncluirCore(evento.target.checked)} /> Core {alcanceAutomatico === "rutina" ? "2×/sem" : "al final"}</label>
              </div>
              <Button size="xs" className="w-full !bg-[#466f91] !text-white" onClick={() => {
                onGenerarAutomatico({ diaIndice: diaIdx, alcance: alcanceAutomatico, objetivo: objetivoAutomatico, estilo: estiloAutomatico, organizacion: organizacionAutomatica, incluirCore, tecnicasPermitidas: tecnicasAutomaticas, cardioInicio, cardioInicioMinutos, cardioFinal, cardioFinalMinutos });
                setVaritaDia(null);
              }}>
                <WandSparkles size={14} /> Generar borrador
              </Button>
            </div>
          )}
          {dia.tipo === "entrenamiento" && (
            <div className="divide-y divide-border">
              {dia.ejercicios.map((ejercicio, indice) => {
                const visual = grupoVisual(ejercicio);
                const colorTecnica = colorTecnicaVisual(ejercicio.tecnicaTipo);
                const abierto = editando?.dia === diaIdx && editando.ej === indice;
                const conError = hallazgos.some((hallazgo) => hallazgo.diaIndice === diaIdx && hallazgo.ejercicioIndices.includes(indice));
                return (
                  <div key={`${dia.numero}-${indice}-${ejercicio.nombre}`} className="relative">
                    {abierto ? (
                      <div className="radius-control border border-[#455363] bg-[#191e27] p-2">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-micro font-semibold text-[#8fb7d8]">Editando ejercicio {indice + 1}</span>
                          <button
                            type="button"
                            onClick={() => setEditando(null)}
                            className="text-micro flex items-center gap-1 font-semibold text-[#8fb7d8]"
                          >
                            <Check size={13} /> Listo
                          </button>
                        </div>
                        <EjercicioForm
                          numero={indice + 1}
                          ejercicio={ejercicio}
                          gruposSugeridos={gruposPlanificados(dia)}
                          biblioteca={biblioteca}
                          tecnicas={tecnicas}
                          onEncadenar={
                            onEncadenar ? (nombre, cantidad) => onEncadenar(diaIdx, indice, nombre, cantidad) : undefined
                          }
                          onChange={(e) => onActualizarEjercicio(diaIdx, indice, e)}
                          nivelArmado={nivelArmado}
                          onRemove={() => {
                            onQuitarEjercicio(diaIdx, indice);
                            setEditando(null);
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className={`relative bg-surface py-2 pl-2 pr-0.5 ${conError ? "bg-error/5" : ""}`}
                        style={{ boxShadow: `inset 3px 0 0 ${conError ? "var(--color-error)" : visual.color}` }}
                      >
                        <div className="flex min-w-0 items-center gap-1.5 pl-1">
                          <span className="text-micro w-4 shrink-0 text-right font-semibold text-text-tertiary">{indice + 1}.</span>
                          <strong className="text-caption min-w-0 flex-1 truncate" style={{ color: visual.color, fontWeight: 800 }}>
                            {ejercicio.nombre}
                          </strong>
                          <span className="text-[9px] shrink-0 text-text-secondary">
                            {ejercicio.series}×{ejercicio.reps} · {ejercicio.descansoSegundos ?? 0}s
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditando({ dia: diaIdx, ej: indice })}
                            aria-label={`Editar ${ejercicio.nombre}`}
                            className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-text-tertiary active:bg-[#2f6fa8] active:text-white"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        {ejercicio.tecnicaTipo && (
                          <p className="text-[10px] mt-0.5 truncate pl-6 font-semibold" style={{ color: colorTecnica ?? "var(--color-vip)" }}>
                            {ejercicio.tecnicaTipo}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Inserta uno nuevo justo entre esta tarjeta y la
                        siguiente — pedido explícito: "una flechita... para
                        sumar un ejercicio nuevo entre ese ejercicio y el que
                        le sigue". */}
                    <button
                      type="button"
                      onClick={() => insertar(diaIdx, indice + 1)}
                      aria-label={`Agregar ejercicio después de ${ejercicio.nombre}`}
                      title="Agregar ejercicio aquí"
                      className="absolute -bottom-2.5 right-2 z-[1] grid size-5 place-items-center rounded-full border border-[#6f9bc6] bg-surface text-[#4f83b7] shadow-sm active:bg-[#2f6fa8] active:text-white"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                );
              })}
              {dia.ejercicios.length === 0 && (
                <button
                  type="button"
                  onClick={() => insertar(diaIdx, 0)}
                  className="radius-control flex w-full items-center justify-center gap-1.5 border border-dashed border-[#587c9c] bg-[#19232e] py-2.5 text-caption font-semibold text-[#9fc4e3]"
                >
                  <Plus size={14} /> Agregar el primer ejercicio del día
                </button>
              )}
              {dia.ejercicios.length > 0 && (
                <button
                  type="button"
                  onClick={() => insertar(diaIdx, dia.ejercicios.length)}
                  className="flex w-full items-center justify-center gap-1 py-2.5 text-caption font-semibold text-[#4f83b7]"
                >
                  <Plus size={13} /> Añadir ejercicio
                </button>
              )}
            </div>
          )}
        </section>
        {/* Descanso EN ESTE PUNTO de la semana, no al final: entre el día 1 y
            el 2, o entre el 3 y el 4, donde el entrenador lo necesite. */}
        {onInsertarDescanso && (
          <button
            type="button"
            onClick={() => onInsertarDescanso(diaIdx + 1)}
            className="text-micro flex w-full items-center justify-center gap-1.5 py-1 font-medium text-text-tertiary"
          >
            <Plus size={12} /> Descanso después del día {dia.numero}
          </button>
        )}
        </Fragment>
      );})}
      {onAgregarDia && (
        <button
          type="button"
          onClick={onAgregarDia}
          className="radius-control flex w-full items-center justify-center gap-1.5 border border-dashed border-[#587c9c] bg-[#19232e] py-3 text-caption font-semibold text-[#9fc4e3]"
        >
          <Plus size={15} /> Agregar otro día
        </button>
      )}
      <p className="text-caption text-right font-semibold text-text-secondary">— Alejandro Mendoza · Método VIP Fitness</p>
    </div>
  );
}

function SemaforoCalidad({
  hallazgos,
  onIr,
}: {
  hallazgos: HallazgoRutina[];
  onIr: (hallazgo: HallazgoRutina) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const errores = hallazgos.filter((hallazgo) => hallazgo.severidad === "error");

  return (
    <div className={`sticky top-2 z-20 overflow-hidden rounded-xl border shadow-lg backdrop-blur ${
      errores.length > 0 ? "border-[#75434a] bg-[#251a1e]" : "border-[#3e695a] bg-[#182620]"
    }`}>
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        aria-expanded={abierto}
      >
        {errores.length > 0 ? <AlertTriangle size={15} className="shrink-0 text-error" /> : <CircleCheckBig size={15} className="shrink-0 text-success" />}
        <span className="text-caption min-w-0 flex-1 truncate font-bold text-[#eef2f7]">
          Semáforo VIP · {errores.length > 0 ? `${errores.length} ${errores.length === 1 ? "ajuste pendiente" : "ajustes pendientes"}` : "lista para publicar"}
        </span>
        <span className={`text-micro font-semibold ${errores.length > 0 ? "text-error" : "text-success"}`}>
          {abierto ? "Ocultar" : errores.length > 0 ? "Ver" : "Correcta"}
        </span>
      </button>
      {abierto && errores.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto border-t border-[#55343a] p-2">
          {errores.map((hallazgo, indice) => (
            <button
              key={`${hallazgo.codigo}-${hallazgo.diaIndice ?? "semana"}-${indice}`}
              type="button"
              onClick={() => onIr(hallazgo)}
              className="radius-control flex w-full gap-2 border border-[#633c43] bg-[#1d171a] px-2 py-1.5 text-left"
            >
              <span className="text-[10px] mt-0.5 shrink-0 font-bold text-error">
                {hallazgo.diaIndice === null ? "SEMANA" : `S${hallazgo.diaIndice + 1}`}
              </span>
              <span className="text-micro line-clamp-2 flex-1 text-[#5d5260]">{hallazgo.mensaje}</span>
              {hallazgo.diaIndice !== null && <span className="text-micro shrink-0 font-semibold text-[#2f6fa8]">Ir</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editor de la rutina que extrajo la IA, antes de publicarla.
 *
 * Recibe una LISTA de alumnos, no uno solo: desde la sección Documentos el
 * mismo PDF se analiza una vez y se publica a todos los que se marcaron. Desde
 * el perfil de un alumno se le pasa una lista de uno. */
export function RutinaDraftEditor({
  alumnoIds,
  draftInicial,
  onDescartar,
  ejercicios,
  onRevisar,
  mesaDeTrabajo = false,
  tecnicas,
  planInicial,
  nivelArmado = "estandar",
}: {
  /** Herramienta de armado manual: la vista previa deja de ser una vista y
   * pasa a ser la mesa de trabajo — a lo ancho, siempre abierta y con los
   * botones de agregar y quitar día adentro. Se esconde el editor por día
   * (la lista de tarjetas colapsables), porque en este modo sería el mismo
   * trabajo dos veces. Todo lo demás —publicar, plan del alumno, revisión con
   * IA— es exactamente el mismo camino que ya usa el generador. */
  mesaDeTrabajo?: boolean;
  /** Técnicas reales del gimnasio. Si no llegan, el campo de técnica sigue
   * siendo texto libre como antes — ninguna pantalla se rompe por no pasarlas. */
  tecnicas?: TecnicaOpcion[];
  /** En armado manual se hereda del alumno; solo se pregunta si el grupo
   * seleccionado mezcla planes distintos o no tiene uno asignado. */
  planInicial?: CodigoPlanEntrenamiento;
  /** Ajusta únicamente las fórmulas sugeridas al elegir una fila vacía. */
  nivelArmado?: NivelArmado;
  alumnoIds: string[];
  draftInicial: RutinaExtraida;
  onDescartar: () => void;
  /** Biblioteca real para elegir ejercicios tocando en vez de escribiendo.
   * Opcional — sin esto, el nombre sigue siendo texto libre (compatibilidad
   * con llamadores que todavía no la pasan). */
  ejercicios?: EjercicioBiblioteca[];
  /** Sin esto no aparece el panel de revisión: el editor sigue funcionando
   * igual que siempre para las rutinas importadas de PDF. */
  onRevisar?: RevisarRutinaFn;
}) {
  const patronPorEjercicio = new Map((ejercicios ?? []).map((ejercicio) => [ejercicio.id, ejercicio.patronMovimiento ?? null]));
  // `draftInicial` viene de la extracción por IA (`RutinaExtraida` plano,
  // sin config de progresión — eso nunca lo decide la IA). Se completan acá
  // los defaults de Impulso VIP por ejercicio, para que quede prendido de
  // entrada y no solo "se vea prendido" en el checkbox sin estarlo de
  // verdad al publicar (ver DEFAULTS_PROGRESION más arriba).
  const [draft, setDraft] = useState<RutinaConProgresion>(() => ({
    ...draftInicial,
    metodoGeneracion: draftInicial.metodoGeneracion ?? {
      nivel: NIVELES_ARMADO[nivelArmado].etiqueta,
      inspiracion: "Armado manual VIP",
      organizacion: "Definida por el entrenador",
      generadoAutomaticamente: false,
    },
    dias: draftInicial.dias.map((dia) => ({
      ...dia,
      ejercicios: dia.ejercicios.map((ej) => ({
        ...DEFAULTS_PROGRESION,
        ...ej,
        patronMovimiento: ej.ejercicioId ? patronPorEjercicio.get(ej.ejercicioId) ?? patronMovimiento(ej.nombre, ej.grupoMuscular) : patronMovimiento(ej.nombre, ej.grupoMuscular),
      })),
    })),
  }));
  const [publicando, setPublicando] = useState(false);
  const [planCodigo, setPlanCodigo] = useState<CodigoPlanEntrenamiento | "">(planInicial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [versionDesactualizada, setVersionDesactualizada] = useState(false);
  const [respaldoCopiado, setRespaldoCopiado] = useState(false);
  const [publicado, setPublicado] = useState(false);
  const [fallidos, setFallidos] = useState<{ nombre: string; error: string }[]>([]);
  const [publicados, setPublicados] = useState(0);
  const [mostrarPreview, setMostrarPreview] = useState(true);
  const [revision, setRevision] = useState<RevisionResuelta | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [errorRevision, setErrorRevision] = useState<string | null>(null);
  const [aplicados, setAplicados] = useState<Set<number>>(() => new Set());
  const [diaActivo, setDiaActivo] = useState(0);
  const hallazgosEstructura = useMemo(
    () => detectarHallazgosRutina(draft.dias.map((dia) => ({
      nombre: dia.nombre,
      tipo: dia.tipo,
      ejercicios: dia.ejercicios.map((ejercicio) => ({
        nombre: ejercicio.nombre,
        series: ejercicio.series,
        grupoMuscular: ejercicio.grupoMuscular,
        patronMovimiento: ejercicio.patronMovimiento,
      })),
    }))),
    [draft]
  );
  const hallazgos: HallazgoRutina[] = planCodigo
    ? hallazgosEstructura
    : [{
        codigo: "plan_sin_elegir",
        mensaje: "Selecciona el plan principal antes de publicar.",
        severidad: "error",
        diaIndice: null,
        ejercicioIndices: [],
      }, ...hallazgosEstructura];
  const erroresCalidad = hallazgos.filter((hallazgo) => hallazgo.severidad === "error");

  const irAHallazgo = (hallazgo: HallazgoRutina) => {
    if (hallazgo.diaIndice === null) return;
    setDiaActivo(hallazgo.diaIndice);
    requestAnimationFrame(() => {
      document.getElementById(`rutina-dia-${hallazgo.diaIndice}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  // Mismo texto que se guarda como documento del alumno al publicar (ver
  // guardarRutinaComoDocumento en archivos/actions.ts) — pedido explícito:
  // "permíteme verlo antes de llevarlo al alumno y yo confirmarlo".
  const previewTexto = useMemo(() => serializarRutinaATexto(draft), [draft]);
  // Colapsados por defecto: con 5-6 días de varios ejercicios cada uno, tenerlos
  // todos abiertos a la vez era un scroll interminable. Se abren de a uno (o
  // todos con el botón de arriba) para revisar sin perder el resto de vista.
  const [diasAbiertos, setDiasAbiertos] = useState<Set<number>>(() => new Set());
  const alternarDia = (diaIdx: number) => {
    setDiasAbiertos((s) => {
      const copia = new Set(s);
      if (copia.has(diaIdx)) copia.delete(diaIdx);
      else copia.add(diaIdx);
      return copia;
    });
  };
  const todosAbiertos = diasAbiertos.size === draft.dias.length && draft.dias.length > 0;

  const actualizarDia = (diaIdx: number, cambios: Partial<Dia>) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) => (i === diaIdx ? { ...dia, ...cambios } : dia)),
    }));
  };

  const actualizarEjercicio = (diaIdx: number, ejIdx: number, ejercicio: Ejercicio) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i === diaIdx
          ? { ...dia, ejercicios: dia.ejercicios.map((e, j) => (j === ejIdx ? ejercicio : e)) }
          : dia
      ),
    }));
  };

  /** Inserta un ejercicio vacío EN una posición puntual del día, a diferencia
   * de `agregarEjercicio` que siempre suma al final. Lo usa el "+" de la
   * vista previa para meter un ejercicio nuevo entre dos existentes sin tener
   * que agregarlo al final y arrastrarlo a mano. */
  const insertarEjercicio = (diaIdx: number, posicion: number) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) => {
        if (i !== diaIdx) return dia;
        const ejercicios = [...dia.ejercicios];
        ejercicios.splice(posicion, 0, { ...EJERCICIO_VACIO });
        return { ...dia, ejercicios };
      }),
    }));
  };

  /** Aplica una técnica encadenada a partir de un ejercicio: etiqueta los
   * `cantidad` ejercicios seguidos con la numeración que espera el resto de la
   * app ("Biserie (1/2)", "Biserie (2/2)") y, si no hay suficientes por
   * delante, crea los que falten vacíos para que el entrenador los elija de la
   * biblioteca. Es lo que pidió: al elegir la técnica, que aparezcan los
   * espacios de ejercicio que esa técnica necesita. */
  const encadenarTecnica = (diaIdx: number, ejIdx: number, nombre: string, cantidad: number) => {
    const formato = tecnicas?.find((tecnica) => tecnica.nombre === nombre);
    const descansoInterno = formato?.descansoInternoSeg ?? 0;
    const descansoFinal = formato?.descansoFinalSeg ?? 90;
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) => {
        if (i !== diaIdx) return dia;
        const ejercicios = [...dia.ejercicios];
        while (ejercicios.length < ejIdx + cantidad) ejercicios.push({ ...EJERCICIO_VACIO });
        for (let paso = 0; paso < cantidad; paso++) {
          ejercicios[ejIdx + paso] = {
            ...ejercicios[ejIdx + paso],
            tecnicaTipo: `${nombre} (${paso + 1}/${cantidad})`,
            // El formato vive en el catálogo: una biserie/triserie queda
            // correctamente armada con un toque, no solo coloreada.
            descansoSegundos: paso === cantidad - 1 ? descansoFinal : descansoInterno,
          };
        }
        return { ...dia, ejercicios: ejercicios.map((e, orden) => ({ ...e, orden: orden + 1 })) };
      }),
    }));
  };

  const agregarEjercicio = (diaIdx: number) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i === diaIdx ? { ...dia, ejercicios: [...dia.ejercicios, { ...EJERCICIO_VACIO }] } : dia
      ),
    }));
  };

  const quitarEjercicio = (diaIdx: number, ejIdx: number) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i === diaIdx ? { ...dia, ejercicios: dia.ejercicios.filter((_, j) => j !== ejIdx) } : dia
      ),
    }));
  };

  const moverDia = (diaIdx: number, direccion: -1 | 1) => {
    setDraft((d) => {
      const nuevos = [...d.dias];
      const destino = diaIdx + direccion;
      if (destino < 0 || destino >= nuevos.length) return d;
      [nuevos[diaIdx], nuevos[destino]] = [nuevos[destino], nuevos[diaIdx]];
      return { ...d, dias: nuevos };
    });
  };

  const quitarDia = (diaIdx: number) => {
    setDraft((d) => ({ ...d, dias: d.dias.filter((_, i) => i !== diaIdx) }));
  };

  /** Ubica el ejercicio al que apunta un cambio de la IA. Primero por posición
   * (`orden`), pero verificando el nombre: si el entrenador ya movió, quitó o
   * cambió ejercicios desde que se hizo la revisión, el índice deja de valer y
   * hay que buscar por nombre. Si no aparece de ninguna forma, el cambio no se
   * aplica — antes que tocar el ejercicio equivocado, no tocar nada. */
  const ubicarEjercicio = (dia: Dia, cambio: CambioResuelto): number => {
    const igual = (a: string, b: string) =>
      a.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "") ===
      b.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const porOrden = cambio.orden - 1;
    if (dia.ejercicios[porOrden] && igual(dia.ejercicios[porOrden].nombre, cambio.ejercicioActual)) return porOrden;
    return dia.ejercicios.findIndex((e) => igual(e.nombre, cambio.ejercicioActual));
  };

  // Se calcula fuera de `setDraft` a propósito: el updater de React corre
  // después, así que si se marcaba lo aplicado adentro, el `setAplicados` de
  // abajo leía una lista todavía vacía. El cambio se aplicaba al borrador pero
  // el botón seguía diciendo "Aplicar" — y aplicarlo de nuevo, en un cambio de
  // tipo "quitar", borraba un segundo ejercicio.
  const aplicarCambios = (indices: number[]) => {
    if (!revision) return;
    const aplicadosAhora: number[] = [];
    let dias = draft.dias;
    for (const indice of indices) {
      const cambio = revision.cambios[indice];
      if (!cambio || aplicados.has(indice)) continue;
      const diaIdx = dias.findIndex((dia) => dia.numero === cambio.dia);
      if (diaIdx === -1) continue;
      const ejIdx = ubicarEjercicio(dias[diaIdx], cambio);
      if (ejIdx === -1) continue;
      if (cambio.accion === "reemplazar" && !cambio.ejercicioId) continue;

      aplicadosAhora.push(indice);
      dias = dias.map((dia, i) => {
          if (i !== diaIdx) return dia;
          if (cambio.accion === "quitar") {
            return { ...dia, ejercicios: dia.ejercicios.filter((_, j) => j !== ejIdx) };
          }
          return {
            ...dia,
            ejercicios: dia.ejercicios.map((ej, j) => {
              if (j !== ejIdx) return ej;
              const base =
                cambio.accion === "reemplazar"
                  ? {
                      ...ej,
                      nombre: cambio.reemplazoNombre ?? ej.nombre,
                      ejercicioId: cambio.ejercicioId,
                      grupoMuscular: cambio.grupoMuscular ?? ej.grupoMuscular,
                    }
                  : ej;
              // Solo pisa lo que la IA mandó con valor: los null significan
              // "esto no lo toco", no "déjalo vacío".
              return {
                ...base,
                series: cambio.series ?? base.series,
                reps: cambio.reps ?? base.reps,
                descansoSegundos: cambio.descansoSegundos ?? base.descansoSegundos,
                tecnicaTipo: cambio.tecnicaTipo ?? base.tecnicaTipo,
                tecnicaInstruccion: cambio.tecnicaInstruccion ?? base.tecnicaInstruccion,
              };
            }),
          };
      });
    }
    if (aplicadosAhora.length > 0) {
      setDraft((d) => ({ ...d, dias }));
      setAplicados((s) => {
        const copia = new Set(s);
        for (const i of aplicadosAhora) copia.add(i);
        return copia;
      });
    }
  };

  const revisar = async () => {
    if (!onRevisar) return;
    setRevisando(true);
    setErrorRevision(null);
    try {
      const resultado = await onRevisar(draft);
      if (resultado.ok) {
        setRevision(resultado.revision);
        // Una revisión nueva se juzga sola: los "aplicado" de la anterior ya
        // no corresponden a estos cambios.
        setAplicados(new Set());
      } else {
        setErrorRevision(resultado.error);
      }
    } catch (e) {
      setErrorRevision(
        `No se pudo revisar: ${e instanceof Error ? e.message : "error inesperado"}. Puedes publicar igual.`
      );
    } finally {
      setRevisando(false);
    }
  };

  const agregarDia = () => {
    setDraft((d) => ({
      ...d,
      dias: [
        ...d.dias,
        {
          numero: d.dias.length + 1,
          nombre: `Día ${d.dias.length + 1}`,
          tipo: "entrenamiento",
          descripcion: null,
          ejercicios: [],
        },
      ],
    }));
  };

  /** Mete un día de descanso en una posición concreta de la semana — entre el
   * 1 y el 2, o entre el 3 y el 4, donde el entrenador lo quiera. El tipo
   * "descanso" ya existía en el modelo y la vista previa ya sabía dibujarlo;
   * lo único que faltaba era poder agregarlo. Los días se renumeran solos para
   * que el alumno vea la semana corrida. */
  const insertarDescanso = (posicion: number) => {
    setDraft((d) => {
      const dias = [...d.dias];
      dias.splice(posicion, 0, {
        numero: posicion + 1,
        nombre: "Descanso",
        tipo: "descanso",
        descripcion: null,
        ejercicios: [],
      });
      return { ...d, dias: dias.map((dia, i) => ({ ...dia, numero: i + 1 })) };
    });
  };

  /** Cambia series o descanso de TODOS los ejercicios de un grupo dentro de un
   * día, de un toque. Pedido textual: "en el día de pecho, un botón general de
   * descanso para el músculo de pecho... me estás poniendo a editar muchos
   * campos, quiero todo mucho más fácil". Agrupa por la etiqueta visual, así
   * que bíceps y tríceps se tocan por separado aunque la base los guarde
   * juntos como "brazos". */
  const aplicarAGrupo = (diaIdx: number, etiqueta: string, campo: "series" | "descansoSegundos", valor: number) => {
    setDraft((d) => ({
      ...d,
      dias: d.dias.map((dia, i) =>
        i !== diaIdx
          ? dia
          : {
              ...dia,
              ejercicios: dia.ejercicios.map((e) =>
                grupoVisual(e).etiqueta === etiqueta ? { ...e, [campo]: valor } : e
              ),
            }
      ),
    }));
  };

  /** Varita VIP: no inventa ejercicios ni reemplaza el trabajo del entrenador.
   * Completa hasta 3–4 opciones por músculo usando exclusivamente la biblioteca,
   * diversidad de patrones y la prescripción del nivel elegido. */
  const generarAutomaticamente = (config: ConfigAutomatico) => {
    const biblioteca = ejercicios ?? [];
    if (biblioteca.length === 0) {
      setError("La biblioteca de ejercicios está vacía. Agrega ejercicios a la galería antes de usar la Varita VIP.");
      return;
    }
    setError(null);
    const advertenciasCobertura: string[] = [];
    const actual = draft;
    const siguiente = (() => {
      const indicesEntrenamiento = actual.dias
        .map((dia, indice) => dia.tipo === "entrenamiento" ? indice : -1)
        .filter((indice) => indice >= 0);
      const indicesObjetivo = config.alcance === "rutina" ? indicesEntrenamiento : [config.diaIndice];
      const indicesRemate = config.alcance === "rutina" ? indicesObjetivo.slice(-2) : indicesObjetivo;
      const cantidadPrincipal = ["balance_vip", "nueva_escuela", "heavy_duty", "ppl", "powerbuilding"].includes(config.estilo) ? 3 : 4;

      const crearCardio = (modalidad: Exclude<CardioAutomatico, "ninguno">, minutos: number, posicion: "inicio" | "final"): Ejercicio | null => {
        const candidatos = opcionesBibliotecaParaObjetivo(biblioteca, "cardio");
        const normalizar = (valor: string) => valor.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
        const elegido = modalidad === "spinning"
          ? candidatos.find(({ ejercicio }) => /spinning/.test(normalizar(ejercicio.nombre)))
          : candidatos.find(({ ejercicio }) => /bicicleta|bike/.test(normalizar(ejercicio.nombre)) && !/spinning/.test(normalizar(ejercicio.nombre)))
            ?? candidatos.find(({ ejercicio }) => /bicicleta|bike/.test(normalizar(ejercicio.nombre)));
        if (!elegido) {
          advertenciasCobertura.push(`No existe ${modalidad === "spinning" ? "spinning" : "bicicleta"} clasificada como cardio en la biblioteca.`);
          return null;
        }
        return {
          ...EJERCICIO_VACIO,
          orden: 0,
          nombre: elegido.ejercicio.nombre,
          ejercicioId: elegido.ejercicio.id,
          grupoMuscular: "cardio",
          patronMovimiento: "cardio",
          series: 1,
          reps: `${minutos} min`,
          descansoSegundos: 0,
          observacion: `Cardio al ${posicion} · ${minutos} minutos.`,
        };
      };

      const diasNuevos = actual.dias.map((dia, diaIndice) => {
        if (!indicesObjetivo.includes(diaIndice) || dia.tipo !== "entrenamiento") return dia;
        const principales = config.alcance === "grupo"
          ? [config.objetivo]
          : objetivosMuscularesDia(dia).filter((objetivo) => objetivo !== "core" && objetivo !== "cardio");
        const objetivos = [...principales];
        if (config.incluirCore && indicesRemate.includes(diaIndice) && !objetivos.includes("core")) objetivos.push("core");

        const ejerciciosDia = [...dia.ejercicios];
        const porObjetivo = new Map<ObjetivoAutomatico, Ejercicio[]>(objetivos.map((objetivo) => [objetivo, []]));
        const fueraDelPlan: Ejercicio[] = [];
        for (const ejercicio of ejerciciosDia) {
          const patron = ejercicio.patronMovimiento ?? patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular);
          const objetivo = objetivoDePatron(patron);
          if (objetivo && porObjetivo.has(objetivo)) porObjetivo.get(objetivo)?.push(ejercicio);
          else fueraDelPlan.push(ejercicio);
        }
        for (const objetivo of objetivos) {
          const cantidadDeseada = objetivo === "core" || objetivo === "cardio" ? 1 : cantidadPrincipal;
          const existentes = porObjetivo.get(objetivo)?.length ?? 0;
          const faltan = Math.max(0, cantidadDeseada - existentes);
          if (faltan === 0) continue;

          const nombresUsados = new Set(ejerciciosDia.map((ejercicio) => ejercicio.nombre.trim().toLowerCase()));
          const candidatos = opcionesBibliotecaParaObjetivo(biblioteca, objetivo)
            .filter((item) => !nombresUsados.has(item.ejercicio.nombre.trim().toLowerCase()))
            .sort((a, b) => {
              const prioridad = prioridadEstructural(a.patron) - prioridadEstructural(b.patron);
              if (prioridad !== 0) return prioridad;
              return config.estilo === "olympia"
                ? b.ejercicio.nombre.localeCompare(a.ejercicio.nombre, "es")
                : a.ejercicio.nombre.localeCompare(b.ejercicio.nombre, "es");
            });

          // Primero un representante de cada patrón; solo después se repite.
          const patronesElegidos = new Set<PatronMovimiento>();
          const diversos = candidatos.filter((item) => {
            if (patronesElegidos.has(item.patron)) return false;
            patronesElegidos.add(item.patron);
            return true;
          });
          const resto = candidatos.filter((item) => !diversos.includes(item));
          const elegidos = [...diversos, ...resto].slice(0, faltan);
          if (existentes + elegidos.length < cantidadDeseada) {
            advertenciasCobertura.push(
              `${dia.nombre}: la biblioteca solo permite ${existentes + elegidos.length}/${cantidadDeseada} ejercicios de ${ETIQUETA_OBJETIVO[objetivo]}.`
            );
          }

          elegidos.forEach((item, indice) => {
            const ultimoDelGrupo = indice === elegidos.length - 1;
            const tecnica = nivelArmado !== "senior" && nivelArmado !== "principiante" && ultimoDelGrupo && config.tecnicasPermitidas.length > 0
              ? config.tecnicasPermitidas[objetivos.indexOf(objetivo) % config.tecnicasPermitidas.length]
              : null;
            const tecnicaCatalogo = tecnica ? (tecnicas ?? []).find((itemTecnica) => itemTecnica.nombre === tecnica) : null;
            porObjetivo.get(objetivo)?.push({
              ...EJERCICIO_VACIO,
              ...prescripcionAutomatica(item.patron, nivelArmado, config.estilo),
              orden: 0,
              nombre: item.ejercicio.nombre,
              ejercicioId: item.ejercicio.id,
              grupoMuscular: (objetivo === "biceps" || objetivo === "triceps" ? "brazos" : objetivo) as Ejercicio["grupoMuscular"],
              patronMovimiento: item.patron,
              tecnicaTipo: tecnica,
              tecnicaInstruccion: tecnicaCatalogo ? explicacionTecnica(tecnicaCatalogo) : null,
            });
          });
        }

        const objetivosPrincipales = objetivos.filter((objetivo) => objetivo !== "core" && objetivo !== "cardio");
        const remates = objetivos.filter((objetivo) => objetivo === "core" || objetivo === "cardio");
        let ordenados: Ejercicio[] = [];
        if (config.alcance === "grupo" || config.organizacion === "por_grupos" || objetivosPrincipales.length < 2) {
          ordenados = objetivosPrincipales.flatMap((objetivo) => porObjetivo.get(objetivo) ?? []);
        } else if (config.organizacion === "alternado") {
          const maximo = Math.max(0, ...objetivosPrincipales.map((objetivo) => porObjetivo.get(objetivo)?.length ?? 0));
          for (let posicion = 0; posicion < maximo; posicion++) {
            for (const objetivo of objetivosPrincipales) {
              const ejercicio = porObjetivo.get(objetivo)?.[posicion];
              if (ejercicio) ordenados.push(ejercicio);
            }
          }
        } else {
          const [primero, segundo, ...restantes] = objetivosPrincipales;
          const bloqueA = porObjetivo.get(primero) ?? [];
          const bloqueB = porObjetivo.get(segundo) ?? [];
          const maximo = Math.max(bloqueA.length, bloqueB.length);
          for (let posicion = 0; posicion < maximo; posicion++) {
            const ejercicioA = bloqueA[posicion];
            const ejercicioB = bloqueB[posicion];
            if (ejercicioA && ejercicioB) {
              const tecnicaA = ejercicioA.tecnicaTipo ? ` · ${ejercicioA.tecnicaTipo}` : "";
              const tecnicaB = ejercicioB.tecnicaTipo ? ` · ${ejercicioB.tecnicaTipo}` : "";
              const instruccionA = ejercicioA.tecnicaInstruccion ? ` ${ejercicioA.tecnicaInstruccion}` : "";
              const instruccionB = ejercicioB.tecnicaInstruccion ? ` ${ejercicioB.tecnicaInstruccion}` : "";
              ordenados.push({ ...ejercicioA, tecnicaTipo: `Biserie (1/2)${tecnicaA}`, tecnicaInstruccion: `Enlaza sin descanso con ${ejercicioB.nombre}.${instruccionA}`, descansoSegundos: 0 });
              ordenados.push({ ...ejercicioB, tecnicaTipo: `Biserie (2/2)${tecnicaB}`, tecnicaInstruccion: `Cierra la biserie y descansa antes de repetir.${instruccionB}`, descansoSegundos: Math.max(60, ejercicioB.descansoSegundos ?? 90) });
            } else if (ejercicioA) ordenados.push(ejercicioA);
            else if (ejercicioB) ordenados.push(ejercicioB);
          }
          ordenados.push(...restantes.flatMap((objetivo) => porObjetivo.get(objetivo) ?? []));
        }
        ordenados.push(...remates.flatMap((objetivo) => porObjetivo.get(objetivo) ?? []), ...fueraDelPlan);
        if (config.cardioInicio !== "ninguno" || config.cardioFinal !== "ninguno") {
          ordenados = ordenados.filter((ejercicio) => ejercicio.grupoMuscular !== "cardio");
          const inicial = config.cardioInicio === "ninguno" ? null : crearCardio(config.cardioInicio, config.cardioInicioMinutos, "inicio");
          const final = config.cardioFinal === "ninguno" ? null : crearCardio(config.cardioFinal, config.cardioFinalMinutos, "final");
          if (inicial) ordenados.unshift(inicial);
          if (final) ordenados.push(final);
        }
        return { ...dia, ejercicios: ordenados.map((ejercicio, indice) => ({ ...ejercicio, orden: indice + 1 })) };
      });
      return {
        ...actual,
        metodoGeneracion: {
          nivel: NIVELES_ARMADO[nivelArmado].etiqueta,
          inspiracion: PROGRAMAS_VIP[config.estilo].nombre,
          organizacion: ETIQUETA_ORGANIZACION[config.organizacion],
          generadoAutomaticamente: true,
        },
        dias: diasNuevos,
      };
    })();
    setDraft(siguiente);
    if (advertenciasCobertura.length > 0) {
      setError(`Generación incompleta. ${advertenciasCobertura.join(" ")} Agrega o reclasifica ejercicios en la biblioteca.`);
    }
  };

  const publicar = async () => {
    if (erroresCalidad.length > 0) {
      setError(`Corrige los ${erroresCalidad.length} ajustes del Semáforo VIP antes de publicar.`);
      return;
    }
    if (!planCodigo) {
      setError("Selecciona primero el plan principal del alumno.");
      return;
    }
    setPublicando(true);
    setError(null);
    setVersionDesactualizada(false);

    // El try/finally NO es decorativo. Antes, si la acción del servidor lanzaba
    // (error de red, función cortada por tiempo, fallo del servidor), la promesa
    // se rechazaba y el `setPublicando(false)` de abajo nunca se ejecutaba: el
    // botón quedaba en "Publicando…" para siempre, sin mostrar nada. El
    // entrenador no tenía forma de saber que había fallado, ni yo de saber por
    // qué. Cualquier fallo tiene que terminar en un mensaje en pantalla.
    try {
      const resultado = await publicarRutinaAVariosAlumnos(alumnoIds, draft, planCodigo);

      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      // Puede haber salido bien para unos y mal para otros: se muestra el
      // resultado real en vez de un "listo" que oculte a los que quedaron fuera.
      setPublicados(resultado.publicados);
      setFallidos(resultado.fallidos.map((f) => ({ nombre: f.nombre, error: f.error })));

      if (resultado.publicados === 0) {
        setError("No fue posible publicar la rutina a ningún alumno.");
        return;
      }
      setPublicado(true);
    } catch (e) {
      const detalle = e instanceof Error ? e.message : "error inesperado";
      const esVersionAnterior = /failed to find server action|was not found on the server/i.test(detalle);
      if (esVersionAnterior) {
        setVersionDesactualizada(true);
        setError("VIP Fitness se actualizó mientras esta pantalla estaba abierta. La rutina sigue visible: guarda un respaldo y actualiza la aplicación para publicar con la versión nueva.");
      } else {
        setError(`No se pudo publicar: ${detalle}. La rutina sigue aquí, puedes intentar de nuevo.`);
      }
    } finally {
      setPublicando(false);
    }
  };

  if (publicado) {
    return (
      <Card>
        <p className="text-body text-text">
          {publicados === 1
            ? "Rutina publicada. Ya está disponible en Entrenar para el alumno."
            : `Rutina publicada para ${publicados} alumnos. Ya está disponible en Entrenar.`}
        </p>
        {fallidos.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-caption mb-1 text-error">
              No se pudo publicar a {fallidos.length}{" "}
              {fallidos.length === 1 ? "alumno" : "alumnos"}:
            </p>
            {fallidos.map((f) => (
              <p key={f.nombre} className="text-caption text-text-secondary">
                {f.nombre} — {f.error}
              </p>
            ))}
          </div>
        )}
        {/* Antes esta tarjeta no tenía salida: había que recargar la página
            para cargar la siguiente rutina. `onDescartar` acá hace un reinicio
            completo (ArchivosManager.reiniciarFlujoRutina), no un simple
            "cerrar" — vuelve a mostrar el cuadro de carga vacío. */}
        <Button variant="secondary" onClick={onDescartar} className="mt-4">
          Cargar otra rutina
        </Button>
      </Card>
    );
  }

  return (
    <div className={mesaDeTrabajo ? "space-y-2" : "space-y-4"}>
      {mesaDeTrabajo ? (
        <details className="radius-control border border-border bg-surface">
          <summary className="cursor-pointer px-2.5 py-2 text-caption font-semibold text-text-secondary">
            {draft.nombreRutina} · {planCodigo ? PLANES_ENTRENAMIENTO[planCodigo].nombre : "Elegir plan"}
          </summary>
          <div className="grid gap-1.5 border-t border-border p-2 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="text-[9px] mb-0.5 block font-semibold uppercase text-text-tertiary">Rutina</span>
              <Input
                value={draft.nombreRutina}
                onChange={(e) => setDraft((d) => ({ ...d, nombreRutina: e.target.value }))}
                className="py-1.5"
              />
            </label>
            <label className="min-w-0">
              <span className="text-[9px] mb-0.5 block font-semibold uppercase text-text-tertiary">Plan principal</span>
              <Select
                value={planCodigo}
                onChange={(e) => setPlanCodigo(e.target.value as CodigoPlanEntrenamiento | "")}
                className="py-1.5"
              >
                <option value="">Elegir plan…</option>
                {Object.values(PLANES_ENTRENAMIENTO).map((plan) => (
                  <option key={plan.codigo} value={plan.codigo}>
                    {plan.nombre} · {plan.sesionesMensuales}/mes · {plan.diasSemana}/semana
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </details>
      ) : (
        <>
          <Card>
            <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE DE LA RUTINA</label>
            <Input
              value={draft.nombreRutina}
              onChange={(e) => setDraft((d) => ({ ...d, nombreRutina: e.target.value }))}
            />
          </Card>
          <Card>
            <label className="text-caption mb-1.5 block font-semibold text-text">PLAN PRINCIPAL DEL ALUMNO</label>
            <Select
              value={planCodigo}
              onChange={(e) => setPlanCodigo(e.target.value as CodigoPlanEntrenamiento | "")}
            >
              <option value="">Seleccionar antes de publicar</option>
              {Object.values(PLANES_ENTRENAMIENTO).map((plan) => (
                <option key={plan.codigo} value={plan.codigo}>
                  {plan.nombre} · {plan.sesionesMensuales} al mes · {plan.diasSemana} por semana
                </option>
              ))}
            </Select>
            <p className="text-micro mt-2 text-text-tertiary">
              Ordena las semanas y el cupo mensual. El alumno verá el nombre del plan, nunca su precio.
            </p>
            {planCodigo &&
              draft.dias.filter((dia) => dia.tipo === "entrenamiento").length !==
                PLANES_ENTRENAMIENTO[planCodigo].diasSemana && (
                <p className="text-caption mt-2 text-warning">
                  La rutina tiene {draft.dias.filter((dia) => dia.tipo === "entrenamiento").length} sesiones distintas,
                  pero el plan recomienda {PLANES_ENTRENAMIENTO[planCodigo].diasSemana} por semana. Se conservará la
                  secuencia y se mostrará dividida en semanas de {PLANES_ENTRENAMIENTO[planCodigo].diasSemana} sesiones.
                </p>
              )}
          </Card>
        </>
      )}

      {!mesaDeTrabajo && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-text-tertiary">{draft.dias.length} DÍAS</span>
          <button
            type="button"
            onClick={() => setDiasAbiertos(todosAbiertos ? new Set() : new Set(draft.dias.map((_, i) => i)))}
            className="text-caption font-medium text-vip underline"
          >
            {todosAbiertos ? "Colapsar todo" : "Expandir todo"}
          </button>
        </div>
      )}

      {!mesaDeTrabajo && draft.dias.map((dia, diaIdx) => {
        const abierto = diasAbiertos.has(diaIdx);
        return (
          <Card key={diaIdx} padding="p-0" className="overflow-hidden">
            <button
              type="button"
              onClick={() => alternarDia(diaIdx)}
              aria-expanded={abierto}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-surface-2"
            >
              <ChevronRight size={16} className={`shrink-0 text-text-tertiary transition-transform duration-150 ${abierto ? "rotate-90" : ""}`} />
              <div className="min-w-0 flex-1">
                <p className="text-secondary truncate font-medium text-text">
                  Día {dia.numero} · {dia.nombre || "Sin nombre"}
                </p>
                <p className="text-micro truncate text-text-tertiary">{resumenDia(dia)}</p>
              </div>
            </button>

            {abierto && (
              <div className="space-y-3 border-t border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={dia.numero}
                    onChange={(e) => actualizarDia(diaIdx, { numero: Number(e.target.value) })}
                    className="w-16 shrink-0 py-2"
                  />
                  <Input
                    value={dia.nombre}
                    onChange={(e) => actualizarDia(diaIdx, { nombre: e.target.value })}
                    placeholder="Nombre del día"
                    className="min-w-0 flex-1 py-2"
                  />
                  <IconButton
                    ariaLabel="Mover arriba"
                    onClick={() => moverDia(diaIdx, -1)}
                    disabled={diaIdx === 0}
                  >
                    <ChevronUp size={16} className="text-text-secondary" />
                  </IconButton>
                  <IconButton
                    ariaLabel="Mover abajo"
                    onClick={() => moverDia(diaIdx, 1)}
                    disabled={diaIdx === draft.dias.length - 1}
                  >
                    <ChevronDown size={16} className="text-text-secondary" />
                  </IconButton>
                  <IconButton ariaLabel="Quitar día" onClick={() => quitarDia(diaIdx)}>
                    <Trash2 size={16} className="text-error" />
                  </IconButton>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => actualizarDia(diaIdx, { tipo: "entrenamiento" })}
                    className={`text-secondary radius-control flex-1 py-2 font-medium transition-colors duration-200 ease-in-out ${
                      dia.tipo === "entrenamiento" ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    Entrenamiento
                  </button>
                  <button
                    onClick={() => actualizarDia(diaIdx, { tipo: "descanso" })}
                    className={`text-secondary radius-control flex-1 py-2 font-medium transition-colors duration-200 ease-in-out ${
                      dia.tipo === "descanso" ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
                    }`}
                  >
                    Descanso
                  </button>
                </div>

                {dia.tipo === "descanso" ? (
                  <Textarea
                    value={dia.descripcion ?? ""}
                    onChange={(e) => actualizarDia(diaIdx, { descripcion: e.target.value || null })}
                    placeholder="Sugerencia para el día de descanso (opcional, ej: Caminata ligera 20-30 min)"
                    rows={2}
                    className="py-2"
                  />
                ) : (
                  <>
                    {dia.ejercicios.map((ej, ejIdx) => (
                      <EjercicioForm
                        key={ejIdx}
                        numero={ejIdx + 1}
                        ejercicio={ej}
                        gruposSugeridos={gruposPlanificados(dia)}
                        biblioteca={ejercicios}
                        onChange={(e) => actualizarEjercicio(diaIdx, ejIdx, e)}
                        onRemove={() => quitarEjercicio(diaIdx, ejIdx)}
                      />
                    ))}

                    <button
                      onClick={() => agregarEjercicio(diaIdx)}
                      className="text-secondary radius-control flex w-full items-center justify-center gap-1 bg-surface-2 py-2.5 font-medium text-vip"
                    >
                      <Plus size={16} /> Agregar ejercicio
                    </button>
                  </>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {!mesaDeTrabajo && (
        <button
          onClick={() => {
            agregarDia();
            setDiasAbiertos((s) => new Set(s).add(draft.dias.length));
          }}
          className="text-secondary radius-control flex w-full items-center justify-center gap-1 border border-border py-3 text-text-tertiary"
        >
          <Plus size={16} /> Agregar día
        </button>
      )}

      {/* El control de calidad es el paso posterior a editar la rutina. Antes
          vivía arriba del editor: al terminar cinco o seis días había que
          volver al inicio para encontrarlo. Ahora el orden es el real del
          trabajo: generar → editar → analizar → confirmar. */}
      {onRevisar && (
        <RevisionIAPanel
          revision={revision}
          revisando={revisando}
          error={errorRevision}
          aplicados={aplicados}
          onRevisar={revisar}
          onAplicar={(i) => aplicarCambios([i])}
          onAplicarTodos={() =>
            aplicarCambios(revision ? revision.cambios.map((_, i) => i).filter((i) => !aplicados.has(i)) : [])
          }
        />
      )}

      {mesaDeTrabajo ? (
        <VistaPreviaEstructurada
          draft={draft}
          biblioteca={ejercicios}
          onActualizarEjercicio={actualizarEjercicio}
          onInsertarEjercicio={insertarEjercicio}
          onQuitarEjercicio={quitarEjercicio}
          expandida
          onAgregarDia={agregarDia}
          onQuitarDia={quitarDia}
          tecnicas={tecnicas}
          onEncadenar={encadenarTecnica}
          onInsertarDescanso={insertarDescanso}
          onAplicarAGrupo={aplicarAGrupo}
          onGenerarAutomatico={generarAutomaticamente}
          hallazgos={hallazgosEstructura}
          diaActivo={diaActivo}
          onCambiarDia={setDiaActivo}
          nivelArmado={nivelArmado}
        />
      ) : <Card padding="p-0" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setMostrarPreview((v) => !v)}
          aria-expanded={mostrarPreview}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-secondary font-medium text-text">{mesaDeTrabajo ? "Mesa de armado" : "Vista previa del documento"}</span>
          {mostrarPreview ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
        </button>
        {mostrarPreview && (
          <div className={`border-t border-border ${mesaDeTrabajo ? "p-2" : "p-3"}`}>
            {!mesaDeTrabajo && <p className="text-micro mb-2 text-text-tertiary">
              Vista de revisión por día y grupo muscular. El contenido completo es el que se guarda como documento del alumno.
            </p>}
            <VistaPreviaEstructurada
              draft={draft}
              biblioteca={ejercicios}
              onActualizarEjercicio={actualizarEjercicio}
              onInsertarEjercicio={insertarEjercicio}
              onQuitarEjercicio={quitarEjercicio}
              expandida={mesaDeTrabajo}
              onAgregarDia={mesaDeTrabajo ? agregarDia : undefined}
              onQuitarDia={mesaDeTrabajo ? quitarDia : undefined}
              tecnicas={tecnicas}
              onEncadenar={encadenarTecnica}
              onInsertarDescanso={mesaDeTrabajo ? insertarDescanso : undefined}
              onAplicarAGrupo={mesaDeTrabajo ? aplicarAGrupo : undefined}
              onGenerarAutomatico={mesaDeTrabajo ? generarAutomaticamente : undefined}
              hallazgos={hallazgosEstructura}
              diaActivo={diaActivo}
              onCambiarDia={setDiaActivo}
              nivelArmado={nivelArmado}
            />
          </div>
        )}
      </Card>}

      <SemaforoCalidad hallazgos={hallazgos} onIr={irAHallazgo} />

      {error && (
        <div className="space-y-2">
          <p className="text-caption text-error">{error}</p>
          {versionDesactualizada && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(previewTexto);
                    setRespaldoCopiado(true);
                  } catch {
                    setError("No se pudo copiar automáticamente. Selecciona el texto de la vista previa antes de actualizar.");
                  }
                }}
              >
                <Copy size={14} /> {respaldoCopiado ? "Respaldo copiado" : "Copiar respaldo"}
              </Button>
              <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
                <RefreshCcw size={14} /> Actualizar aplicación
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-2">
        <Button
          onClick={publicar}
          loading={publicando}
          disabled={erroresCalidad.length > 0}
          disabledReason={`Corrige ${erroresCalidad.length} ${erroresCalidad.length === 1 ? "ajuste" : "ajustes"} del Semáforo VIP`}
          size={mesaDeTrabajo ? "xs" : "lg"}
          className="flex-1"
        >
          {publicando ? "Publicando…" : mesaDeTrabajo ? "Asignar rutina" : "Confirmar y asignar rutina"}
        </Button>
        <Button variant="secondary" size={mesaDeTrabajo ? "xsAuto" : "lg"} onClick={onDescartar} className={mesaDeTrabajo ? "" : "w-auto px-6"}>
          Descartar
        </Button>
      </div>
    </div>
  );
}
