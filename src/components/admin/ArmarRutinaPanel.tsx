"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Coffee, PencilRuler, Search, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { RutinaDraftEditor, type TecnicaOpcion } from "@/components/admin/RutinaDraftEditor";
import { generarBorradorRutina } from "@/app/admin/generador/actions";
import { briefDesdeNivel, NIVELES_ARMADO, type NivelArmado } from "@/lib/generador-rutinas/niveles-armado";
import {
  guardarAsistenteArmado,
  leerAsistenteArmado,
  limpiarAsistenteArmado,
} from "@/lib/generador-rutinas/asistente-armado-local";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { PatronMovimiento } from "@/lib/rutinas/patrones";
import type { CodigoPlanEntrenamiento } from "@/lib/planes-entrenamiento";
import Link from "next/link";

export type AlumnoArmado = {
  id: string;
  nombre: string;
  perfilCompleto: boolean;
  requiereRevision: boolean;
  /** Lo que el alumno declaró en su propia ficha. */
  dias: number | null;
  minutos: number | null;
  /** Plan CONTRATADO. Manda sobre el autoreporte: el que paga tres días no
   * puede terminar con una rutina de cinco. */
  plan: { codigo: CodigoPlanEntrenamiento; nombre: string; diasSemana: number } | null;
  /** Lo que el alumno escribió en "Mi entrenamiento". */
  ficha: {
    experiencia: string | null;
    equipo: string | null;
    molestias: string | null;
    lesiones: string | null;
    operaciones: string | null;
    condiciones: string | null;
    noDeseados: string | null;
    preferidos: string | null;
  };
};

/** La ficha del alumno, delante del entrenador MIENTRAS arma — no antes.
 *
 * El motor de reglas no puede leer "me molesta la rodilla al bajar escaleras":
 * es texto libre, no una columna. Y la auditoría de IA que sí lo lee tarda dos
 * minutos y llega al final. El que puede actuar sobre eso en el momento es el
 * entrenador, y para eso tiene que estar viéndolo mientras elige ejercicios.
 *
 * Lo delicado (molestias, lesiones, operaciones, condiciones) va en amarillo y
 * primero. Lo demás es contexto. */
function FichaDelAlumno({ alumno, compacta = false }: { alumno: AlumnoArmado; compacta?: boolean }) {
  const f = alumno.ficha;
  const cuidados = [
    f.molestias ? { titulo: "Molestias", texto: f.molestias } : null,
    f.lesiones ? { titulo: "Lesiones", texto: f.lesiones } : null,
    f.operaciones ? { titulo: "Operaciones", texto: f.operaciones } : null,
    f.condiciones ? { titulo: "Condiciones médicas", texto: f.condiciones } : null,
    f.noDeseados ? { titulo: "No quiere hacer", texto: f.noDeseados } : null,
  ].filter((x): x is { titulo: string; texto: string } => x !== null);

  const contexto = [
    f.experiencia ? `Nivel ${f.experiencia}` : null,
    f.equipo ? `Prefiere ${f.equipo}` : null,
    f.preferidos ? `Le gustan: ${f.preferidos}` : null,
  ].filter(Boolean);

  const sinFicha = cuidados.length === 0 && contexto.length === 0;

  return (
    <div className={compacta ? "radius-control border border-border bg-surface-2 p-2" : "space-y-1.5"}>
      {sinFicha ? (
        <p className="text-micro text-text-tertiary">
          {alumno.nombre} todavía no completó “Mi entrenamiento”. Armá con tu criterio: no hay antecedentes cargados
          que revisar.
        </p>
      ) : (
        <>
          {cuidados.length > 0 && (
            <div className="radius-control border border-warning/40 bg-warning/5 p-2">
              <p className="text-micro font-semibold text-warning">TENER EN CUENTA AL ELEGIR EJERCICIOS</p>
              {cuidados.map((c) => (
                <p key={c.titulo} className="text-micro mt-0.5 text-text-secondary">
                  <strong className="text-text">{c.titulo}:</strong> {c.texto}
                </p>
              ))}
            </div>
          )}
          {contexto.length > 0 && <p className="text-micro text-text-tertiary">{contexto.join(" · ")}</p>}
        </>
      )}
    </div>
  );
}

const MINUTOS = [30, 45, 60, 75, 90, 120];
const DIAS = [1, 2, 3, 4, 5, 6, 7];
const NIVELES: NivelArmado[] = ["principiante", "intermedio", "avanzado", "olympia", "profesional"];

type GrupoPlan = "pecho" | "espalda" | "piernas" | "hombros" | "biceps" | "triceps" | "core";
type SesionPlan = { grupos: GrupoPlan[]; focos: string[]; ejerciciosPorGrupo: Partial<Record<GrupoPlan, number>>; descansoDespues: boolean; tipoDescanso: string };

/** Todo lo que hace falta para retomar el asistente exactamente donde quedó
 * (ver `asistente-armado-local.ts`). `busqueda`, `error` y `pendiente` quedan
 * afuera a propósito: son ruido de la sesión de edición, no del avance. */
