"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowDown, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FlaskConical, Save, ShieldAlert } from "lucide-react";
import { calcularDosisVipV2 } from "@/lib/generador-rutinas-v2/dosis";
import { evaluarEntrevistaVipV2 } from "@/lib/generador-rutinas-v2/entrevista";
import { construirSemanaVipV2, type EjercicioConstructorV2 } from "@/lib/generador-rutinas-v2/constructor-semanal";
import { ConstructorSemanalV2Preview } from "@/components/admin/ConstructorSemanalV2Preview";
import { MesaEdicionV2 } from "@/components/admin/MesaEdicionV2";
import {
  GRUPOS_DOSIS_V2,
  type ContextoEspecial,
  type EntrevistaVipV2,
  type EstadoFuncion,
  type GrupoDosisV2,
  type NivelRecuperacion,
  type RespuestaSiNo,
} from "@/lib/generador-rutinas-v2/tipos";

export type AlumnoGeneradorV2 = {
  id: string;
  nombre: string;
  perfilCompleto: boolean;
  entrevistaInicial: EntrevistaVipV2;
};

type Props = { alumnos: AlumnoGeneradorV2[]; catalogo: EjercicioConstructorV2[] };

const PASOS = [
  "Persona",
  "Seguridad",
  "Función y nivel",
  "Objetivo",
  "Dosis y recuperación",
  "Recursos y medición",
] as const;

const CONTEXTOS: Array<{ value: Exclude<ContextoEspecial, "ninguno">; label: string }> = [
  { value: "retorno_inactividad", label: "Retorno tras inactividad" },
  { value: "embarazo_posparto", label: "Embarazo o posparto" },
  { value: "discapacidad_fisica", label: "Discapacidad física" },
  { value: "discapacidad_sensorial", label: "Discapacidad sensorial" },
  { value: "discapacidad_intelectual", label: "Discapacidad intelectual" },
  { value: "fragilidad_riesgo_caida", label: "Fragilidad o riesgo de caída" },
  { value: "deporte_adaptado", label: "Deporte adaptado" },
];

const DIVISIONES = [
  ["mens_open", "Men's Open"], ["mens_212", "212"], ["classic_physique", "Classic Physique"],
  ["mens_physique", "Men's Physique"], ["mens_wheelchair", "Men's Wheelchair"],
  ["womens_bodybuilding", "Women's Bodybuilding"], ["fitness", "Fitness"], ["figure", "Figure"],
  ["bikini", "Bikini"], ["womens_physique", "Women's Physique"], ["wellness", "Wellness"],
  ["fit_model", "Fit Model"], ["otra", "Otra federación o división"],
] as const;

const OBJETIVOS = [
  ["salud", "Salud general"], ["hipertrofia", "Hipertrofia"], ["fuerza", "Fuerza"],
  ["potencia", "Potencia"], ["perdida_grasa", "Pérdida de grasa"], ["recomposicion", "Recomposición"],
  ["rendimiento", "Rendimiento deportivo"], ["funcionalidad", "Funcionalidad"], ["competencia", "Competencia"],
] as const;

const CAMPO = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm text-text outline-none transition focus:border-vip/60 focus:ring-2 focus:ring-vip/10";
const ETIQUETA = "mb-1.5 block text-sm font-semibold text-text";

function RespuestaSelect({ value, onChange, ariaLabel }: { value: RespuestaSiNo; onChange: (value: RespuestaSiNo) => void; ariaLabel: string }) {
  return (
    <select aria-label={ariaLabel} className={CAMPO} value={value} onChange={(event) => onChange(event.target.value as RespuestaSiNo)}>
      <option value="sin_responder">Sin responder</option>
      <option value="no">No</option>
      <option value="si">Sí</option>
    </select>
  );
}

function FuncionSelect({ value, onChange, ariaLabel }: { value: EstadoFuncion; onChange: (value: EstadoFuncion) => void; ariaLabel: string }) {
  return (
    <select aria-label={ariaLabel} className={CAMPO} value={value} onChange={(event) => onChange(event.target.value as EstadoFuncion)}>
      <option value="sin_responder">Sin responder</option>
      <option value="sin_limitacion">Sin limitación relevante</option>
      <option value="limitado">Limitado, requiere adaptación</option>
      <option value="requiere_asistencia">Requiere asistencia</option>
    </select>
  );
}

function EscalaRecuperacion({ value, onChange, ariaLabel }: { value: NivelRecuperacion | null; onChange: (value: NivelRecuperacion | null) => void; ariaLabel: string }) {
  return (
    <select aria-label={ariaLabel} className={CAMPO} value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) as NivelRecuperacion : null)}>
      <option value="">Sin responder</option>
      <option value="1">1 · Muy desfavorable</option>
      <option value="2">2 · Bajo</option>
      <option value="3">3 · Normal</option>
      <option value="4">4 · Bueno</option>
      <option value="5">5 · Excelente</option>
    </select>
  );
}

function etiquetaGrupo(grupo: GrupoDosisV2) {
  return ({ pecho: "Pecho", espalda: "Espalda", hombros: "Hombros", brazos: "Brazos", cuadriceps: "Cuádriceps", femorales: "Femorales", gluteos: "Glúteos", pantorrillas: "Pantorrillas", core: "Core" })[grupo];
}

