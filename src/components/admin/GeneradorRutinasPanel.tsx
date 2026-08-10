"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, MessageCircle, Search, Sparkles, UserPlus } from "lucide-react";
import { generarBorradorRutina, revisarBorradorConIA } from "@/app/admin/generador/actions";
import { RutinaDraftEditor } from "@/components/admin/RutinaDraftEditor";
import { GavetaConfig } from "@/components/admin/GavetaConfig";
import { SelectorAlumnos } from "@/components/admin/SelectorAlumnos";
import { SelectorGruposDia } from "@/components/admin/SelectorGruposDia";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { linkWhatsApp } from "@/lib/generador-rutinas/whatsapp";
import { ejerciciosPorTiempo, modalidadesCardioDisponibles } from "@/lib/generador-rutinas/motor";
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

/** Lo que el alumno respondió en "Mi entrenamiento". Se muestra tal cual al
 * elegirlo: el generador ya lo usa por dentro, pero el entrenador también
 * necesita verlo para saber a quién le está armando la rutina. */
type FichaAlumno = {
  objetivoPrincipal: string | null; experiencia: string | null; cardioNivel: string | null; preferenciaEquipo: string | null;
  molestias: string | null; lesiones: string | null; operaciones: string | null; condiciones: string | null;
  medicamentos: string | null; noDeseados: string | null; preferidos: string | null; actividades: string | null;
};
type Alumno = { id: string; nombre: string; telefono: string | null; objetivo: string | null; perfilCompleto: boolean; requiereRevision: boolean; dias: number | null; minutos: number | null; sinRutina: boolean; ficha: FichaAlumno };
type Ejercicio = { id: string; nombre: string; grupo: string; equipo: string };
type Tecnica = { slug: string; nombre: string; tipo: "individual" | "encadenada"; nivelMinimo: string };

