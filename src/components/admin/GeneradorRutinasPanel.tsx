"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Search, Sparkles, UserPlus } from "lucide-react";
import { generarBorradorRutina, revisarBorradorConIA } from "@/app/admin/generador/actions";
import { RutinaDraftEditor } from "@/components/admin/RutinaDraftEditor";
import { GavetaConfig } from "@/components/admin/GavetaConfig";
import { SelectorAlumnos } from "@/components/admin/SelectorAlumnos";
import { SelectorGruposDia } from "@/components/admin/SelectorGruposDia";
import { LimitesPorGrupo } from "@/components/admin/LimitesPorGrupo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { linkWhatsApp } from "@/lib/generador-rutinas/whatsapp";
import { ejerciciosPorTiempo, modalidadesCardioDisponibles } from "@/lib/generador-rutinas/motor";
import { sugerirDesdeFichas } from "@/lib/generador-rutinas/sugerencias-perfil";
import { etiquetaReferenciaFisica, REFERENCIAS_FISICAS } from "@/lib/perfil-alumno/ficha";
import type {
  AplicacionTecnicas,
  AyudasErgogenicas,
  BriefGenerador,
  CategoriaCompetencia,
  Distribucion,
  EnfoqueForma,
  EstiloEntrenamiento,
  EtiquetaDia,
  GrupoEntrenable,
  InspiracionEstilo,
  IntensidadDeseada,
  ObjetivoEntrenamiento,
  PrioridadBloque,
} from "@/lib/generador-rutinas/tipos";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { CodigoPlanEntrenamiento } from "@/lib/planes-entrenamiento";

/** Lo que el alumno respondió en "Mi entrenamiento". Se muestra tal cual al
 * elegirlo: el generador ya lo usa por dentro, pero el entrenador también
 * necesita verlo para saber a quién le está armando la rutina. */
type FichaAlumno = {
  objetivoPrincipal: string | null; experiencia: string | null; cardioNivel: string | null; preferenciaEquipo: string | null;
  categoriaReferencia: CategoriaCompetencia | null;
  molestias: string | null; lesiones: string | null; operaciones: string | null; condiciones: string | null;
  medicamentos: string | null; noDeseados: string | null; preferidos: string | null; actividades: string | null;
};
/** Plan de entrenamiento CONTRATADO (cobrado), asignado por el entrenador
 * desde la ficha del alumno en /admin/alumnos — no confundir con `dias`
 * más abajo, que es lo que el ALUMNO autoreportó en su propio cuestionario
 * y puede no coincidir con lo que en realidad pagó. Null si todavía no se
 * le asignó plan. */
type PlanAlumno = { codigo: CodigoPlanEntrenamiento; nombre: string; diasSemana: number; sesionesMensuales: number };
type Alumno = { id: string; nombre: string; telefono: string | null; objetivo: string | null; perfilCompleto: boolean; requiereRevision: boolean; dias: number | null; minutos: number | null; sinRutina: boolean; ficha: FichaAlumno; plan: PlanAlumno | null };
type Ejercicio = { id: string; nombre: string; grupo: string; equipo: string };
type Tecnica = { slug: string; nombre: string; tipo: "individual" | "encadenada"; nivelMinimo: string };

/** La ficha que llenó el alumno, tal cual, al momento de elegirlo.
 *
 * El generador ya la usaba por dentro (y ahora también la lee el filtro de
 * IA), pero el entrenador la tenía invisible: para saber si a esa persona le
 * duele la rodilla o la operaron del hombro había que salir a otra pantalla.
 * Lo de salud va destacado; lo demás, en una línea de contexto. */
/** Plan contratado (cobrado) vs. lo que el alumno autoreportó en su propia
 * ficha — pedido explícito del entrenador: "el alumno que contrata tres días
 * a la semana no puede terminar con veinte sesiones". Se muestra siempre,
 * incluso si la ficha de entrenamiento todavía no está completa, porque es
 * información de facturación, no del cuestionario. */
function PlanContratadoAlumno({ alumno }: { alumno: Alumno }) {
  if (!alumno.plan) {
    return (
      <div className="radius-control border border-warning bg-warning/10 p-2.5">
        <p className="text-caption flex items-start gap-1.5 text-warning">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            {alumno.nombre} todavía no tiene un plan de entrenamiento asignado. Asígnalo en su ficha (Alumnos) antes
            de publicar — sin plan no hay forma de saber cuántas sesiones tiene realmente pagadas.
          </span>
        </p>
      </div>
    );
  }
  const discrepancia = alumno.dias !== null && alumno.dias !== alumno.plan.diasSemana;
  return (
    <div className={`radius-control border p-2.5 ${discrepancia ? "border-warning bg-warning/10" : "border-vip/30 bg-vip/5"}`}>
      <p className={`text-caption flex items-center gap-1.5 font-semibold ${discrepancia ? "text-warning" : "text-vip"}`}>
        {discrepancia && <AlertTriangle size={14} className="shrink-0" />}
        Plan contratado: {alumno.plan.nombre} · {alumno.plan.diasSemana} días/semana · {alumno.plan.sesionesMensuales} sesiones/mes
      </p>
      {discrepancia && (
        <p className="text-micro mt-1 text-text-secondary">
          Ojo: en su ficha declaró {alumno.dias} días disponibles, pero pagó {alumno.plan.diasSemana} días/semana. El
          generador va a usar el plan contratado — no le des más sesiones de las que tiene pagadas salvo que
          confirmes con el alumno y lo corrijas a mano abajo.
        </p>
      )}
    </div>
  );
}