type EstadoAsistente = {
  seleccionados: string[];
  nivel: NivelArmado;
  dias: number;
  minutos: number;
  rutina: RutinaExtraida | null;
  alertas: string[];
  seleccionando: boolean;
  disenandoEstructura: boolean;
  sesionesPlan: SesionPlan[];
  sesionActiva: number;
  configuracionManual: boolean;
  seriesManuales: number;
  repeticionesManuales: string;
  ejerciciosPlaneadosPorDia: Record<number, Record<string, number>>;
};

const RECOMENDACION_NIVEL: Record<NivelArmado, { series: number; bases: string; accesorios: string }> = {
  principiante: { series: 2, bases: "10-12", accesorios: "12-15" },
  intermedio: { series: 3, bases: "8-12", accesorios: "10-15" },
  avanzado: { series: 4, bases: "6-10", accesorios: "10-15" },
  olympia: { series: 4, bases: "6-12", accesorios: "10-20" },
  profesional: { series: 4, bases: "5-10", accesorios: "8-15" },
  competitivo: { series: 4, bases: "6-12", accesorios: "10-20" },
  estandar: { series: 3, bases: "8-12", accesorios: "10-15" },
  senior: { series: 2, bases: "10-12", accesorios: "12-15" },
};

function cantidadSugerida(gruposEnSesion: number, grupo: GrupoPlan): number {
  if (grupo === "core") return 1;
  if (gruposEnSesion <= 1) return 4;
  if (gruposEnSesion === 2) return 3;
  return 2;
}

const GRUPOS_PLAN: { id: GrupoPlan; nombre: string; color: string; focos: string[] }[] = [
  { id: "pecho", nombre: "Pecho", color: "#c9787f", focos: ["Superior", "Medio", "Inferior", "Aislamiento"] },
  { id: "espalda", nombre: "Espalda", color: "#728fb8", focos: ["Amplitud", "Densidad", "Lumbar", "Trapecio"] },
  { id: "piernas", nombre: "Piernas", color: "#78a27c", focos: ["Glúteos", "Cuádriceps", "Femoral", "Aductor", "Abductor", "Pantorrilla"] },
  { id: "hombros", nombre: "Hombros", color: "#b99a62", focos: ["Anterior", "Lateral", "Posterior", "Press vertical"] },
  // Modelo de brazos definido por el entrenador: los SUBGRUPOS son bíceps,
  // tríceps y antebrazo; lo de adentro son ENFOQUES (qué cabeza del músculo
  // se busca), no subgrupos. Lo que había antes mezclaba las dos cosas y
  // metía además implementos ("Polea") y formas de ejecución ("Compuesto"),
  // que no son ni una cosa ni la otra.
  //
  // Antebrazo NO figura acá todavía a propósito: no hay un solo ejercicio de
  // antebrazo cargado en la biblioteca, así que ofrecerlo daría un día vacío.
  // Entra en cuanto se carguen los ejercicios — ver el handoff.
  { id: "biceps", nombre: "Bíceps", color: "#6fa4a0", focos: ["Cabeza larga", "Cabeza corta", "Braquial"] },
  { id: "triceps", nombre: "Tríceps", color: "#9a84b9", focos: ["Cabeza larga", "Cabeza lateral", "Cabeza medial"] },
  { id: "core", nombre: "Core", color: "#b77f97", focos: ["Abdominal", "Oblicuos", "Estabilidad", "Lumbar"] },
];

function sesionesIniciales(cantidad: number): SesionPlan[] {
  const plantillas: Record<number, GrupoPlan[][]> = {
    1: [["piernas"]],
    2: [["pecho", "espalda"], ["piernas", "hombros"]],
    3: [["pecho", "biceps"], ["espalda", "triceps"], ["piernas", "hombros"]],
    4: [["pecho", "biceps"], ["espalda", "triceps"], ["piernas"], ["hombros", "biceps", "triceps"]],
    5: [["pecho", "biceps"], ["espalda", "triceps"], ["piernas"], ["pecho", "espalda"], ["hombros", "biceps", "triceps"]],
    6: [["pecho", "biceps"], ["espalda", "triceps"], ["piernas", "hombros"], ["pecho", "espalda"], ["hombros", "biceps", "triceps"], ["piernas"]],
    7: [["pecho"], ["espalda"], ["piernas"], ["hombros"], ["biceps", "triceps"], ["pecho", "espalda"], ["piernas"]],
  };
  return (plantillas[cantidad] ?? plantillas[3]).map((grupos) => ({
    grupos,
    focos: [],
    ejerciciosPorGrupo: Object.fromEntries(grupos.map((grupo) => [grupo, cantidadSugerida(grupos.length, grupo)])),
    descansoDespues: false,
    tipoDescanso: "Descanso total",
  }));
}

