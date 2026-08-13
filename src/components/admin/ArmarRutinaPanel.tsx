"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, PencilRuler, Search, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  configuracionManual: boolean;
  seriesManuales: number;
  repeticionesManuales: string;
  ejerciciosPlaneadosPorDia: Record<number, Record<string, number>>;
  seriesPlaneadasPorDia: Record<number, Record<string, number>>;
  organizacionPlaneadaPorDia: Record<number, "por_grupos" | "alternado">;
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

/** Series EFECTIVAS totales para cada grupo en una sesiÃ³n. No son series por
 * ejercicio. El orden del array coincide con la prioridad 1, 2 y 3 elegida
 * por el entrenador. Avanzado (6) y Olympia (8) alcanzan 12â€“20 semanales con
 * dos o tres exposiciones, sin inflar cada ejercicio por separado. */
export function seriesSugeridasPorSesion(nivel: NivelArmado, cantidadGrupos: number): number[] {
  const cantidad = Math.max(1, cantidadGrupos);
  const nivelActual = nivel === "profesional" || nivel === "competitivo" ? "olympia" : nivel === "estandar" ? "intermedio" : nivel === "senior" ? "principiante" : nivel;
  if (nivelActual === "avanzado") return Array(cantidad).fill(6);
  if (nivelActual === "olympia") return Array(cantidad).fill(8);
  const base = nivelActual === "principiante"
    ? (cantidad === 1 ? [5] : cantidad === 2 ? [3, 3] : [3, 2, 2])
    : (cantidad === 1 ? [6] : cantidad === 2 ? [4, 4] : [4, 3, 3]);
  return Array.from({ length: cantidad }, (_, indice) => base[indice] ?? base.at(-1) ?? 2);
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
  ejercicios: { id: string; nombre: string; aliases?: string[]; grupo: string; equipo: string; patronMovimiento?: PatronMovimiento | null }[];
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
  const [deshacerSignal, setDeshacerSignal] = useState(0);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  const [configuracionManual, setConfiguracionManual] = useState(false);
  const [seriesManuales, setSeriesManuales] = useState(3);
  const [repeticionesManuales, setRepeticionesManuales] = useState("8-12");
  const [ejerciciosPlaneadosPorDia, setEjerciciosPlaneadosPorDia] = useState<Record<number, Record<string, number>>>({});
  const [seriesPlaneadasPorDia, setSeriesPlaneadasPorDia] = useState<Record<number, Record<string, number>>>({});
  const [organizacionPlaneadaPorDia, setOrganizacionPlaneadaPorDia] = useState<Record<number, "por_grupos" | "alternado">>({});
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
      // Las dos pantallas intermedias ya no existen. Un borrador viejo que
      // quedó guardado allí vuelve a la selección; si ya tenía rutina, abre
      // directamente la mesa de trabajo.
      setSeleccionando(guardado.rutina ? false : true);
      setConfiguracionManual(guardado.configuracionManual);
      setSeriesManuales(guardado.seriesManuales);
      setRepeticionesManuales(guardado.repeticionesManuales);
      setEjerciciosPlaneadosPorDia(guardado.ejerciciosPlaneadosPorDia);
      setSeriesPlaneadasPorDia(guardado.seriesPlaneadasPorDia ?? {});
      setOrganizacionPlaneadaPorDia(guardado.organizacionPlaneadaPorDia ?? {});
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
      configuracionManual,
      seriesManuales,
      repeticionesManuales,
      ejerciciosPlaneadosPorDia,
      seriesPlaneadasPorDia,
      organizacionPlaneadaPorDia,
    });
  }, [
    seleccionados,
    nivel,
    dias,
    minutos,
    rutina,
    alertas,
    seleccionando,
    configuracionManual,
    seriesManuales,
    repeticionesManuales,
    ejerciciosPlaneadosPorDia,
    seriesPlaneadasPorDia,
    organizacionPlaneadaPorDia,
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
    setDeshacerSignal(0);
    setPuedeDeshacer(false);
    setConfiguracionManual(false);
    setSeriesManuales(3);
    setRepeticionesManuales("8-12");
    setEjerciciosPlaneadosPorDia({});
    setSeriesPlaneadasPorDia({});
    setOrganizacionPlaneadaPorDia({});
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
      setSeleccionando(false);
      setDeshacerSignal(0);
      setPuedeDeshacer(false);
    });
  };

  if (rutina && alumno) {
    const codigosPlan = new Set(elegidos.map((elegido) => elegido.plan?.codigo).filter(Boolean));
    const planComun = codigosPlan.size === 1 ? [...codigosPlan][0] : undefined;
    // Una sola línea, no una tarjeta con instrucciones: una vez que la base
    // está armada, el alto de la pantalla es para la rutina.
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setRutina(null); setSeleccionando(true); }} className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#8fb7d8]">
            <ArrowLeft size={13} /> Atrás
          </button>
          <PencilRuler size={13} className="shrink-0 text-vip" />
          <p className="text-caption min-w-0 flex-1 truncate font-semibold text-text">
            {elegidos.length === 1 ? alumno.nombre : `${elegidos.length} alumnos`} · {NIVELES_ARMADO[nivel].etiqueta}
          </p>
          <button
            type="button"
            onClick={() => setDeshacerSignal((valor) => valor + 1)}
            disabled={!puedeDeshacer}
            aria-label="Deshacer el último cambio"
            className="radius-control flex shrink-0 items-center gap-1 border border-border px-2 py-1 text-[10px] font-semibold text-[#8fb7d8] disabled:opacity-35"
          >
            <Undo2 size={12} /> Deshacer
          </button>
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
          deshacerSignal={deshacerSignal}
          onPuedeDeshacer={setPuedeDeshacer}
          alumnoIds={[...seleccionados]}
          draftInicial={rutina}
          onDescartar={reiniciarAsistente}
          ejercicios={ejercicios}
          tecnicas={tecnicas}
          planInicial={planComun}
          nivelArmado={nivel}
          onCambiarNivel={setNivel}
          minutosSesion={minutos}
          onCambiarMinutosSesion={setMinutos}
          configuracionArmado={{
            manual: configuracionManual,
            seriesPorEjercicio: configuracionManual ? seriesManuales : RECOMENDACION_NIVEL[nivel].series,
            repeticiones: configuracionManual ? repeticionesManuales : RECOMENDACION_NIVEL[nivel].bases,
            ejerciciosPorSesion: ejerciciosPlaneadosPorDia,
            seriesPorGrupoSesion: seriesPlaneadasPorDia,
            organizacionPorSesion: organizacionPlaneadaPorDia,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Card padding="p-3" className="space-y-2">
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
          onClick={armar}
          loading={pendiente}
          disabled={seleccionados.size === 0}
          disabledReason="Elegí al menos un alumno"
        >
          {pendiente ? "Preparando…" : <>Continuar <Check size={15} /></>}
        </Button>
      </Card>

      {error && <p className="text-caption text-error">{error}</p>}
    </div>
  );
}