function FichaDelAlumno({ alumno }: { alumno: Alumno }) {
  const f = alumno.ficha;
  const salud: [string, string | null][] = [
    ["Molestias", f.molestias],
    ["Lesiones", f.lesiones],
    ["Operaciones", f.operaciones],
    ["Condiciones médicas", f.condiciones],
    ["Medicamentos", f.medicamentos],
  ];
  const conSalud = salud.filter(([, v]) => Boolean(v));
  const contexto = [
    f.objetivoPrincipal ? `Objetivo: ${f.objetivoPrincipal.replaceAll("_", " ")}` : null,
    f.experiencia ? `Nivel ${f.experiencia}` : null,
    alumno.dias ? `${alumno.dias} días declarados` : null,
    alumno.minutos ? `${alumno.minutos} min` : null,
    f.preferenciaEquipo && f.preferenciaEquipo !== "indistinto" ? `Prefiere ${f.preferenciaEquipo.replaceAll("_", " ")}` : null,
    f.cardioNivel ? `Cardio actual ${f.cardioNivel}` : null,
    f.categoriaReferencia && f.categoriaReferencia !== "ninguna"
      ? `Referencia: ${etiquetaReferenciaFisica(f.categoriaReferencia, true)}`
      : null,
  ].filter(Boolean);

  // Sin ficha el generador arma la rutina a ciegas (nivel principiante por
  // defecto, sin saber lesiones). Se dice acá, no en una alerta genérica.
  if (!alumno.perfilCompleto) {
    const wa = linkWhatsApp(alumno.telefono ?? "");
    return (
      <div className="space-y-2">
        <PlanContratadoAlumno alumno={alumno} />
        <div className="radius-control border border-warning bg-surface-2 p-2.5">
          <p className="text-caption flex items-start gap-1.5 text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              {alumno.nombre} todavía no llenó “Mi entrenamiento”: no hay objetivo, nivel, lesiones ni condiciones
              médicas registradas. Se puede generar igual, pero tanto las reglas como la revisión de IA van a trabajar a
              ciegas.
            </span>
          </p>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-caption mt-1.5 inline-flex items-center gap-1 font-medium text-success underline">
              <MessageCircle size={13} /> Escribirle por WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <PlanContratadoAlumno alumno={alumno} />
      <div className="radius-control border border-border bg-surface-2 p-2.5">
      <p className="text-micro mb-1 text-text-tertiary">FICHA DE {alumno.nombre.toUpperCase()}</p>
      {contexto.length > 0 && <p className="text-caption text-text-secondary">{contexto.join(" · ")}</p>}
      {conSalud.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-border pt-1.5">
          {conSalud.map(([etiqueta, valor]) => (
            <p key={etiqueta} className="text-caption text-text">
              <span className="text-warning">{etiqueta}:</span> {valor}
            </p>
          ))}
        </div>
      )}
      {f.noDeseados && <p className="text-caption mt-1.5 text-text-secondary">No quiere hacer: {f.noDeseados}</p>}
      {f.preferidos && <p className="text-caption text-text-secondary">Le gustan: {f.preferidos}</p>}
      {f.actividades && <p className="text-caption text-text-secondary">Otras actividades: {f.actividades}</p>}
      {conSalud.length === 0 && <p className="text-micro mt-1 text-text-tertiary">Sin molestias, lesiones ni condiciones declaradas.</p>}
      </div>
    </div>
  );
}

const ETIQUETA_MODALIDAD = {
  spinning: "Bicicleta de spinning",
  caminadora: "Caminadora",
  steps: "Steps",
  funcional: "Cardio funcional (circuito)",
} as const;

const MINUTOS_PRESET = [30, 45, 60, 75, 90, 120];
const GRUPOS_PRIORITARIOS: { value: GrupoEntrenable; label: string }[] = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "hombros", label: "Hombros" },
  { value: "brazos", label: "Brazos" },
  { value: "piernas", label: "Piernas" },
  { value: "core", label: "Core" },
];
const OBJETIVO_LABEL: Record<ObjetivoEntrenamiento, string> = {
  hipertrofia: "Hipertrofia", fuerza: "Fuerza", perdida_grasa: "Pérdida de grasa", recomposicion: "Recomposición",
  condicion_fisica: "Condición física", rendimiento: "Rendimiento", mantencion: "Mantención",
};
const ESTILO_LABEL: Record<EstiloEntrenamiento, string> = { hibrido: "Híbrido", nueva_escuela: "Nueva escuela", vieja_escuela: "Vieja escuela" };
const INSPIRACION_LABEL: Record<InspiracionEstilo, string> = {
  ninguna: "Ninguna", alta_intensidad: "Alta intensidad", volumen_tradicional: "Volumen tradicional", hibrido_tension: "Híbrido de tensión", cientifico_rir: "Científico (RIR)",
};