/** La ficha que llenó el alumno, tal cual, al momento de elegirlo.
 *
 * El generador ya la usaba por dentro (y ahora también la lee el filtro de
 * IA), pero el entrenador la tenía invisible: para saber si a esa persona le
 * duele la rodilla o la operaron del hombro había que salir a otra pantalla.
 * Lo de salud va destacado; lo demás, en una línea de contexto. */
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
    alumno.dias ? `${alumno.dias} días` : null,
    alumno.minutos ? `${alumno.minutos} min` : null,
    f.preferenciaEquipo && f.preferenciaEquipo !== "indistinto" ? `Prefiere ${f.preferenciaEquipo.replaceAll("_", " ")}` : null,
    f.cardioNivel ? `Cardio actual ${f.cardioNivel}` : null,
  ].filter(Boolean);

  // Sin ficha el generador arma la rutina a ciegas (nivel principiante por
  // defecto, sin saber lesiones). Se dice acá, no en una alerta genérica.
  if (!alumno.perfilCompleto) {
    const wa = linkWhatsApp(alumno.telefono ?? "");
    return (
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
    );
  }

  return (
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

export function GeneradorRutinasPanel({ alumnos, ejercicios, tecnicas }: { alumnos: Alumno[]; ejercicios: Ejercicio[]; tecnicas: Tecnica[] }) {
  // Arranca vacío. Antes venía con el primer alumno de la lista ya marcado
  // (el primero alfabético), así que si el entrenador no miraba, generaba una
  // rutina para alguien que nunca eligió. El botón de generar ya está
  // deshabilitado sin selección.
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());
  const alumnosElegidos = alumnos.filter((a) => seleccionados.has(a.id));
  const primerAlumnoId = alumnosElegidos[0]?.id ?? alumnos[0]?.id ?? "";
  const nombrePrimerAlumno = alumnosElegidos[0]?.nombre ?? null;
  const sinRutina = alumnos.filter((a) => a.sinRutina);

  const [objetivo, setObjetivo] = useState<ObjetivoEntrenamiento>("hipertrofia");
  const [prioridad, setPrioridad] = useState<PrioridadBloque>("hipertrofia");
  const [grupoPrioritario, setGrupoPrioritario] = useState<GrupoEntrenable | "">("");
  const [enfoqueForma, setEnfoqueForma] = useState<EnfoqueForma>("ninguno");
  const [dias, setDias] = useState(3); const [minutos, setMinutos] = useState(60); const [cantidad, setCantidad] = useState(7);
  const [estilo, setEstilo] = useState<EstiloEntrenamiento>("hibrido");
  const [distribucion, setDistribucion] = useState<Distribucion>("automatica");
  const [diaGrupos, setDiaGrupos] = useState<EtiquetaDia[][]>([]);
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

  const elegirAlumnos = (ids: Set<string>) => {
    setSeleccionados(ids);
    if (ids.size === 1) {
      const a = alumnos.find((x) => ids.has(x.id));
      if (a?.dias) setDias(a.dias);
      if (a?.minutos) {
        setMinutos(a.minutos);
        setCantidad(ejerciciosPorTiempo(a.minutos, cardio === "ninguno" ? 0 : cardioMinutos));
      }
      // Punto de partida, no una decisión: el objetivo declarado por el
      // alumno en su ficha precarga el select, pero el entrenador lo puede
      // cambiar como cualquier otro campo del brief.
      if (a?.ficha.objetivoPrincipal) setObjetivo(a.ficha.objetivoPrincipal as ObjetivoEntrenamiento);
    }
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
        objetivo,
        prioridad,
        dias,
        minutosSesion: minutos,
        distribucion,
        diaGrupos: distribucion === "personalizada" ? diaGrupos : null,
        grupoPrioritario: grupoPrioritario || null,
        enfoqueForma,
        ejerciciosPorSesion: cantidad,
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
    {seleccionados.size > 1 && <Card padding="p-3" className="border border-warning"><p className="text-caption flex gap-2"><AlertTriangle size={16} />La rutina se generó —y se revisa— con la ficha de {nombrePrimerAlumno ?? "el primer alumno seleccionado"}. Los otros {seleccionados.size - 1} la reciben igual: revisa que les calce.</p></Card>}
    <Card padding="p-3"><p className="text-caption mb-2 font-semibold">Reglas aplicadas</p>{reglas.map((r) => <p key={r} className="text-caption flex gap-2 text-text-secondary"><CheckCircle2 size={14} className="text-success" />{r}</p>)}</Card>
    <RutinaDraftEditor
      alumnoIds={[...seleccionados]}
      draftInicial={rutina}
      onDescartar={() => setRutina(null)}
      ejercicios={ejercicios.map((e) => ({ id: e.id, nombre: e.nombre, grupo: e.grupo, equipo: e.equipo }))}
      onRevisar={briefUsado ? (borrador) => revisarBorradorConIA({ alumnoId: primerAlumnoId, brief: briefUsado, rutina: borrador, reglas, borradorId }) : undefined}
    />
  </div>;

  const resumenEjercicios = `${obligatorios.length} obligatorios · ${preferidos.length} preferidos · ${prohibidos.length} prohibidos`;

  return <div className="space-y-2">
    <GavetaConfig titulo="1. Alumnos" subtitulo={`${seleccionados.size} seleccionado${seleccionados.size === 1 ? "" : "s"}${sinRutina.length > 0 ? ` · ${sinRutina.length} sin rutina activa` : ""}`} abiertaPorDefecto>
      <SelectorAlumnos alumnos={alumnos} seleccionados={seleccionados} onCambiar={elegirAlumnos} />
      <p className="text-micro text-text-tertiary">Si eliges varios, se genera una sola rutina con el perfil del primero y se asigna a todos al publicar.</p>
      {alumnosElegidos.length === 1 && <FichaDelAlumno alumno={alumnosElegidos[0]} />}
      {alumnosElegidos.length > 1 && alumnosElegidos.some((a) => !a.perfilCompleto) && <p className="text-caption text-warning">Algún alumno aún no completó “Mi entrenamiento”. Puedes generar igualmente y definir los datos tú.</p>}
      {alumnosElegidos.some((a) => a.requiereRevision) && <p className="text-caption flex gap-2 text-warning"><AlertTriangle size={16} />Hay antecedentes de salud o molestias pendientes de revisión en algún alumno elegido. El sistema no diagnostica ni reemplaza tu criterio.</p>}
      {sinRutina.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="text-caption mb-1.5 text-text-tertiary">SIN RUTINA ACTIVA</p>
          <div className="space-y-1">
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
        </div>
      )}
    </GavetaConfig>

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
          <option value="automatica">Automática (según los días)</option>
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
        <Campo label="CATEGORÍA DE COMPETENCIA">
          <Select value={categoriaCompetencia} onChange={(e) => setCategoriaCompetencia(e.target.value as CategoriaCompetencia)}>
            <option value="ninguna">Ninguna</option>
            <option value="mens_physique">Men&apos;s Physique</option>
            <option value="classic_physique">Classic Physique</option>
            <option value="bodybuilding_open">Bodybuilding Open</option>
            <option value="bikini">Bikini</option>
            <option value="wellness">Wellness</option>
            <option value="womens_physique">Women&apos;s Physique</option>
          </Select>
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

    {error && <p className="text-caption text-error">{error}</p>}
    <Button onClick={generar} loading={pending} disabled={seleccionados.size === 0}><Sparkles size={18} />{pending ? "Aplicando reglas…" : "Generar borrador para revisar"}</Button>
  </div>;
}