/** Herramienta de armado manual: el entrenador elige alumno y nivel, el motor
 * le deja una base decente, y a partir de ahí la arma él sobre la vista previa
 * a pantalla completa.
 *
 * Es la contracara del generador: allá hay 7 gavetas para afinar cada detalle
 * ANTES de generar; acá hay dos decisiones y todo el trabajo fino se hace
 * DESPUÉS, sobre la rutina ya armada. Mismo motor, misma publicación, misma
 * revisión con IA — lo único distinto es por dónde entra el entrenador. */
export function ArmarRutinaPanel({
  alumnos,
  ejercicios,
  tecnicas,
}: {
  alumnos: AlumnoArmado[];
  ejercicios: { id: string; nombre: string; grupo: string; equipo: string; patronMovimiento?: PatronMovimiento | null }[];
  tecnicas: TecnicaOpcion[];
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [nivel, setNivel] = useState<NivelArmado>("intermedio");
  const [dias, setDias] = useState(3);
  const [minutos, setMinutos] = useState(60);
  const [busqueda, setBusqueda] = useState("");
  const [rutina, setRutina] = useState<RutinaExtraida | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seleccionando, setSeleccionando] = useState(true);
  const [mostrarFicha, setMostrarFicha] = useState(false);
  const [disenandoEstructura, setDisenandoEstructura] = useState(false);
  const [sesionesPlan, setSesionesPlan] = useState<SesionPlan[]>(() => sesionesIniciales(3));
  const [sesionActiva, setSesionActiva] = useState(0);
  const [configuracionManual, setConfiguracionManual] = useState(false);
  const [seriesManuales, setSeriesManuales] = useState(3);
  const [repeticionesManuales, setRepeticionesManuales] = useState("8-12");
  const [ejerciciosPlaneadosPorDia, setEjerciciosPlaneadosPorDia] = useState<Record<number, Record<string, number>>>({});
  const [pendiente, iniciar] = useTransition();

  // ── Guardado automático del asistente (steps 1 a 4) ───────────────────
  // Reportado por el entrenador: a mitad del asistente —elegir alumno, nivel,
  // diseñar la estructura— si se iba a otra pestaña (Documentos, Alimentos,
  // Alumnos...) y volvía, todo se borraba y tenía que empezar de nuevo. Este
  // componente se desmonta con la ruta, así que el estado de React se pierde
  // con él. Se restaura solo, sin preguntar (a diferencia del borrador de la
  // mesa de trabajo): acá no hay ambigüedad de "¿esto es lo que estaba
  // armando o algo nuevo?", es la misma pantalla un momento después.
  const yaMontoAsistente = useRef(false);

  useEffect(() => {
    // Diferido un tick: `localStorage` no existe en el servidor y el primer
    // render tiene que salir igual en servidor y cliente para no desajustar
    // la hidratación (mismo patrón que ZoomPanel/ThemeToggle).
    const id = window.setTimeout(() => {
      const guardado = leerAsistenteArmado<EstadoAsistente>();
      if (!guardado) return;
      setSeleccionados(new Set(guardado.seleccionados));
      setNivel(guardado.nivel);
      setDias(guardado.dias);
      setMinutos(guardado.minutos);
      setRutina(guardado.rutina);
      setAlertas(guardado.alertas);
      setSeleccionando(guardado.seleccionando);
      setDisenandoEstructura(guardado.disenandoEstructura);
      setSesionesPlan(guardado.sesionesPlan);
      setSesionActiva(guardado.sesionActiva);
      setConfiguracionManual(guardado.configuracionManual);
      setSeriesManuales(guardado.seriesManuales);
      setRepeticionesManuales(guardado.repeticionesManuales);
      setEjerciciosPlaneadosPorDia(guardado.ejerciciosPlaneadosPorDia);
    }, 0);
    return () => window.clearTimeout(id);
    // Solo al montar.
  }, []);

  useEffect(() => {
    // El primer render no debe pisar lo guardado con el estado inicial vacío
    // antes de que el efecto de arriba alcance a leerlo.
    if (!yaMontoAsistente.current) {
      yaMontoAsistente.current = true;
      return;
    }
    guardarAsistenteArmado<EstadoAsistente>({
      seleccionados: [...seleccionados],
      nivel,
      dias,
      minutos,
      rutina,
      alertas,
      seleccionando,
      disenandoEstructura,
      sesionesPlan,
      sesionActiva,
      configuracionManual,
      seriesManuales,
      repeticionesManuales,
      ejerciciosPlaneadosPorDia,
    });
  }, [
    seleccionados,
    nivel,
    dias,
    minutos,
    rutina,
    alertas,
    seleccionando,
    disenandoEstructura,
    sesionesPlan,
    sesionActiva,
    configuracionManual,
    seriesManuales,
    repeticionesManuales,
    ejerciciosPlaneadosPorDia,
  ]);

  /** "Descartar" en la mesa de trabajo y "Cargar otra rutina" después de
   * publicar usan el mismo botón: las dos veces el entrenador terminó con
   * este borrador. Reinicia TODO el asistente, no solo `rutina` — si no, la
   * próxima vez volvía a aparecer el alumno viejo pre-marcado. */
  const reiniciarAsistente = () => {
    setSeleccionados(new Set());
    setNivel("intermedio");
    setDias(3);
    setMinutos(60);
    setBusqueda("");
    setRutina(null);
    setAlertas([]);
    setError(null);
    setSeleccionando(true);
    setMostrarFicha(false);
    setDisenandoEstructura(false);
    setSesionesPlan(sesionesIniciales(3));
    setSesionActiva(0);
    setConfiguracionManual(false);
    setSeriesManuales(3);
    setRepeticionesManuales("8-12");
    setEjerciciosPlaneadosPorDia({});
    limpiarAsistenteArmado();
  };

  // La misma rutina puede ir a varias personas: el motor ya lo soporta con
  // `alumnoIds`. Para los datos que hay que mostrar (ficha, plan) se usa el
  // primero, y los dias se calibran con el plan MAS CHICO del grupo.
  const elegidos = alumnos.filter((a) => seleccionados.has(a.id));
  const alumno = elegidos[0] ?? null;
  const visibles = useMemo(
    () => alumnos.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [alumnos, busqueda]
  );

  /** Marca o desmarca. Con varios elegidos, los días y minutos se calibran con
   * el MÁS CONSERVADOR del grupo: si uno paga 3 días y otro 5, la rutina sale
   * de 3 — nadie termina entrenando más de lo que contrató. */
  const alternar = (id: string) => {
    // Actualización funcional, no con una copia del estado de arriba: dos
    // toques rápidos leían el mismo valor viejo y el segundo pisaba al
    // primero. Se veía marcado uno solo aunque hubieras tocado dos.
    setSeleccionados((previos) => {
      const copia = new Set(previos);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);

      const grupo = alumnos.filter((a) => copia.has(a.id));
      if (grupo.length > 0) {
        setDias(Math.min(...grupo.map((a) => a.plan?.diasSemana ?? a.dias ?? 3)));
        setMinutos(Math.min(...grupo.map((a) => a.minutos ?? 60)));
      }
      return copia;
    });
  };

  const armar = () => {
    setError(null);
    iniciar(async () => {
      const ids = [...seleccionados];
      const brief = briefDesdeNivel(nivel, { alumnoId: ids[0], alumnoIds: ids, dias, minutosSesion: minutos });
      const r = await generarBorradorRutina(brief);
      if (!r.ok) return setError(r.error);
      setRutina(r.rutina);
      setAlertas(r.alertas);
    });
  };

  const empezarVacia = () => {
    if (!alumno) return;
    setError(null);
    setAlertas([]);
    setSesionesPlan(sesionesIniciales(dias));
    setSesionActiva(0);
    setDisenandoEstructura(true);
  };

  const crearDesdeEstructura = () => {
    if (!alumno || sesionesPlan.some((sesion) => sesion.grupos.length === 0)) return;
    const diasRutina: RutinaExtraida["dias"] = [];
    const cantidadesPorDia: Record<number, Record<string, number>> = {};
    sesionesPlan.forEach((sesion, indice) => {
      const etiquetas = sesion.grupos.map((grupo) => GRUPOS_PLAN.find((item) => item.id === grupo)?.nombre ?? grupo);
      cantidadesPorDia[diasRutina.length] = Object.fromEntries(sesion.grupos.map((grupo) => [grupo, sesion.ejerciciosPorGrupo[grupo] ?? cantidadSugerida(sesion.grupos.length, grupo)]));
      diasRutina.push({
        numero: diasRutina.length + 1,
        nombre: etiquetas.join(" + "),
        tipo: "entrenamiento",
        descripcion: sesion.focos.length > 0 ? `Enfoques: ${sesion.focos.join(" · ")}` : null,
        ejercicios: [],
      });
      if (sesion.descansoDespues && indice < sesionesPlan.length - 1) {
        diasRutina.push({
          numero: diasRutina.length + 1,
          nombre: sesion.tipoDescanso,
          tipo: "descanso",
          descripcion: sesion.tipoDescanso,
          ejercicios: [],
        });
      }
    });
    setRutina({
      nombreRutina: `Rutina de ${elegidos.length === 1 ? alumno.nombre : `${elegidos.length} alumnos`}`,
      dias: diasRutina,
    });
    setEjerciciosPlaneadosPorDia(cantidadesPorDia);
    setDisenandoEstructura(false);
  };

  if (rutina && alumno) {
    const codigosPlan = new Set(elegidos.map((elegido) => elegido.plan?.codigo).filter(Boolean));
    const planComun = codigosPlan.size === 1 ? [...codigosPlan][0] : undefined;
    // Una sola línea, no una tarjeta con instrucciones: una vez que la base
    // está armada, el alto de la pantalla es para la rutina.
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setRutina(null); setDisenandoEstructura(true); }} className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#8fb7d8]">
            <ArrowLeft size={13} /> Atrás
          </button>
          {/* Este botón vuelve a "Diseñar estructura" (sigue siendo el mismo
              alumno, se sigue armando). El reinicio completo es solo en
              `onDescartar`, más abajo, donde el entrenador de verdad terminó
              con esta rutina. */}
          <PencilRuler size={13} className="shrink-0 text-vip" />
          <p className="text-caption min-w-0 flex-1 truncate font-semibold text-text">
            {elegidos.length === 1 ? alumno.nombre : `${elegidos.length} alumnos`} · {NIVELES_ARMADO[nivel].etiqueta}
          </p>
          <button
            type="button"
            onClick={() => setMostrarFicha((valor) => !valor)}
            className="radius-control flex shrink-0 items-center gap-1 border border-border px-2 py-1 text-[10px] font-semibold text-vip"
          >
            Ficha <ChevronDown size={12} className={mostrarFicha ? "rotate-180" : ""} />
          </button>
        </div>
        {/* La ficha queda arriba de la mesa de trabajo, no en la pantalla
            anterior: sirve mientras se eligen los ejercicios. Con varios
            alumnos se muestran TODAS: la rutina es una sola, pero los
            antecedentes son de cada uno y hay que respetarlos a todos. */}
        {mostrarFicha && elegidos.map((a) => (
          <div key={a.id}>
            {elegidos.length > 1 && <p className="text-micro font-semibold text-text-secondary">{a.nombre}</p>}
            <FichaDelAlumno alumno={a} compacta />
          </div>
        ))}
        {alertas.length > 0 && (
          <details className="radius-control border border-[#4a4335] bg-[#151515]">
            <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-caption font-semibold text-[#c7a25c]">
              <AlertTriangle size={14} /> Sugerencias automáticas · {alertas.length}
            </summary>
            <div className="space-y-1 border-t border-[#34312b] px-3 py-2">
              {alertas.map((a) => <p key={a} className="text-micro text-text-secondary">• {a}</p>)}
            </div>
          </details>
        )}
        <RutinaDraftEditor
          mesaDeTrabajo
          alumnoIds={[...seleccionados]}
          draftInicial={rutina}
          onDescartar={reiniciarAsistente}
          ejercicios={ejercicios}
          tecnicas={tecnicas}
          planInicial={planComun}
          nivelArmado={nivel}
          configuracionArmado={{
            manual: configuracionManual,
            seriesPorEjercicio: configuracionManual ? seriesManuales : RECOMENDACION_NIVEL[nivel].series,
            repeticiones: configuracionManual ? repeticionesManuales : RECOMENDACION_NIVEL[nivel].bases,
            ejerciciosPorSesion: ejerciciosPlaneadosPorDia,
          }}
        />
      </div>
    );
  }

  if (disenandoEstructura && alumno) {
    const actual = sesionesPlan[sesionActiva];
    const alternarGrupo = (grupo: GrupoPlan) => setSesionesPlan((previas) => previas.map((sesion, indice) => {
      if (indice !== sesionActiva) return sesion;
      const quitando = sesion.grupos.includes(grupo);
      const grupos = quitando ? sesion.grupos.filter((item) => item !== grupo) : [...sesion.grupos, grupo];
      const ejerciciosPorGrupo = { ...sesion.ejerciciosPorGrupo };
      if (quitando) delete ejerciciosPorGrupo[grupo];
      else ejerciciosPorGrupo[grupo] = cantidadSugerida(grupos.length, grupo);
      // Al sacar el grupo se van también sus enfoques: si no, quedaban
      // guardados invisibles y reaparecían en la descripción del día.
      const nombreGrupo = GRUPOS_PLAN.find((item) => item.id === grupo)?.nombre ?? grupo;
      const focos = quitando ? sesion.focos.filter((foco) => !foco.startsWith(`${nombreGrupo} · `)) : sesion.focos;
      return { ...sesion, grupos, ejerciciosPorGrupo, focos };
    }));
    const alternarFoco = (foco: string) => setSesionesPlan((previas) => previas.map((sesion, indice) => {
      if (indice !== sesionActiva) return sesion;
      const focos = sesion.focos.includes(foco) ? sesion.focos.filter((item) => item !== foco) : [...sesion.focos, foco];
      return { ...sesion, focos };
    }));
    const gruposActivos = GRUPOS_PLAN.filter((grupo) => actual.grupos.includes(grupo.id));
    // El enfoque se guarda calificado por su grupo ("Bíceps · Cabeza larga").
    // Sin eso, "Cabeza larga" de bíceps y de tríceps serían el mismo botón:
    // marcar uno marcaría los dos y la descripción del día quedaría ambigua.
    const focosDisponibles = gruposActivos.flatMap((grupo) =>
      grupo.focos.map((foco) => ({ id: `${grupo.nombre} · ${foco}`, etiqueta: foco, color: grupo.color }))
    );
    return (
      <div className="space-y-3 rounded-2xl border border-[#303846] bg-[#151922] p-3 text-[#f4f7fb]">
        <div className="flex items-center justify-between gap-2 border-b border-[#303846] pb-2">
          <div className="min-w-0">
            <p className="text-caption truncate font-semibold">{elegidos.length === 1 ? alumno.nombre : `${elegidos.length} alumnos`}</p>
            <p className="text-micro text-[#a8b2c1]">Paso 2 de 4 · estructura semanal</p>
          </div>
          <button type="button" onClick={() => setDisenandoEstructura(false)} className="flex items-center gap-1 text-micro font-semibold text-[#8fb7d8]"><ArrowLeft size={13} /> Atrás</button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {sesionesPlan.map((sesion, indice) => (
            <button key={indice} type="button" onClick={() => setSesionActiva(indice)} className={`radius-control shrink-0 border px-3 py-2 text-micro font-semibold ${sesionActiva === indice ? "border-[#78a6d1] bg-[#243c55] text-[#d9ecff]" : "border-[#394352] bg-[#1d222c] text-[#b9c2cf]"}`}>
              S{indice + 1} {sesion.grupos.length > 0 ? `· ${sesion.grupos.length}` : ""}
            </button>
          ))}
        </div>

        <div>
          <p className="text-micro mb-2 text-[#a8b2c1]">GRUPOS PRINCIPALES · SESIÓN {sesionActiva + 1}</p>
          <div className="flex flex-wrap gap-1.5">
            {GRUPOS_PLAN.map((grupo) => {
              const activo = actual.grupos.includes(grupo.id);
              return (
                <button key={grupo.id} type="button" onClick={() => alternarGrupo(grupo.id)} className={`radius-control flex items-center gap-1.5 border px-2.5 py-2 text-caption ${activo ? "border-[#78a6d1] bg-[#243c55] text-[#d9ecff]" : "border-[#394352] bg-[#1d222c] text-[#c1c9d5]"}`}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: grupo.color }} /> {grupo.nombre}
                </button>
              );
            })}
          </div>
        </div>

        {gruposActivos.length > 0 && (
          <div className="space-y-1.5 rounded-xl border border-[#394352] bg-[#1d222c] p-2.5">
            <p className="text-micro text-[#a8b2c1]">EJERCICIOS POR MÚSCULO</p>
            {gruposActivos.map((grupo) => (
              <label key={grupo.id} className="flex items-center justify-between gap-3 text-caption text-[#d9dfe8]">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ backgroundColor: grupo.color }} />{grupo.nombre}</span>
                <span className="flex items-center gap-1">
                  <button type="button" aria-label={`Quitar un ejercicio de ${grupo.nombre}`} onClick={() => setSesionesPlan((previas) => previas.map((sesion, indice) => indice === sesionActiva ? { ...sesion, ejerciciosPorGrupo: { ...sesion.ejerciciosPorGrupo, [grupo.id]: Math.max(1, (sesion.ejerciciosPorGrupo[grupo.id] ?? 1) - 1) } } : sesion))} className="grid size-7 place-items-center rounded-lg border border-[#465263] bg-[#151922]">−</button>
                  <input type="number" min={1} max={6} value={actual.ejerciciosPorGrupo[grupo.id] ?? cantidadSugerida(actual.grupos.length, grupo.id)} onChange={(evento) => setSesionesPlan((previas) => previas.map((sesion, indice) => indice === sesionActiva ? { ...sesion, ejerciciosPorGrupo: { ...sesion.ejerciciosPorGrupo, [grupo.id]: Math.min(6, Math.max(1, Number(evento.target.value) || 1)) } } : sesion))} className="h-7 w-10 rounded-lg border border-[#465263] bg-[#151922] text-center text-caption text-white" />
                  <button type="button" aria-label={`Agregar un ejercicio de ${grupo.nombre}`} onClick={() => setSesionesPlan((previas) => previas.map((sesion, indice) => indice === sesionActiva ? { ...sesion, ejerciciosPorGrupo: { ...sesion.ejerciciosPorGrupo, [grupo.id]: Math.min(6, (sesion.ejerciciosPorGrupo[grupo.id] ?? 1) + 1) } } : sesion))} className="grid size-7 place-items-center rounded-lg border border-[#465263] bg-[#151922]">+</button>
                </span>
              </label>
            ))}
            <p className="text-[9px] text-[#8f9aaa]">Total estimado: {gruposActivos.reduce((total, grupo) => total + (actual.ejerciciosPorGrupo[grupo.id] ?? 0), 0)} ejercicios · {(configuracionManual ? seriesManuales : RECOMENDACION_NIVEL[nivel].series) * gruposActivos.reduce((total, grupo) => total + (actual.ejerciciosPorGrupo[grupo.id] ?? 0), 0)} series.</p>
          </div>
        )}

        {focosDisponibles.length > 0 && (
          <div className="border-l-2 border-[#6f9bc6] bg-[#1c2733] p-2.5">
            <p className="text-micro mb-2 text-[#a9bdd0]">SUBGRUPOS Y ENFOQUES · opcional</p>
            <div className="flex flex-wrap gap-1.5">
              {focosDisponibles.map((foco) => (
                <button key={foco.id} type="button" onClick={() => alternarFoco(foco.id)} className={`radius-control flex items-center gap-1.5 border px-2 py-1.5 text-micro ${actual.focos.includes(foco.id) ? "border-[#78a6d1] bg-[#243c55] text-[#d9ecff]" : "border-[#394352] bg-[#151922] text-[#a8b2c1]"}`}>
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: foco.color }} />{foco.etiqueta}
                </button>
              ))}
            </div>
          </div>
        )}

        {sesionActiva < sesionesPlan.length - 1 && (
          <div className="radius-control border border-[#3e5c54] bg-[#1d2d29] p-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-caption text-[#c4e3da]">
              <input type="checkbox" checked={actual.descansoDespues} onChange={(evento) => setSesionesPlan((previas) => previas.map((sesion, indice) => indice === sesionActiva ? { ...sesion, descansoDespues: evento.target.checked } : sesion))} />
              <Coffee size={14} className="text-[#76a98a]" /> Insertar descanso después de esta sesión
            </label>
            {actual.descansoDespues && (
              <select value={actual.tipoDescanso} onChange={(evento) => setSesionesPlan((previas) => previas.map((sesion, indice) => indice === sesionActiva ? { ...sesion, tipoDescanso: evento.target.value } : sesion))} className="mt-2 w-full rounded-lg border border-[#46645c] bg-[#151922] px-2 py-2 text-caption text-[#d8eee8]">
                <option>Descanso total</option><option>Recuperación activa</option><option>Movilidad o cardio ligero</option>
              </select>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[#303846] pt-3">
          <p className="text-micro text-[#a8b2c1]">{sesionesPlan.length} sesiones · {sesionesPlan.filter((sesion) => sesion.descansoDespues).length} descansos</p>
          <Button size="xs" onClick={crearDesdeEstructura} disabled={sesionesPlan.some((sesion) => sesion.grupos.length === 0)} disabledReason="Elige al menos un grupo en cada sesión" className="!bg-[#466f91] !text-white">
            Elegir ejercicios
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(seleccionando || seleccionados.size === 0) ? <Card padding="p-3" className="space-y-2">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-secondary font-medium text-text">1. ¿Para quién?</p>
            <Link href="/admin" className="flex items-center gap-1 text-micro font-semibold text-[#8fb7d8]"><ArrowLeft size={13} /> Atrás</Link>
          </div>
          <div className="relative mt-2">
            <Search size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              className="pl-9"
            />
          </div>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
            {visibles.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => alternar(a.id)}
                className={`radius-control flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left ${
                  seleccionados.has(a.id) ? "bg-[#dbeafe] text-[#214f7d]" : "bg-surface-2 text-text-secondary"
                }`}
              >
                <span className="text-caption min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
                <span className="text-micro shrink-0 opacity-80">
                  {a.plan ? `${a.plan.nombre} · ${a.plan.diasSemana} días` : "Sin plan"}
                </span>
              </button>
            ))}
            {visibles.length === 0 && <p className="text-caption text-text-tertiary">Ningún alumno con ese nombre.</p>}
          </div>
        </div>

        {alumno && !alumno.plan && (
          <p className="text-caption flex items-start gap-1.5 text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {alumno.nombre} no tiene plan de entrenamiento asignado. Se usan los días de su ficha; asignale el plan
            desde Alumnos para que respete el cupo que paga.
          </p>
        )}
        {alumno && <FichaDelAlumno alumno={alumno} />}
        {alumno?.requiereRevision && (
          <p className="text-caption flex items-start gap-1.5 text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            La ficha de {alumno.nombre} tiene antecedentes de salud pendientes de revisión.
          </p>
        )}
        <Button
          size="xs"
          className="!bg-[#2f6fa8] !text-white"
          onClick={() => setSeleccionando(false)}
          disabled={seleccionados.size === 0}
          disabledReason="Elegí al menos un alumno"
        >
          Continuar <Check size={15} />
        </Button>
      </Card> : (
        <div className="radius-control flex items-center gap-2 border border-border bg-surface px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-caption truncate font-semibold text-text">
              {elegidos.length === 1 ? alumno?.nombre : `${elegidos.length} alumnos`}
            </p>
            <p className="text-micro truncate text-text-tertiary">
              {alumno?.plan ? `${alumno.plan.nombre} · ${dias} sesiones · ${minutos} min` : `${dias} sesiones · ${minutos} min`}
            </p>
          </div>
          <button type="button" onClick={() => setSeleccionando(true)} className="text-caption font-semibold text-[#4f83b7]">
            Cambiar
          </button>
        </div>
      )}

      {!seleccionando && seleccionados.size > 0 && <Card padding="p-3" className="space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption font-semibold text-text">¿Cómo quieres comenzar?</p>
            <button type="button" onClick={() => setSeleccionando(true)} className="flex items-center gap-1 text-micro font-semibold text-[#8fb7d8]"><ArrowLeft size={13} /> Atrás</button>
          </div>
          <p className="text-micro mt-0.5 text-text-tertiary">Manual manda. La base VIP es solo un punto de partida editable.</p>
        </div>
        <label className="block">
          <span className="text-micro mb-1 block text-text-tertiary">NIVEL DEL ALUMNO</span>
          <Select value={nivel} onChange={(evento) => {
            const nuevoNivel = evento.target.value as NivelArmado;
            setNivel(nuevoNivel);
            if (!configuracionManual) {
              setSeriesManuales(RECOMENDACION_NIVEL[nuevoNivel].series);
              setRepeticionesManuales(RECOMENDACION_NIVEL[nuevoNivel].bases);
            }
          }} className="py-2">
            {NIVELES.map((opcion) => <option key={opcion} value={opcion}>{NIVELES_ARMADO[opcion].etiqueta}</option>)}
          </Select>
          <span className="text-micro mt-1 block text-text-tertiary">{NIVELES_ARMADO[nivel].descripcion}</span>
        </label>

        <div className="radius-control border border-[#394352] bg-[#151922] p-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-caption font-semibold text-[#eef2f7]">Volumen recomendado por sesión</p>
              <p className="mt-0.5 text-[10px] text-[#a8b2c1]">{RECOMENDACION_NIVEL[nivel].series} series por ejercicio · bases {RECOMENDACION_NIVEL[nivel].bases} reps · accesorios {RECOMENDACION_NIVEL[nivel].accesorios} reps</p>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-[#c8d0dc]"><input type="checkbox" checked={configuracionManual} onChange={(evento) => setConfiguracionManual(evento.target.checked)} /> Manual</label>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px] text-[#9eabbc]">
            <div className="rounded-lg bg-[#1d222c] p-1.5"><strong className="block text-[#dce5ef]">1 músculo</strong>4 ejercicios · {RECOMENDACION_NIVEL[nivel].series * 4} series</div>
            <div className="rounded-lg bg-[#1d222c] p-1.5"><strong className="block text-[#dce5ef]">2 músculos</strong>3 + 3 ejercicios · {RECOMENDACION_NIVEL[nivel].series * 6} series</div>
            <div className="rounded-lg bg-[#1d222c] p-1.5"><strong className="block text-[#dce5ef]">3 músculos</strong>2 + 2 + 2 · {RECOMENDACION_NIVEL[nivel].series * 6} series</div>
          </div>
          {configuracionManual && (
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#303846] pt-2">
              <label className="text-[9px] uppercase text-[#a8b2c1]">Series por ejercicio<input type="number" min={1} max={10} value={seriesManuales} onChange={(evento) => setSeriesManuales(Math.min(10, Math.max(1, Number(evento.target.value) || 1)))} className="mt-1 w-full rounded-lg border border-[#465263] bg-[#1d222c] px-2 py-2 text-caption text-white" /></label>
              <label className="text-[9px] uppercase text-[#a8b2c1]">Repeticiones<input value={repeticionesManuales} onChange={(evento) => setRepeticionesManuales(evento.target.value)} placeholder="Ej. 8-12" className="mt-1 w-full rounded-lg border border-[#465263] bg-[#1d222c] px-2 py-2 text-caption text-white" /></label>
            </div>
          )}
        </div>

        <details className="radius-control border border-border">
          <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-caption font-semibold text-text-secondary">
            <SlidersHorizontal size={14} className="text-[#4f83b7]" /> Ajustar sesiones y duración
          </summary>
          <div className="space-y-3 border-t border-border p-2.5">
          <div>
          <p className="text-micro text-text-tertiary">DÍAS POR SEMANA</p>
          <div className="mt-1 flex gap-1">
            {DIAS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDias(d)}
                aria-pressed={dias === d}
                className={`radius-control flex-1 py-2 text-caption font-semibold ${
                  dias === d ? "bg-[#dbeafe] text-[#214f7d]" : "bg-surface-2 text-text-secondary"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          </div>
          <div>
          <p className="text-micro text-text-tertiary">MINUTOS POR SESIÓN</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {MINUTOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutos(m)}
                aria-pressed={minutos === m}
                className={`radius-control flex-1 py-2 text-caption font-semibold ${
                  minutos === m ? "bg-[#dbeafe] text-[#214f7d]" : "bg-surface-2 text-text-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          </div>
          </div>
        </details>
        {alumno?.plan && dias !== alumno.plan.diasSemana && (
          <p className="text-caption text-warning">
            El plan de {alumno.nombre} es de {alumno.plan.diasSemana} días por semana y estás armando {dias}.
          </p>
        )}
      </Card>}

      {error && <p className="text-caption text-error">{error}</p>}
      {!seleccionando && seleccionados.size > 0 && <div className="grid gap-2 sm:grid-cols-2">
        <Button
          onClick={empezarVacia}
          className="!bg-[#2f6fa8] !text-white"
          disabled={seleccionados.size === 0}
          disabledReason="Elegí al menos un alumno"
        >
          <PencilRuler size={18} /> Diseñar estructura
        </Button>
        <Button
          variant="secondary"
          onClick={armar}
          loading={pendiente}
          disabled={seleccionados.size === 0}
          disabledReason="Elegí al menos un alumno"
        >
          {pendiente ? "Preparando…" : "Usar base VIP"}
        </Button>
      </div>}
    </div>
  );
}