/** Campo con su etiqueta arriba — el select solo no dejaba claro qué se
 * estaba anotando ahí. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-caption mb-1 block text-text-tertiary">{label}</label>
      {children}
    </div>
  );
}

export function GeneradorRutinasPanel({
  alumnos,
  ejercicios,
  tecnicas,
  filtroInicial = "todos",
  alumnoInicial,
}: {
  alumnos: Alumno[];
  ejercicios: Ejercicio[];
  tecnicas: Tecnica[];
  filtroInicial?: "todos" | "sin_rutina" | "ficha_lista";
  alumnoInicial?: string;
}) {
  // Arranca vacío. Antes venía con el primer alumno de la lista ya marcado
  // (el primero alfabético), así que si el entrenador no miraba, generaba una
  // rutina para alguien que nunca eligió. El botón de generar ya está
  // deshabilitado sin selección.
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    () => new Set(alumnoInicial ? [alumnoInicial] : [])
  );
  const alumnosElegidos = alumnos.filter((a) => seleccionados.has(a.id));
  const primerAlumnoId = alumnosElegidos[0]?.id ?? alumnos[0]?.id ?? "";
  const sinRutina = alumnos.filter((a) => a.sinRutina);
  const alumnosVisibles = filtroInicial === "sin_rutina"
    ? alumnos.filter((alumno) => alumno.sinRutina)
    : filtroInicial === "ficha_lista"
      ? alumnos.filter((alumno) => alumno.perfilCompleto)
      : alumnos;

  const [objetivo, setObjetivo] = useState<ObjetivoEntrenamiento>("hipertrofia");
  const [prioridad, setPrioridad] = useState<PrioridadBloque>("hipertrofia");
  const [grupoPrioritario, setGrupoPrioritario] = useState<GrupoEntrenable | "">("");
  const [enfoqueForma, setEnfoqueForma] = useState<EnfoqueForma>("ninguno");
  const [dias, setDias] = useState(3); const [minutos, setMinutos] = useState(60); const [cantidad, setCantidad] = useState(7);
  const [estilo, setEstilo] = useState<EstiloEntrenamiento>("hibrido");
  const [distribucion, setDistribucion] = useState<Distribucion>("automatica");
  const [diaGrupos, setDiaGrupos] = useState<EtiquetaDia[][]>([]);
  const [limitesPorGrupo, setLimitesPorGrupo] = useState<Partial<Record<EtiquetaDia, number>>>({});
  const [intensidad, setIntensidad] = useState<IntensidadDeseada>("estandar");
  const [inspiracionEstilo, setInspiracionEstilo] = useState<InspiracionEstilo>("ninguna");
  const [tecnicasIntensidad, setTecnicasIntensidad] = useState<AplicacionTecnicas>("automatico");
  const [tecnicasPermitidas, setTecnicasPermitidas] = useState<string[]>([]);
  const [ayudasErgogenicas, setAyudasErgogenicas] = useState<AyudasErgogenicas>("prefiere_no_decir");
  const [categoriaCompetencia, setCategoriaCompetencia] = useState<CategoriaCompetencia>("ninguna");
  // Arranca en la primera modalidad que el gimnasio puede hacer de verdad —
  // nunca en una fija, que podría no existir en la sala.
  const [cardio, setCardio] = useState<BriefGenerador["cardio"]>(
    () => modalidadesCardioDisponibles(ejercicios.filter((e) => e.grupo === "cardio").map((e) => e.nombre))[0] ?? "ninguno"
  ); const [cardioMinutos, setCardioMinutos] = useState(10); const [cardioEjercicios, setCardioEjercicios] = useState<string[]>([]); const [cardioFormato, setCardioFormato] = useState<BriefGenerador["cardioFormato"]>("circuito");
  const [abdominales, setAbdominales] = useState(false); const [evitarSaltos, setEvitarSaltos] = useState(false);
  const [obligatorios, setObligatorios] = useState<string[]>([]); const [prohibidos, setProhibidos] = useState<string[]>([]); const [preferidos, setPreferidos] = useState<string[]>([]);
  const [observaciones, setObservaciones] = useState(""); const [busqueda, setBusqueda] = useState("");
  const [avisosFicha, setAvisosFicha] = useState<string[]>([]); const [razonesFicha, setRazonesFicha] = useState<string[]>([]);
  const [rutina, setRutina] = useState<RutinaExtraida | null>(null); const [alertas, setAlertas] = useState<string[]>([]); const [reglas, setReglas] = useState<string[]>([]); const [error, setError] = useState<string | null>(null);
  // Se guardan para la revisión de IA: necesita el mismo brief y el mismo
  // borrador contra los que se generó, no un brief reconstruido del formulario
  // (el entrenador puede haber cambiado un campo después de generar).
  const [briefUsado, setBriefUsado] = useState<BriefGenerador | null>(null); const [borradorId, setBorradorId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visibles = useMemo(() => ejercicios.filter((e) => `${e.nombre} ${e.grupo} ${e.equipo}`.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 30), [ejercicios, busqueda]);
  const ejerciciosCardio = useMemo(() => ejercicios.filter((e) => e.grupo === "cardio"), [ejercicios]);
  // Solo se ofrecen las modalidades que el gimnasio de verdad puede hacer: si
  // no hay caminadora en la biblioteca, no aparece la opción "Caminadora".
  const modalidades = useMemo(() => modalidadesCardioDisponibles(ejerciciosCardio.map((e) => e.nombre)), [ejerciciosCardio]);
  const alternar = (id: string, lista: string[], set: (v: string[]) => void) => set(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  // Cantidad de ejercicios sugerida por el tiempo de sesión (ver
  // `ejerciciosPorTiempo` en motor.ts): ~1 cada 10 minutos de fuerza.
  const sugeridos = useMemo(() => ejerciciosPorTiempo(minutos, cardio === "ninguno" ? 0 : cardioMinutos), [minutos, cardio, cardioMinutos]);

  const cambiarMinutos = (m: number) => {
    setMinutos(m);
    setCantidad(ejerciciosPorTiempo(m, cardio === "ninguno" ? 0 : cardioMinutos));
  };

  const aplicarSugerencias = (ids: Set<string>) => {
    const elegidos = alumnos.filter((a) => ids.has(a.id));
    if (!elegidos.length) {
      setAvisosFicha([]); setRazonesFicha([]);
      return;
    }
    const sugerencias = sugerirDesdeFichas(
      elegidos.map((a) => ({ nombre: a.nombre, ...a.ficha, dias: a.dias, minutos: a.minutos })),
      ejercicios,
      modalidades
    );
    if (sugerencias.objetivo) setObjetivo(sugerencias.objetivo);
    if (sugerencias.prioridad) setPrioridad(sugerencias.prioridad);
    setCategoriaCompetencia(sugerencias.categoriaCompetencia ?? "ninguna");

    // El plan CONTRATADO (cobrado) manda sobre lo que el alumno haya
    // autoreportado en su propia ficha — "el alumno que contrata tres días
    // no puede terminar con una rutina de cinco". Con varios seleccionados y
    // planes distintos, se usa el más conservador (mínimo), mismo criterio
    // que ya aplica `sugerirDesdeFichas` para días/minutos de la ficha.
    const alertasPlan: string[] = [];
    const diasPlanPresentes = elegidos.map((a) => a.plan?.diasSemana).filter((v): v is number => Boolean(v));
    const diasPlan = diasPlanPresentes.length ? Math.min(...diasPlanPresentes) : null;
    const sinPlan = elegidos.filter((a) => !a.plan);
    if (diasPlan) setDias(diasPlan);
    else if (sugerencias.dias) setDias(sugerencias.dias);
    if (diasPlan && sugerencias.dias && sugerencias.dias !== diasPlan) {
      alertasPlan.push(
        `${elegidos.length === 1 ? elegidos[0].nombre : "El grupo"} declaró ${sugerencias.dias} días en su ficha, pero el plan contratado es de ${diasPlan} días/semana. Se usó el plan contratado — cambialo abajo solo si de verdad corresponden más días.`
      );
    }
    if (sinPlan.length) {
      alertasPlan.push(
        `${sinPlan.map((a) => a.nombre).join(", ")} todavía no ${sinPlan.length === 1 ? "tiene" : "tienen"} un plan de entrenamiento asignado — asígnalo en su ficha (Alumnos) para que el generador respete su cupo real.`
      );
    }

    if (sugerencias.minutos) setMinutos(sugerencias.minutos);
    setIntensidad(sugerencias.intensidad);
    setTecnicasIntensidad(sugerencias.tecnicasIntensidad);
    setCardio(sugerencias.cardio);
    setCardioMinutos(sugerencias.cardioMinutos);
    setPreferidos(sugerencias.preferidos);
    setProhibidos(sugerencias.prohibidos);
    setCantidad(ejerciciosPorTiempo(sugerencias.minutos ?? minutos, sugerencias.cardio === "ninguno" ? 0 : sugerencias.cardioMinutos));
    setAvisosFicha([...alertasPlan, ...sugerencias.alertas]);
    setRazonesFicha(sugerencias.razones);
  };

  const elegirAlumnos = (ids: Set<string>) => {
    setSeleccionados(ids);
    aplicarSugerencias(ids);
  };

  const agregarAlSeleccion = (id: string) => {
    const copia = new Set(seleccionados);
    copia.add(id);
    elegirAlumnos(copia);
  };

  const cambiarEstilo = (v: EstiloEntrenamiento) => {
    setEstilo(v);
    if (v === "vieja_escuela") setDistribucion("personalizada");
  };

  const generar = () => {
    setError(null);
    startTransition(async () => {
      const brief: BriefGenerador = {
        alumnoId: primerAlumnoId,
        alumnoIds: [...seleccionados],
        objetivo,
        prioridad,
        dias,
        minutosSesion: minutos,
        distribucion,
        diaGrupos: distribucion === "personalizada" ? diaGrupos : null,
        grupoPrioritario: grupoPrioritario || null,
        enfoqueForma,
        ejerciciosPorSesion: cantidad,
        limitesPorGrupo: Object.keys(limitesPorGrupo).length > 0 ? limitesPorGrupo : null,
        cardio,
        cardioMinutos,
        cardioEjercicios,
        cardioFormato,
        abdominales,
        evitarSaltos,
        obligatorios,
        prohibidos,
        preferidos,
        tecnicaNombre: null,
        estiloEntrenamiento: estilo,
        ayudasErgogenicas,
        categoriaCompetencia,
        intensidadDeseada: intensidad,
        tecnicasIntensidad,
        tecnicasPermitidas,
        inspiracionEstilo,
        observaciones,
      };
      const r = await generarBorradorRutina(brief);
      if (!r.ok) return setError(r.error);
      setRutina(r.rutina); setAlertas(r.alertas); setReglas(r.reglas); setBriefUsado(brief); setBorradorId(r.borradorId);
    });
  };

  if (rutina) return <div className="space-y-3">
    {alertas.map((a) => <Card key={a} padding="p-3" className="border border-warning"><p className="text-caption flex gap-2"><AlertTriangle size={16} />{a}</p></Card>)}
    {seleccionados.size > 1 && <Card padding="p-3" className="border border-vip"><p className="text-caption flex gap-2"><CheckCircle2 size={16} className="text-success" />Rutina grupal: se analizaron los {seleccionados.size} perfiles y se calibró con el integrante que necesita mayor protección.</p></Card>}
    <Card padding="p-3"><p className="text-caption mb-2 font-semibold">Reglas aplicadas</p>{reglas.map((r) => <p key={r} className="text-caption flex gap-2 text-text-secondary"><CheckCircle2 size={14} className="text-success" />{r}</p>)}</Card>
    <RutinaDraftEditor
      alumnoIds={[...seleccionados]}
      draftInicial={rutina}
      onDescartar={() => setRutina(null)}
      ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupo, equipo: e.equipo }))}
      onRevisar={briefUsado ? (borrador) => revisarBorradorConIA({ alumnoId: primerAlumnoId, alumnoIds: [...seleccionados], brief: briefUsado, rutina: borrador, reglas, borradorId }) : undefined}
    />
  </div>;

  const resumenEjercicios = `${obligatorios.length} obligatorios · ${preferidos.length} preferidos · ${prohibidos.length} prohibidos`;
  const cantidadLimites = Object.keys(limitesPorGrupo).length;
  const resumenLimites = cantidadLimites > 0 ? `${cantidadLimites} grupo${cantidadLimites === 1 ? "" : "s"} topado${cantidadLimites === 1 ? "" : "s"}` : "";

  return <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
    <div className="space-y-3">
    <div id="selector-alumnos" className="scroll-mt-28">
    <GavetaConfig titulo="1. Alumnos" subtitulo={`${seleccionados.size} seleccionado${seleccionados.size === 1 ? "" : "s"}${sinRutina.length > 0 ? ` · ${sinRutina.length} sin rutina activa` : ""}`} abiertaPorDefecto>
      {filtroInicial !== "todos" && (
        <div className="radius-control flex items-center justify-between gap-3 border border-vip/30 bg-vip/5 px-3 py-2">
          <p className="text-xs font-medium text-text">
            {filtroInicial === "sin_rutina" ? "Mostrando alumnos sin rutina" : "Mostrando alumnos con ficha lista"}
          </p>
          <a href="/admin/generador?alumnos=todos#selector-alumnos" className="shrink-0 text-xs font-semibold text-vip">Ver todos</a>
        </div>
      )}
      <SelectorAlumnos alumnos={alumnosVisibles} seleccionados={seleccionados} onCambiar={elegirAlumnos} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro text-text-tertiary">Al seleccionar, la ficha precarga un punto de partida editable. Si eliges varios, usa el nivel y la disponibilidad compatibles con todos.</p>
        {seleccionados.size > 0 && <button type="button" onClick={() => aplicarSugerencias(seleccionados)} className="shrink-0 text-micro font-medium text-vip underline">Reaplicar ficha</button>}
      </div>
      {razonesFicha.length > 0 && <div className="radius-control border border-success/30 bg-success/5 p-2"><p className="text-micro font-semibold text-success">SUGERIDO DESDE LA FICHA</p>{razonesFicha.map((r) => <p key={r} className="text-micro text-text-secondary">• {r}</p>)}</div>}
      {avisosFicha.map((aviso) => <p key={aviso} className="text-micro flex items-start gap-1 text-warning"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{aviso}</p>)}
      {alumnosElegidos.length === 1 && <FichaDelAlumno alumno={alumnosElegidos[0]} />}
      {alumnosElegidos.length > 1 && alumnosElegidos.some((a) => !a.perfilCompleto) && <p className="text-caption text-warning">Algún alumno aún no completó “Mi entrenamiento”. Puedes generar igualmente y definir los datos tú.</p>}
      {alumnosElegidos.some((a) => a.requiereRevision) && <p className="text-caption flex gap-2 text-warning"><AlertTriangle size={16} />Hay antecedentes de salud o molestias pendientes de revisión en algún alumno elegido. El sistema no diagnostica ni reemplaza tu criterio.</p>}
      {sinRutina.length > 0 && (
        <details className="rounded-xl border border-border bg-surface-2 p-2">
          <summary className="cursor-pointer text-caption font-medium text-text-secondary">
            {sinRutina.length} alumnos sin rutina activa
          </summary>
          <p className="text-micro mb-1.5 mt-2 text-text-tertiary">Agrégalos a la selección sin salir del generador.</p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {sinRutina.map((a) => {
              const wa = linkWhatsApp(a.telefono ?? "");
              return (
                <div key={a.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => agregarAlSeleccion(a.id)}
                    disabled={seleccionados.has(a.id)}
                    className={`radius-control flex flex-1 items-center gap-1 px-2 py-1 text-micro ${seleccionados.has(a.id) ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"}`}
                  >
                    {!seleccionados.has(a.id) && <UserPlus size={11} />}
                    {a.nombre}
                  </button>
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Escribirle a ${a.nombre} por WhatsApp`}
                      className="radius-control flex shrink-0 items-center justify-center bg-success/15 p-1.5 text-success"
                    >
                      <MessageCircle size={13} />
                    </a>
                  ) : (
                    <span title="Sin teléfono registrado" className="radius-control flex shrink-0 items-center justify-center bg-surface-2 p-1.5 text-text-tertiary opacity-40">
                      <MessageCircle size={13} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </GavetaConfig>
    </div>

    <GavetaConfig titulo="2. Objetivo" subtitulo={`${OBJETIVO_LABEL[objetivo]}${grupoPrioritario ? ` · prioriza ${grupoPrioritario}` : ""}`}>
      <Campo label="QUÉ SE BUSCA">
        <Select value={objetivo} onChange={(e) => setObjetivo(e.target.value as ObjetivoEntrenamiento)}>
          <option value="hipertrofia">Hipertrofia (ganar volumen muscular)</option>
          <option value="fuerza">Fuerza</option>
          <option value="perdida_grasa">Pérdida de grasa (definición)</option>
          <option value="recomposicion">Recomposición (volumen + definición)</option>
          <option value="condicion_fisica">Condición física</option>
          <option value="rendimiento">Rendimiento</option>
          <option value="mantencion">Mantención</option>
        </Select>
      </Campo>
      <Campo label="PRIORIDAD DEL BLOQUE">
        <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadBloque)}>
          <option value="hipertrofia">Hipertrofia</option>
          <option value="fuerza">Fuerza</option>
          <option value="cardio">Cardio</option>
          <option value="tecnica">Técnica</option>
          <option value="retorno">Retorno gradual</option>
          <option value="adherencia">Adherencia/simpleza</option>
        </Select>
      </Campo>
      <Campo label="GRUPO PRIORITARIO (OPCIONAL)">
        <Select value={grupoPrioritario} onChange={(e) => setGrupoPrioritario(e.target.value as GrupoEntrenable | "")}>
          <option value="">Ninguno — todos parejos</option>
          {GRUPOS_PRIORITARIOS.map((g) => <option key={g.value} value={g.value}>{g.label} (se entrena primero)</option>)}
        </Select>
      </Campo>
      <Campo label="ENFOQUE DE FORMA (OPCIONAL)">
        <Select value={enfoqueForma} onChange={(e) => setEnfoqueForma(e.target.value as EnfoqueForma)}>
          <option value="ninguno">Ninguno — mezcla habitual</option>
          <option value="amplitud">Amplitud — priorizar ancho (jalones, aperturas, laterales)</option>
          <option value="densidad">Densidad — priorizar grosor (remos, pesos muertos, press cerrado)</option>
          <option value="definicion">Definición — priorizar aislados (pump, finalización)</option>
        </Select>
      </Campo>
    </GavetaConfig>

    <GavetaConfig titulo="3. Estructura de la semana" subtitulo={`${ESTILO_LABEL[estilo]} · ${dias} días · ${minutos} min`}>
      <Campo label="ESTILO DE ENTRENAMIENTO">
        <Select value={estilo} onChange={(e) => cambiarEstilo(e.target.value as EstiloEntrenamiento)}>
          <option value="hibrido">Híbrido — splits de nueva escuela, densidad de vieja escuela</option>
          <option value="nueva_escuela">Nueva escuela — push/pull/legs o upper/lower con técnicas de intensidad</option>
          <option value="vieja_escuela">Vieja escuela — grupos musculares por día, a tu elección</option>
        </Select>
      </Campo>
      <Campo label="DISTRIBUCIÓN">
        <Select value={distribucion} onChange={(e) => setDistribucion(e.target.value as Distribucion)}>
          <option value="automatica">Automática VIP (recomendada según los días)</option>
          <option value="vip_balanceada">VIP grupos combinados</option>
          <option value="full_body">Full body</option>
          <option value="upper_lower">Upper / lower</option>
          <option value="push_pull_legs">Push / pull / legs</option>
          <option value="personalizada">Personalizada — elijo yo los grupos de cada día</option>
        </Select>
      </Campo>
      <div className="grid grid-cols-3 gap-1.5">
        <Campo label="DÍAS/SEM."><Input aria-label="Días" type="number" min={1} max={7} value={dias} onChange={(e) => setDias(Number(e.target.value))} /></Campo>
        <Campo label="TIEMPO">
          <Select aria-label="Tiempo de entrenamiento" value={minutos} onChange={(e) => cambiarMinutos(Number(e.target.value))}>
            {MINUTOS_PRESET.map((m) => <option key={m} value={m}>{m} min</option>)}
          </Select>
        </Campo>
        <Campo label="EJERCICIOS"><Input aria-label="Ejercicios por sesión" type="number" min={1} max={15} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} /></Campo>
      </div>
      {/* El tiempo manda: "el tiempo que el entrenador elige dicta la cantidad
          de ejercicio". Se recalcula al cambiar los minutos o el cardio, y
          queda editable por si quiere forzar otro número. */}
      <p className="text-micro mt-1.5 text-text-tertiary">
        {minutos} min {cardio !== "ninguno" ? `(−${cardioMinutos} de cardio) ` : ""}dan para {sugeridos} ejercicios de fuerza.
        {cantidad !== sugeridos && <button type="button" onClick={() => setCantidad(sugeridos)} className="ml-1 font-medium text-vip underline">Usar {sugeridos}</button>}
      </p>
      {distribucion === "personalizada" && <SelectorGruposDia dias={dias} valor={diaGrupos} onChange={setDiaGrupos} />}
      <Campo label={`TOPE DE EJERCICIOS POR GRUPO (OPCIONAL${resumenLimites ? ` — ${resumenLimites}` : ""})`}>
        <LimitesPorGrupo valor={limitesPorGrupo} onChange={setLimitesPorGrupo} />
      </Campo>
    </GavetaConfig>

    <GavetaConfig titulo="4. Nivel y calibración de volumen" subtitulo={`Intensidad ${intensidad} · técnicas ${tecnicasIntensidad}${inspiracionEstilo !== "ninguna" ? ` · ${INSPIRACION_LABEL[inspiracionEstilo]}` : ""}`}>
      <p className="text-micro text-text-tertiary">La experiencia del alumno (de su perfil) define el volumen base; esto solo lo ajusta.</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Campo label="INTENSIDAD DESEADA">
          <Select value={intensidad} onChange={(e) => setIntensidad(e.target.value as IntensidadDeseada)}>
            <option value="estandar">Estándar</option>
            <option value="alta">Alta (más series)</option>
            <option value="competitiva">Competitiva (alto volumen)</option>
          </Select>
        </Campo>
        <Campo label="TÉCNICAS DE INTENSIDAD">
          <Select value={tecnicasIntensidad} onChange={(e) => setTecnicasIntensidad(e.target.value as AplicacionTecnicas)}>
            <option value="automatico">Automático (según nivel)</option>
            <option value="si">Sí, incluir</option>
            <option value="no">No incluir</option>
          </Select>
        </Campo>
      </div>
      {tecnicasIntensidad !== "no" && (
        <Campo label="CUÁLES TÉCNICAS (OPCIONAL — vacío = todas las que el nivel permita)">
          <div className="flex flex-wrap gap-1">
            {tecnicas.map((t) => {
              const activa = tecnicasPermitidas.includes(t.slug);
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => setTecnicasPermitidas((v) => (v.includes(t.slug) ? v.filter((s) => s !== t.slug) : [...v, t.slug]))}
                  title={t.tipo === "encadenada" ? "Encadenada (une varios ejercicios)" : "Individual"}
                  className={`radius-control px-2 py-1 text-micro ${activa ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"}`}
                >
                  {t.nombre}
                </button>
              );
            })}
          </div>
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <Campo label="¿AYUDAS ERGOGÉNICAS?">
          <Select value={ayudasErgogenicas} onChange={(e) => setAyudasErgogenicas(e.target.value as AyudasErgogenicas)}>
            <option value="prefiere_no_decir">Prefiere no decir</option>
            <option value="no">No</option>
            <option value="si">Sí</option>
          </Select>
        </Campo>
        <Campo label="REFERENCIA FÍSICA / CATEGORÍA TÉCNICA">
          <Select value={categoriaCompetencia} onChange={(e) => setCategoriaCompetencia(e.target.value as CategoriaCompetencia)}>
            {REFERENCIAS_FISICAS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.tecnica} — {opcion.descripcion}
              </option>
            ))}
          </Select>
          <p className="text-micro mt-1 text-text-tertiary">La ficha la precarga; el entrenador puede cambiarla y tiene la decisión final.</p>
        </Campo>
      </div>
      <Campo label="INSPIRACIÓN DE ESTILO (OPCIONAL)">
        <Select value={inspiracionEstilo} onChange={(e) => setInspiracionEstilo(e.target.value as InspiracionEstilo)}>
          <option value="ninguna">Ninguna — mezcla habitual</option>
          <option value="alta_intensidad">Alta intensidad al fallo (Nick Walker, Hadi Choopan) — pocas series, técnicas individuales</option>
          <option value="volumen_tradicional">Volumen tradicional (Sam Sulek, Dana Linn Bailey) — bro-split, super/tri-series</option>
          <option value="hibrido_tension">Híbrido de tensión (CBum, Derek Lunsford, Cydney Gillon) — máquinas de alta estabilidad</option>
          <option value="cientifico_rir">Científico con RIR (Jeff Nippard, Francielle Mattos) — RIR indicado, rango elongado</option>
        </Select>
      </Campo>
    </GavetaConfig>

    </div>

    <div className="space-y-3 xl:sticky xl:top-24">
    <GavetaConfig titulo="5. Cardio y reglas VIP" subtitulo={cardio === "ninguno" ? "Sin cardio" : `Cardio ${cardio} · ${cardioMinutos} min`}>
      <div className="grid grid-cols-2 gap-1.5">
        <Campo label="CARDIO">
          <Select value={cardio} onChange={(e) => setCardio(e.target.value as BriefGenerador["cardio"])}>
            <option value="ninguno">Sin cardio</option>
            {modalidades.map((m) => (
              <option key={m} value={m}>{ETIQUETA_MODALIDAD[m]}</option>
            ))}
            {ejerciciosCardio.length > 0 && <option value="indistinto">Indistinto (lo que haya en sala)</option>}
          </Select>
        </Campo>
        <Campo label="MINUTOS"><Input type="number" min={0} max={90} value={cardioMinutos} onChange={(e) => setCardioMinutos(Number(e.target.value))} /></Campo>
      </div>
      {/* El funcional no es una máquina: son estaciones que rotan día a día.
          Si no se marca ninguna, el motor elige entre las disponibles. */}
      {cardio === "funcional" && (
        <div className="mt-1.5">
          <div className="mb-1.5 flex gap-1.5">
            {([["circuito", "En circuito"], ["separado", "Separados"]] as const).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => setCardioFormato(v)}
                className={`text-caption radius-control flex-1 py-1.5 font-medium ${cardioFormato === v ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-micro mb-1 text-text-tertiary">
            {cardioFormato === "circuito"
              ? "Se hacen seguidos, 3 vueltas con 30s entre estaciones."
              : "Cada uno como bloque aparte, con su descanso normal."}
          </p>
          <p className="text-micro mb-1 text-text-tertiary">MOVIMIENTOS {cardioEjercicios.length > 0 ? `(${cardioEjercicios.length} marcados)` : "(todos los disponibles)"}</p>
          <div className="flex flex-wrap gap-1">
            {ejerciciosCardio.length === 0 && <p className="text-micro text-warning">No hay ejercicios de cardio en la biblioteca. Agrégalos en “Agregar ejercicio”.</p>}
            {ejerciciosCardio.map((e) => {
              const marcado = cardioEjercicios.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => alternar(e.id, cardioEjercicios, setCardioEjercicios)}
                  className={`radius-control px-2 py-1 text-micro ${marcado ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"}`}
                >
                  {e.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {[[abdominales,setAbdominales,"Agregar core al final"],[evitarSaltos,setEvitarSaltos,"Excluir saltos e impacto alto"]].map(([v,s,t]) => <label key={String(t)} className="text-caption flex gap-2"><input type="checkbox" checked={v as boolean} onChange={(e) => (s as (x:boolean)=>void)(e.target.checked)} />{String(t)}</label>)}
    </GavetaConfig>

    <GavetaConfig titulo="6. Ejercicios obligatorios, preferidos y prohibidos" subtitulo={resumenEjercicios}>
      <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-text-tertiary" /><Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, grupo o equipo" className="pl-9" /></div>
      <div className="max-h-72 space-y-2 overflow-y-auto">{visibles.map((e) => <div key={e.id} className="radius-control border border-border p-2"><p className="text-caption font-medium">{e.nombre}</p><p className="text-micro text-text-tertiary">{e.grupo} · {e.equipo}</p><div className="mt-2 flex gap-1"><button type="button" onClick={() => alternar(e.id, obligatorios, setObligatorios)} className={`radius-control flex-1 py-1 text-micro ${obligatorios.includes(e.id) ? "bg-success text-black" : "bg-surface-2"}`}>Obligatorio</button><button type="button" onClick={() => alternar(e.id, preferidos, setPreferidos)} className={`radius-control flex-1 py-1 text-micro ${preferidos.includes(e.id) ? "bg-vip text-black" : "bg-surface-2"}`}>Preferido</button><button type="button" onClick={() => alternar(e.id, prohibidos, setProhibidos)} className={`radius-control flex-1 py-1 text-micro ${prohibidos.includes(e.id) ? "bg-error text-white" : "bg-surface-2"}`}>Prohibido</button></div></div>)}</div>
    </GavetaConfig>

    <GavetaConfig titulo="7. Observaciones" subtitulo={observaciones ? observaciones.slice(0, 40) : "Opcional"}>
      <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Observaciones del entrenador para este bloque" rows={3} />
    </GavetaConfig>

    <Card className="space-y-2 border border-vip/30 bg-vip/5 p-4">
      <p className="text-caption font-semibold text-text">Resumen antes de generar</p>
      <div className="grid grid-cols-2 gap-2 text-micro text-text-secondary">
        <span>{seleccionados.size} alumno{seleccionados.size === 1 ? "" : "s"}</span>
        <span>{dias} días · {minutos} min</span>
        <span>{OBJETIVO_LABEL[objetivo]}</span>
        <span>{ESTILO_LABEL[estilo]}</span>
      </div>
      <p className="text-micro text-text-tertiary">
        Se creará un borrador editable. Nada llega al alumno hasta que el entrenador lo revise y publique.
      </p>
    </Card>
    {error && <p className="text-caption text-error">{error}</p>}
          <Button
            onClick={generar}
            loading={pending}
            disabled={seleccionados.size === 0}
            disabledReason="Selecciona al menos un alumno para generar el borrador"
          >
            <Sparkles size={18} />{pending ? "Aplicando reglas…" : "Generar borrador para revisar"}
          </Button>
    </div>
  </div>;
}