function claveLocal(alumnoId: string) {
  return `vip:generador-v2:entrevista:v1:${alumnoId}`;
}

function firmaSemanaEditable(alumnoId: string, semana: NonNullable<ReturnType<typeof construirSemanaVipV2>>) {
  const ejercicios = semana.dias.flatMap((dia) => dia.ejercicios.map((ejercicio) => [
    dia.numero,
    dia.nombre,
    ejercicio.ejercicioId,
    ejercicio.series,
    ejercicio.repeticiones,
    ejercicio.rir,
    ejercicio.descansoSegundos,
  ].join(":")));
  return `${alumnoId}:${semana.estado}:${ejercicios.join("|")}`;
}

function cargarLocal(alumnoId: string, fallback: EntrevistaVipV2): EntrevistaVipV2 {
  try {
    const raw = window.localStorage.getItem(claveLocal(alumnoId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as EntrevistaVipV2;
    if (parsed.version !== 1 || parsed.alumnoId !== alumnoId) return fallback;
    // Compatibilidad con entrevistas guardadas antes de que existiera el
    // selector recomendado/manual. No se descarta el trabajo del entrenador.
    return {
      ...fallback,
      ...parsed,
      recursos: {
        ...fallback.recursos,
        ...parsed.recursos,
        modoDistribucionDias: parsed.recursos?.modoDistribucionDias ?? "recomendada",
      },
    };
  } catch {
    return fallback;
  }
}

export function GeneradorRutinasV2Panel({ alumnos, catalogo }: Props) {
  const primerAlumno = alumnos[0] ?? null;
  const [alumnoId, setAlumnoId] = useState(primerAlumno?.id ?? "");
  const [entrevista, setEntrevista] = useState<EntrevistaVipV2 | null>(primerAlumno?.entrevistaInicial ?? null);
  const [paso, setPaso] = useState(0);
  const [guardado, setGuardado] = useState(false);
  const evaluacion = useMemo(() => entrevista ? evaluarEntrevistaVipV2(entrevista) : null, [entrevista]);
  const dosis = useMemo(() => entrevista ? calcularDosisVipV2(entrevista) : null, [entrevista]);
  const semana = useMemo(() => entrevista && dosis ? construirSemanaVipV2(entrevista, dosis, catalogo) : null, [entrevista, dosis, catalogo]);
  const alumno = alumnos.find((item) => item.id === alumnoId) ?? null;

  if (!entrevista || !alumno) {
    return <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-secondary">No hay alumnos disponibles para iniciar una entrevista.</div>;
  }

  const elegirAlumno = (nuevoId: string) => {
    const elegido = alumnos.find((item) => item.id === nuevoId);
    if (!elegido) return;
    setAlumnoId(nuevoId);
    setEntrevista(cargarLocal(nuevoId, elegido.entrevistaInicial));
    setPaso(0);
    setGuardado(false);
  };

  const guardar = () => {
    window.localStorage.setItem(claveLocal(alumno.id), JSON.stringify(entrevista));
    setGuardado(true);
  };

  const avanzar = () => {
    if (paso < PASOS.length - 1) {
      setPaso((actual) => actual + 1);
      return;
    }

    const resultado = document.getElementById("resultado-generador-v2");
    resultado?.scrollIntoView({ behavior: "smooth", block: "start" });
    resultado?.focus({ preventScroll: true });
  };

  const cambiarContexto = (contexto: Exclude<ContextoEspecial, "ninguno">, activo: boolean) => {
    setEntrevista((actual) => {
      if (!actual) return actual;
      const sinNinguno = actual.persona.contextos.filter((item) => item !== "ninguno");
      const contextos = activo ? Array.from(new Set([...sinNinguno, contexto])) : sinNinguno.filter((item) => item !== contexto);
      return { ...actual, persona: { ...actual.persona, contextos: contextos.length > 0 ? contextos : ["ninguno"] } };
    });
  };

  const estadoColor = evaluacion?.estadoSeguridad === "bloqueado" ? "text-error" : evaluacion?.estadoSeguridad === "requiere_revision" ? "text-warning" : evaluacion?.estadoSeguridad === "habilitado" ? "text-success" : "text-text-secondary";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-vip/20 bg-vip/5 p-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-vip/10 p-2 text-vip"><FlaskConical size={20} /></span>
          <div>
            <p className="font-semibold text-text">Modo laboratorio</p>
            <p className="mt-0.5 max-w-2xl text-sm text-text-secondary">Esta entrevista clasifica, calcula una dosis auditable y termina en una publicación versionada con comparación e historial.</p>
          </div>
        </div>
        <Link href="/admin/generador" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text">Abrir generador actual</Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label>
              <span className={ETIQUETA}>Persona o atleta</span>
              <select className={CAMPO} value={alumnoId} onChange={(event) => elegirAlumno(event.target.value)}>
                {alumnos.map((item) => <option key={item.id} value={item.id}>{item.nombre}{item.perfilCompleto ? "" : " · ficha incompleta"}</option>)}
              </select>
            </label>
            <button type="button" onClick={guardar} className="flex items-center justify-center gap-2 rounded-xl bg-vip px-4 py-2.5 text-sm font-bold text-white hover:brightness-110">
              <Save size={16} /> {guardado ? "Borrador guardado" : "Guardar en este dispositivo"}
            </button>
          </div>

          <div className="mb-6 flex flex-wrap gap-2" aria-label="Pasos de la entrevista">
            {PASOS.map((nombre, indice) => (
              <button key={nombre} type="button" onClick={() => setPaso(indice)} aria-current={paso === indice ? "step" : undefined} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${paso === indice ? "border-vip bg-vip text-white" : "border-border text-text-secondary hover:text-text"}`}>
                {indice + 1}. {nombre}
              </button>
            ))}
          </div>

          <div className="min-h-[480px]">
            {paso === 0 ? (
              <div className="space-y-5">
                <div><h2 className="text-lg font-bold text-text">¿A quién entrenamos?</h2><p className="mt-1 text-sm text-text-secondary">La edad describe contexto; no asigna por sí sola una rutina.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={ETIQUETA}>Edad</span><input className={CAMPO} type="number" min={10} max={100} value={entrevista.persona.edad ?? ""} onChange={(event) => setEntrevista({ ...entrevista, persona: { ...entrevista.persona, edad: event.target.value ? Number(event.target.value) : null } })} /></label>
                  <label><span className={ETIQUETA}>Etapa de vida</span><select className={CAMPO} value={entrevista.persona.etapaVida} onChange={(event) => setEntrevista({ ...entrevista, persona: { ...entrevista.persona, etapaVida: event.target.value as EntrevistaVipV2["persona"]["etapaVida"] } })}><option value="joven">Joven o adolescente</option><option value="adulto">Adulto</option><option value="adulto_mayor">Adulto mayor</option></select></label>
                  <label><span className={ETIQUETA}>Modalidad</span><select className={CAMPO} value={entrevista.persona.modalidad} onChange={(event) => setEntrevista({ ...entrevista, persona: { ...entrevista.persona, modalidad: event.target.value as "individual" | "grupal" } })}><option value="individual">Entrenamiento individual</option><option value="grupal">Entrenamiento grupal</option></select></label>
                </div>
                <fieldset><legend className={ETIQUETA}>Contextos que cambian preguntas o supervisión</legend><div className="grid gap-2 sm:grid-cols-2">{CONTEXTOS.map((item) => <label key={item.value} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm text-text-secondary"><input type="checkbox" checked={entrevista.persona.contextos.includes(item.value)} onChange={(event) => cambiarContexto(item.value, event.target.checked)} className="h-4 w-4 accent-vip" />{item.label}</label>)}</div></fieldset>
              </div>
            ) : null}

            {paso === 1 ? (
              <div className="space-y-5">
                <div><h2 className="text-lg font-bold text-text">¿Hay algo que obligue a frenar o adaptar?</h2><p className="mt-1 text-sm text-text-secondary">Esta puerta decide habilitado, revisión obligatoria o bloqueo. No diagnostica.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ["sintomasAlarma", "¿Hay síntomas de alarma?"], ["condicionInestable", "¿Existe una condición inestable?"],
                    ["dolorActual", "¿Hay dolor o molestia actual?"], ["cirugiaReciente", "¿Hay cirugía o procedimiento reciente?"],
                    ["caidasRecientes", "¿Hubo caídas recientes?"], ["requiereCoordinacionProfesional", "¿Requiere coordinación profesional?"],
                  ] as const).map(([campo, label]) => <label key={campo}><span className={ETIQUETA}>{label}</span><RespuestaSelect ariaLabel={label} value={entrevista.seguridad[campo]} onChange={(value) => setEntrevista({ ...entrevista, seguridad: { ...entrevista.seguridad, [campo]: value } })} /></label>)}
                  {entrevista.seguridad.cirugiaReciente === "si" ? <label><span className={ETIQUETA}>¿Tiene alta para entrenar?</span><RespuestaSelect ariaLabel="Alta posterior a cirugía" value={entrevista.seguridad.altaProfesionalSiAplica} onChange={(value) => setEntrevista({ ...entrevista, seguridad: { ...entrevista.seguridad, altaProfesionalSiAplica: value } })} /></label> : null}
                </div>
                <label><span className={ETIQUETA}>Detalle útil para entrenar</span><textarea className={`${CAMPO} min-h-24`} value={entrevista.seguridad.detalle} onChange={(event) => setEntrevista({ ...entrevista, seguridad: { ...entrevista.seguridad, detalle: event.target.value } })} placeholder="Qué ocurre, con qué movimiento, restricciones y profesional que indicó la adaptación" /></label>
              </div>
            ) : null}

            {paso === 2 ? (
              <div className="space-y-5">
                <div><h2 className="text-lg font-bold text-text">¿Qué puede hacer hoy y qué nivel demuestra?</h2><p className="mt-1 text-sm text-text-secondary">Discapacidad no es un preset; se registra la función concreta. Los años tampoco demuestran por sí solos un nivel.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">{([
                  ["movilidad", "Movilidad"], ["estabilidad", "Estabilidad"], ["controlTronco", "Control de tronco"], ["agarre", "Agarre"],
                  ["transferencia", "Transferencia"], ["equilibrio", "Equilibrio"], ["rangoActivo", "Rango activo"], ["comunicacion", "Comunicación"],
                ] as const).map(([campo, label]) => <label key={campo}><span className={ETIQUETA}>{label}</span><FuncionSelect ariaLabel={label} value={entrevista.funcion[campo]} onChange={(value) => setEntrevista({ ...entrevista, funcion: { ...entrevista.funcion, [campo]: value } })} /></label>)}</div>
                <label><span className={ETIQUETA}>Ayudas técnicas, prótesis, órtesis o accesibilidad</span><textarea className={`${CAMPO} min-h-20`} value={entrevista.funcion.ayudasTecnicas} onChange={(event) => setEntrevista({ ...entrevista, funcion: { ...entrevista.funcion, ayudasTecnicas: event.target.value } })} /></label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label><span className={ETIQUETA}>Meses de práctica consistente</span><input className={CAMPO} type="number" min={0} max={600} value={entrevista.experiencia.practicaConsistenteMeses ?? ""} onChange={(event) => setEntrevista({ ...entrevista, experiencia: { ...entrevista.experiencia, practicaConsistenteMeses: event.target.value ? Number(event.target.value) : null } })} /></label>
                  {([ ["tecnicaReproducible", "¿Técnica reproducible?"], ["estimaRir", "¿Estima RIR?"], ["registraCargas", "¿Registra cargas?"], ["autorregula", "¿Puede autorregular?"], ] as const).map(([campo, label]) => <label key={campo}><span className={ETIQUETA}>{label}</span><RespuestaSelect ariaLabel={label} value={entrevista.experiencia[campo]} onChange={(value) => setEntrevista({ ...entrevista, experiencia: { ...entrevista.experiencia, [campo]: value } })} /></label>)}
                  <label><span className={ETIQUETA}>Nivel declarado</span><select className={CAMPO} value={entrevista.experiencia.nivelDeclarado} onChange={(event) => setEntrevista({ ...entrevista, experiencia: { ...entrevista.experiencia, nivelDeclarado: event.target.value as EntrevistaVipV2["experiencia"]["nivelDeclarado"] } })}><option value="novato">Novato</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option><option value="elite_profesional">Élite/profesional</option></select></label>
                </div>
              </div>
            ) : null}

            {paso === 3 ? (
              <div className="space-y-5">
                <div><h2 className="text-lg font-bold text-text">¿Para qué entrenamos?</h2><p className="mt-1 text-sm text-text-secondary">La categoría orienta prioridades; no entrega una rutina automática.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={ETIQUETA}>Objetivo principal</span><select className={CAMPO} value={entrevista.objetivo.principal ?? ""} onChange={(event) => setEntrevista({ ...entrevista, objetivo: { ...entrevista.objetivo, principal: event.target.value as EntrevistaVipV2["objetivo"]["principal"] || null } })}><option value="">Seleccionar</option>{OBJETIVOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span className={ETIQUETA}>Objetivo secundario</span><select className={CAMPO} value={entrevista.objetivo.secundario ?? ""} onChange={(event) => setEntrevista({ ...entrevista, objetivo: { ...entrevista.objetivo, secundario: event.target.value as EntrevistaVipV2["objetivo"]["secundario"] || null } })}><option value="">Sin objetivo secundario</option>{OBJETIVOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span className={ETIQUETA}>Plazo en semanas</span><input className={CAMPO} type="number" min={1} max={104} value={entrevista.objetivo.plazoSemanas ?? ""} onChange={(event) => setEntrevista({ ...entrevista, objetivo: { ...entrevista.objetivo, plazoSemanas: event.target.value ? Number(event.target.value) : null } })} /></label>
                  <label><span className={ETIQUETA}>¿Compite?</span><RespuestaSelect ariaLabel="¿Compite?" value={entrevista.competencia.compite} onChange={(value) => setEntrevista({ ...entrevista, competencia: { ...entrevista.competencia, compite: value } })} /></label>
                </div>
                <label><span className={ETIQUETA}>¿Qué no queremos sacrificar?</span><textarea className={`${CAMPO} min-h-20`} value={entrevista.objetivo.noSacrificar} onChange={(event) => setEntrevista({ ...entrevista, objetivo: { ...entrevista.objetivo, noSacrificar: event.target.value } })} placeholder="Ej: mantener fuerza, salud articular, deporte paralelo o tiempo familiar" /></label>
                {entrevista.competencia.compite === "si" ? <div className="rounded-2xl border border-vip/20 bg-vip/5 p-4"><h3 className="mb-4 font-bold text-text">Rama competitiva</h3><div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={ETIQUETA}>División</span><select className={CAMPO} value={entrevista.competencia.division ?? ""} onChange={(event) => setEntrevista({ ...entrevista, competencia: { ...entrevista.competencia, division: event.target.value as EntrevistaVipV2["competencia"]["division"] || null } })}><option value="">Seleccionar</option>{DIVISIONES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label><span className={ETIQUETA}>Fase</span><select className={CAMPO} value={entrevista.competencia.fase ?? ""} onChange={(event) => setEntrevista({ ...entrevista, competencia: { ...entrevista.competencia, fase: event.target.value as EntrevistaVipV2["competencia"]["fase"] || null } })}><option value="">Seleccionar</option><option value="fuera_temporada">Fuera de temporada</option><option value="preparacion_general">Preparación general</option><option value="preparacion_especifica">Preparación específica</option><option value="puesta_a_punto">Puesta a punto</option><option value="post_competencia">Postcompetencia</option></select></label>
                  <label><span className={ETIQUETA}>Fecha del evento</span><input className={CAMPO} type="date" value={entrevista.competencia.fechaEvento ?? ""} onChange={(event) => setEntrevista({ ...entrevista, competencia: { ...entrevista.competencia, fechaEvento: event.target.value || null } })} /></label>
                  <label><span className={ETIQUETA}>Puntos débiles</span><input className={CAMPO} value={entrevista.competencia.puntosDebiles} onChange={(event) => setEntrevista({ ...entrevista, competencia: { ...entrevista.competencia, puntosDebiles: event.target.value } })} /></label>
                </div></div> : null}
              </div>
            ) : null}

            {paso === 4 ? (
              <div className="space-y-5">
                <div><h2 className="text-lg font-bold text-text">¿Qué venía tolerando y cómo está recuperando?</h2><p className="mt-1 text-sm text-text-secondary">La dosis empieza en las últimas 4–6 semanas, no en un preset.</p></div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label><span className={ETIQUETA}>Punto de partida</span><select className={CAMPO} value={entrevista.dosisReciente.estadoHistorial} onChange={(event) => setEntrevista({ ...entrevista, dosisReciente: { ...entrevista.dosisReciente, estadoHistorial: event.target.value as EntrevistaVipV2["dosisReciente"]["estadoHistorial"] } })}><option value="sin_responder">Sin responder</option><option value="con_historial">Tiene 4–6 semanas registrables</option><option value="novato_sin_historial">Novato sin historial</option><option value="retorno_sin_historial">Retorno sin historial reciente</option></select></label>
                  <label><span className={ETIQUETA}>Semanas observadas</span><input className={CAMPO} type="number" min={0} max={6} value={entrevista.dosisReciente.semanasObservadas} onChange={(event) => setEntrevista({ ...entrevista, dosisReciente: { ...entrevista.dosisReciente, semanasObservadas: Number(event.target.value) } })} /></label>
                  <label><span className={ETIQUETA}>Días por semana</span><input className={CAMPO} type="number" min={0} max={7} value={entrevista.dosisReciente.diasPorSemana ?? ""} onChange={(event) => setEntrevista({ ...entrevista, dosisReciente: { ...entrevista.dosisReciente, diasPorSemana: event.target.value ? Number(event.target.value) : null } })} /></label>
                  <label><span className={ETIQUETA}>RIR habitual</span><input className={CAMPO} type="number" min={0} max={6} value={entrevista.dosisReciente.rirHabitual ?? ""} onChange={(event) => setEntrevista({ ...entrevista, dosisReciente: { ...entrevista.dosisReciente, rirHabitual: event.target.value ? Number(event.target.value) : null } })} /></label>
                </div>
                <fieldset><legend className={ETIQUETA}>Series directas semanales recientes</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{GRUPOS_DOSIS_V2.map((grupo) => <label key={grupo}><span className="mb-1 block text-xs text-text-secondary">{etiquetaGrupo(grupo)}</span><input aria-label={`Series de ${etiquetaGrupo(grupo)}`} className={CAMPO} type="number" min={0} max={40} value={entrevista.dosisReciente.seriesPorGrupo[grupo] ?? ""} onChange={(event) => setEntrevista({ ...entrevista, dosisReciente: { ...entrevista.dosisReciente, seriesPorGrupo: { ...entrevista.dosisReciente.seriesPorGrupo, [grupo]: event.target.value ? Number(event.target.value) : null } } })} /></label>)}</div></fieldset>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{([
                  ["sueno", "Sueño"], ["energia", "Energía"], ["estres", "Estrés (5 = bajo)"], ["doms", "Dolor muscular (5 = bajo)"], ["apetito", "Apetito"],
                ] as const).map(([campo, label]) => <label key={campo}><span className={ETIQUETA}>{label}</span><EscalaRecuperacion ariaLabel={label} value={entrevista.recuperacion[campo]} onChange={(value) => setEntrevista({ ...entrevista, recuperacion: { ...entrevista.recuperacion, [campo]: value } })} /></label>)}</div>
                <label><span className={ETIQUETA}>Cardio, pasos, deporte o trabajo físico adicional</span><textarea className={`${CAMPO} min-h-20`} value={entrevista.recuperacion.actividadConcurrente} onChange={(event) => setEntrevista({ ...entrevista, recuperacion: { ...entrevista.recuperacion, actividadConcurrente: event.target.value } })} /></label>
              </div>
            ) : null}

            {paso === 5 ? (
              <div className="space-y-5">
                <div><h2 className="text-lg font-bold text-text">¿Con qué contamos y cómo sabremos si funciona?</h2><p className="mt-1 text-sm text-text-secondary">Tiempo, equipo y seguimiento son restricciones reales del programa.</p></div>
                <fieldset>
                  <legend className={ETIQUETA}>Distribución semanal</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ["recomendada", "Usar recomendación del motor", "El motor elige los días según nivel, recuperación y contexto."],
                      ["manual", "Elegir días manualmente", "Respeta tus días y reparte la dosis semanal sin aumentarla."],
                    ] as const).map(([modo, titulo, descripcion]) => {
                      const activa = (entrevista.recursos.modoDistribucionDias ?? "recomendada") === modo;
                      return (
                        <button key={modo} type="button" aria-pressed={activa} onClick={() => setEntrevista({ ...entrevista, recursos: { ...entrevista.recursos, modoDistribucionDias: modo } })} className={`rounded-xl border p-3 text-left transition ${activa ? "border-vip bg-vip/10 ring-2 ring-vip/10" : "border-border bg-bg hover:border-vip/35"}`}>
                          <span className={`block text-sm font-bold ${activa ? "text-vip" : "text-text"}`}>{titulo}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-text-secondary">{descripcion}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 rounded-xl border border-border bg-bg p-3 text-xs leading-relaxed text-text-secondary">
                    {(entrevista.recursos.modoDistribucionDias ?? "recomendada") === "manual"
                      ? `Modo manual: se programarán ${entrevista.recursos.diasReales ?? "los"} días. ${dosis?.estructura.diasSugeridosMotor ? `El motor sugiere ${dosis.estructura.diasSugeridosMotor}, pero conservará la misma dosis semanal y hará sesiones más breves.` : "Completa la entrevista para ver la sugerencia del motor."}`
                      : "Modo recomendado: los días disponibles son un máximo; el motor puede elegir menos según la recuperación y el nivel demostrado."}
                  </p>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className={ETIQUETA}>{(entrevista.recursos.modoDistribucionDias ?? "recomendada") === "manual" ? "Días que quieres programar" : "Días reales disponibles"}</span><input className={CAMPO} type="number" min={1} max={7} value={entrevista.recursos.diasReales ?? ""} onChange={(event) => setEntrevista({ ...entrevista, recursos: { ...entrevista.recursos, diasReales: event.target.value ? Number(event.target.value) : null } })} /></label>
                  <label><span className={ETIQUETA}>Minutos reales por sesión</span><input className={CAMPO} type="number" min={20} max={180} value={entrevista.recursos.minutosSesion ?? ""} onChange={(event) => setEntrevista({ ...entrevista, recursos: { ...entrevista.recursos, minutosSesion: event.target.value ? Number(event.target.value) : null } })} /></label>
                  <label><span className={ETIQUETA}>Equipo</span><select className={CAMPO} value={entrevista.recursos.equipo} onChange={(event) => setEntrevista({ ...entrevista, recursos: { ...entrevista.recursos, equipo: event.target.value as EntrevistaVipV2["recursos"]["equipo"] } })}><option value="sin_responder">Sin responder</option><option value="gimnasio_completo">Gimnasio completo</option><option value="maquinas">Principalmente máquinas</option><option value="peso_libre">Principalmente peso libre</option><option value="casa">Casa</option><option value="adaptado">Equipo adaptado</option></select></label>
                  <label><span className={ETIQUETA}>Supervisión</span><select className={CAMPO} value={entrevista.recursos.supervision} onChange={(event) => setEntrevista({ ...entrevista, recursos: { ...entrevista.recursos, supervision: event.target.value as EntrevistaVipV2["recursos"]["supervision"] } })}><option value="sin_responder">Sin responder</option><option value="siempre">Siempre supervisado</option><option value="parcial">Supervisión parcial</option><option value="sin_supervision">Entrena sin supervisión</option></select></label>
                  <label><span className={ETIQUETA}>Influencia metodológica</span><select className={CAMPO} value={entrevista.preferencias.estiloComoInfluencia} onChange={(event) => setEntrevista({ ...entrevista, preferencias: { ...entrevista.preferencias, estiloComoInfluencia: event.target.value as EntrevistaVipV2["preferencias"]["estiloComoInfluencia"] } })}><option value="ninguna">Sin influencia</option><option value="hit">HIT / alta intensidad</option><option value="volumen_clasico">Volumen clásico</option><option value="hibrido">Híbrido</option><option value="rir_autoregulado">RIR / autorregulado</option></select></label>
                  <label><span className={ETIQUETA}>Revisar cada cuántas semanas</span><input className={CAMPO} type="number" min={1} max={12} value={entrevista.medicion.revisionCadaSemanas ?? ""} onChange={(event) => setEntrevista({ ...entrevista, medicion: { ...entrevista.medicion, revisionCadaSemanas: event.target.value ? Number(event.target.value) : null } })} /></label>
                </div>
                <fieldset><legend className={ETIQUETA}>Métricas de revisión</legend><div className="flex flex-wrap gap-2">{(["carga", "repeticiones", "rir", "perimetros", "rendimiento", "dolor", "fatiga", "asistencia"] as const).map((metrica) => { const activa = entrevista.medicion.metricas.includes(metrica); return <button key={metrica} type="button" aria-pressed={activa} onClick={() => setEntrevista({ ...entrevista, medicion: { ...entrevista.medicion, metricas: activa ? entrevista.medicion.metricas.filter((item) => item !== metrica) : [...entrevista.medicion.metricas, metrica] } })} className={`rounded-full border px-3 py-1.5 text-sm capitalize ${activa ? "border-vip bg-vip/10 font-semibold text-vip" : "border-border text-text-secondary"}`}>{metrica}</button>; })}</div></fieldset>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <button type="button" disabled={paso === 0} onClick={() => setPaso((actual) => Math.max(0, actual - 1))} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-secondary disabled:opacity-40"><ChevronLeft size={16} /> Anterior</button>
            <button type="button" onClick={avanzar} className="flex items-center gap-2 rounded-xl bg-vip px-4 py-2 text-sm font-bold text-white hover:brightness-110">
              {paso === PASOS.length - 1 ? <>Ver resultado <ArrowDown size={16} /></> : <>Siguiente <ChevronRight size={16} /></>}
            </button>
          </div>
        </section>

        <aside className="self-start rounded-2xl border border-border bg-surface p-4 xl:sticky xl:top-4">
          <div className="flex items-center gap-2"><ClipboardCheck size={18} className="text-vip" /><h2 className="font-bold text-text">Lectura del motor</h2></div>
          <div className={`mt-4 flex items-start gap-2 rounded-xl border border-border bg-bg p-3 ${estadoColor}`}>
            {evaluacion?.estadoSeguridad === "bloqueado" ? <ShieldAlert size={18} /> : evaluacion?.estadoSeguridad === "habilitado" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <div><p className="text-sm font-bold capitalize">{evaluacion?.estadoSeguridad.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-text-secondary">Puerta de seguridad</p></div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Nivel calculado</dt><dd className="mt-1 font-semibold capitalize text-text">{evaluacion?.nivelExperienciaCalculado.replaceAll("_", " ")}</dd></div>
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Confianza</dt><dd className="mt-1 font-semibold capitalize text-text">{evaluacion?.confianza}</dd></div>
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Calcular dosis</dt><dd className={`mt-1 font-semibold ${evaluacion?.puedeCalcularDosis ? "text-success" : "text-text-secondary"}`}>{evaluacion?.puedeCalcularDosis ? "Sí" : "Aún no"}</dd></div>
            <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Construir semana</dt><dd className={`mt-1 font-semibold ${evaluacion?.puedeConstruirSemana ? "text-success" : "text-text-secondary"}`}>{evaluacion?.puedeConstruirSemana ? "Sí" : "Aún no"}</dd></div>
          </dl>
          {evaluacion?.razonesSeguridad.length ? <div className="mt-4"><p className="text-sm font-semibold text-text">Razones de seguridad</p><ul className="mt-2 space-y-2 text-sm text-text-secondary">{evaluacion.razonesSeguridad.map((razon) => <li key={razon} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{razon}</li>)}</ul></div> : null}
          <div className="mt-5 border-t border-border pt-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-text">Preguntas pendientes</p><span className="rounded-full bg-bg px-2 py-1 text-xs font-bold text-text-secondary">{evaluacion?.preguntasPendientes.length ?? 0}</span></div><ul className="mt-3 space-y-2 text-sm text-text-secondary">{evaluacion?.preguntasPendientes.slice(0, 6).map((pregunta) => <li key={pregunta} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vip" />{pregunta}</li>)}</ul>{(evaluacion?.preguntasPendientes.length ?? 0) > 6 ? <p className="mt-3 text-xs text-text-tertiary">Hay más pendientes; se mostrarán al avanzar por los pasos.</p> : null}</div>
        </aside>
      </div>

      <div id="resultado-generador-v2" tabIndex={-1} className="scroll-mt-4 space-y-4 outline-none">
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-vip/10 p-2 text-vip"><Activity size={20} /></span>
            <div>
              <h2 className="font-bold text-text">Motor de Dosis VIP 2.0</h2>
              <p className="mt-1 text-sm text-text-secondary">Series directas, frecuencia, RIR y descansos calculados antes de seleccionar ejercicios.</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${dosis?.estado === "calculado" ? "bg-success/10 text-success" : dosis?.estado === "provisional_revision" ? "bg-warning/10 text-warning" : "bg-bg text-text-secondary"}`}>
            {dosis?.estado === "calculado" ? "Dosis calculada" : dosis?.estado === "provisional_revision" ? "Provisional · requiere revisión" : "Esperando datos"}
          </span>
        </div>

        {dosis?.estado === "no_disponible" ? (
          <div className="mt-4 rounded-xl border border-border bg-bg p-4">
            <p className="text-sm font-semibold text-text">Todavía no existe una dosis utilizable.</p>
            <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">
              {dosis.razones.map((razon) => <li key={razon} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vip" />{razon}</li>)}
            </ul>
          </div>
        ) : dosis ? (
          <div className="mt-5 space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Estructura inicial</dt><dd className="mt-1 font-bold text-text">{dosis.estructura.diasRecomendados} días · {dosis.estructura.minutosPorSesion} min</dd><p className="mt-1 text-[11px] text-text-tertiary">{dosis.estructura.modoDistribucionDias === "manual" ? `Manual · motor sugería ${dosis.estructura.diasSugeridosMotor}` : "Recomendada por el motor"}</p></div>
              <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Presupuesto semanal</dt><dd className="mt-1 font-bold text-text">{dosis.estructura.presupuestoSeriesDirectasSemanal} series directas</dd></div>
              <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Recuperación</dt><dd className="mt-1 font-bold capitalize text-text">{dosis.recuperacion.calidad} · {dosis.recuperacion.puntuacion}/5</dd></div>
              <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Revisión</dt><dd className="mt-1 font-bold text-text">Cada {dosis.revisionCadaSemanas} {dosis.revisionCadaSemanas === 1 ? "semana" : "semanas"}</dd></div>
            </dl>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Compuestos</p><p className="mt-1 text-sm font-bold text-text">RIR {dosis.intensidad.rirCompuestos?.join("–")} · {dosis.intensidad.descansoCompuestosSegundos?.join("–")} s</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Aislamientos</p><p className="mt-1 text-sm font-bold text-text">RIR {dosis.intensidad.rirAislamientos?.join("–")} · {dosis.intensidad.descansoAislamientosSegundos?.join("–")} s</p></div>
              <div className="rounded-xl border border-border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Fallo y técnicas</p><p className="mt-1 text-sm font-bold text-text">{dosis.intensidad.fallo === "no_habilitado" ? "Fallo no habilitado" : "Fallo limitado a aislamientos"}</p><p className="mt-1 text-xs text-text-secondary">{dosis.tecnicasAvanzadas.regla}</p></div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div><h3 className="text-sm font-bold text-text">Dosis directa por grupo muscular</h3><p className="mt-0.5 text-xs text-text-secondary">El constructor posterior deberá sumar también la participación indirecta de los ejercicios compuestos.</p></div>
                <p className="text-xs text-text-tertiary">Mínimo · objetivo · máximo automático</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-wide text-text-tertiary"><tr><th className="px-3 py-2.5">Grupo</th><th className="px-3 py-2.5">Prioridad</th><th className="px-3 py-2.5">Series/semana</th><th className="px-3 py-2.5">Frecuencia</th><th className="px-3 py-2.5">Máx. por sesión</th><th className="px-3 py-2.5">Cambio</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {dosis.dosisPorGrupo.map((grupo) => <tr key={grupo.grupo}>
                      <th className="px-3 py-2.5 font-semibold text-text">{etiquetaGrupo(grupo.grupo)}</th>
                      <td className="px-3 py-2.5 capitalize text-text-secondary">{grupo.prioridad}</td>
                      <td className="px-3 py-2.5 font-semibold text-text">{grupo.seriesDirectasSemanales.minimo} · {grupo.seriesDirectasSemanales.objetivo} · {grupo.seriesDirectasSemanales.maximoAutomatico}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{grupo.frecuenciaSemanal || "Indirecta"} {grupo.frecuenciaSemanal ? "×" : ""}</td>
                      <td className="px-3 py-2.5 text-text-secondary">{grupo.maximoPorSesion || "—"}</td>
                      <td className={`px-3 py-2.5 font-semibold ${(grupo.cambioRespectoAlHistorialPorcentaje ?? 0) > 0 ? "text-warning" : "text-text-secondary"}`}>{grupo.cambioRespectoAlHistorialPorcentaje === null ? "Inicio" : `${grupo.cambioRespectoAlHistorialPorcentaje > 0 ? "+" : ""}${grupo.cambioRespectoAlHistorialPorcentaje}%`}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            {dosis.alertas.length > 0 ? <div className="rounded-xl border border-warning/25 bg-warning/5 p-4"><p className="text-sm font-bold text-text">Alertas y límites aplicados</p><ul className="mt-2 grid gap-2 text-sm text-text-secondary lg:grid-cols-2">{dosis.alertas.map((alerta) => <li key={alerta} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" />{alerta}</li>)}</ul></div> : null}

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-bg p-4"><p className="text-sm font-bold text-text">Regla de progresión</p><ul className="mt-2 space-y-1.5 text-sm text-text-secondary">{dosis.progresion.map((regla) => <li key={regla} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{regla}</li>)}</ul></div>
              <div className="rounded-xl bg-bg p-4"><p className="text-sm font-bold text-text">Cuándo reducir o detener</p><ul className="mt-2 space-y-1.5 text-sm text-text-secondary">{dosis.criteriosReduccion.map((regla) => <li key={regla} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-error" />{regla}</li>)}</ul></div>
            </div>

            <p className="rounded-xl border border-vip/15 bg-vip/5 p-3 text-sm text-text-secondary"><strong className="text-text">Cardio:</strong> {dosis.cardio}</p>
          </div>
        ) : null}
      </section>
      {semana ? <ConstructorSemanalV2Preview resultado={semana} /> : null}
      {semana && dosis ? <MesaEdicionV2 key={firmaSemanaEditable(alumnoId, semana)} alumnoId={alumnoId} entrevista={entrevista} dosis={dosis} borrador={semana} catalogo={catalogo} /> : null}
      </div>
    </div>
  );
}
