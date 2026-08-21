"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Dumbbell,
  LayoutList,
  Pencil,
  Search,
  Star,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TarjetaReporteAlumno } from "./TarjetaReporteAlumno";
import { actualizarPlanRapido, type FormState } from "@/app/admin/alumnos/actions";
import { PLANES_ENTRENAMIENTO } from "@/lib/planes-entrenamiento";
import type { PrioridadAlumno, ReporteAlumno } from "@/app/admin/alumnos/data";

// `data.ts` importa "server-only" — acá va la copia liviana de la etiqueta,
// no un import de valor de ese módulo (rompería el build de este client
// component). Ver PrioridadAlumno en app/admin/alumnos/data.ts.
const ETIQUETA_PRIORIDAD: Record<PrioridadAlumno, string> = {
  ahora: "Ahora",
  hoy: "Hoy",
  esta_semana: "Esta semana",
  sin_accion: "Sin acción",
};

const ORDEN_PRIORIDAD: Record<PrioridadAlumno, number> = { ahora: 0, hoy: 1, esta_semana: 2, sin_accion: 3 };

const CLASE_PRIORIDAD: Record<PrioridadAlumno, string> = {
  ahora: "border-error/30 bg-error/10 text-error",
  hoy: "border-warning/30 bg-warning/10 text-warning",
  esta_semana: "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#60a5fa]",
  sin_accion: "border-border bg-surface-2 text-text-tertiary",
};

export type FiltroAlumnos = "todos" | "sin_rutina" | "seguimiento" | "al_dia" | "destacados";

/** Clasificación por plan CONTRATADO (días/semana), no por lo que el alumno
 * declaró en su ficha — pedido explícito: poder ubicar rápido a quiénes
 * pagan 3, 4 o 5 días semanales sin tener que abrir cada perfil. */
type FiltroPlan = "todos" | 3 | 4 | 5 | "sin_plan";

const SIN_RUTINA = "Sin rutina activa asignada";

function pertenece(reporte: ReporteAlumno, filtro: FiltroAlumnos): boolean {
  if (filtro === "todos") return true;
  if (filtro === "sin_rutina") return reporte.motivo === SIN_RUTINA;
  if (filtro === "seguimiento") return reporte.estado === "atencion" && reporte.motivo !== SIN_RUTINA;
  if (filtro === "al_dia") return reporte.estado === "normal";
  return reporte.estado === "destacado";
}

function estadoVisual(reporte: ReporteAlumno) {
  if (reporte.motivo === SIN_RUTINA) {
    return { etiqueta: "Sin rutina", clase: "border-error/25 bg-error/10 text-error", Icon: Dumbbell };
  }
  if (reporte.estado === "atencion") {
    return { etiqueta: "Revisar", clase: "border-vip/25 bg-vip/10 text-vip", Icon: AlertTriangle };
  }
  if (reporte.estado === "destacado") {
    return { etiqueta: "Destacado", clase: "border-vip/25 bg-vip/10 text-vip", Icon: Star };
  }
  return { etiqueta: "Al día", clase: "border-success/25 bg-success/10 text-success", Icon: CircleCheck };
}

/** Chip de prioridad real (Ahora/Hoy/Esta semana), aparte del semáforo de
 * arriba — ver PrioridadAlumno en app/admin/alumnos/data.ts. No se muestra
 * para "sin_accion": la mayoría estable no necesita un chip gris repetido en
 * cada fila. */
function prioridadVisual(reporte: ReporteAlumno) {
  if (reporte.prioridad === "sin_accion") return null;
  return { etiqueta: ETIQUETA_PRIORIDAD[reporte.prioridad], clase: CLASE_PRIORIDAD[reporte.prioridad] };
}

const ESTADO_INICIAL_PLAN: FormState = { error: null, ok: false };

/**
 * Corregir el plan sin salir de la lista ni entrar a la ficha completa —
 * pedido explícito del entrenador para revisar de un tirón el backfill
 * automático (rutina activa → plan asumido) y arreglar los casos donde
 * asumió Access y en realidad era Select, o cualquier otro ajuste.
 * `stopPropagation` en todo el bloque: la fila entera es clicable (navega a
 * la ficha), así que sin esto cualquier clic acá adentro also dispararía esa
 * navegación.
 */
function EditorPlanRapido({ reporte }: { reporte: ReporteAlumno }) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(actualizarPlanRapido, ESTADO_INICIAL_PLAN);

  if (state.ok && abierto) {
    // Se cierra solo apenas confirma el guardado — sin esto quedaba abierto
    // mostrando el mismo valor hasta que el entrenador lo cerrara a mano.
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto(true);
        }}
        className={`ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
          reporte.planCodigo
            ? "border-border bg-surface-2 text-text-secondary"
            : "border-warning/25 bg-warning/10 text-warning"
        }`}
      >
        {reporte.planCodigo ? `${reporte.planDiasSemana} días/sem` : "Sin plan"}
        <Pencil size={9} />
      </button>
    );
  }

  return (
    <form
      action={formAction}
      onClick={(e) => e.stopPropagation()}
      className="ml-1 inline-flex items-center gap-1"
    >
      <input type="hidden" name="alumno_id" value={reporte.alumnoId} />
      <select
        name="plan_entrenamiento"
        defaultValue={reporte.planCodigo ?? ""}
        className="radius-control border border-vip/40 bg-surface-2 px-1.5 py-1 text-[10px] text-text"
      >
        <option value="">Sin plan</option>
        {Object.values(PLANES_ENTRENAMIENTO).map((plan) => (
          <option key={plan.codigo} value={plan.codigo}>
            {plan.nombre} · {plan.diasSemana}d
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} aria-label="Guardar plan" className="grid size-6 place-items-center rounded-full bg-vip text-black disabled:opacity-60">
        <Check size={12} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto(false);
        }}
        aria-label="Cancelar"
        className="text-[10px] text-text-tertiary"
      >
        ✕
      </button>
      {state.error && <span className="text-[10px] text-error">{state.error}</span>}
    </form>
  );
}

export function ListaAlumnos({
  reportes,
  sesionUserId,
  filtroInicial = "todos",
  baseHref = "/admin/alumnos",
}: {
  reportes: ReporteAlumno[];
  sesionUserId: string;
  filtroInicial?: FiltroAlumnos;
  /** Para reusar esta misma lista desde Control VIP V2
   * (docs/PROYECTO_CONTROL_VIP_V2.md), que enlaza a su propia ficha en vez de
   * a `/admin/alumnos/[id]`. Sin este prop navega exactamente igual que antes. */
  baseHref?: string;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<"compacta" | "detallada">("compacta");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroAlumnos>(filtroInicial);
  const [filtroPlan, setFiltroPlan] = useState<FiltroPlan>("todos");
  const [pagina, setPagina] = useState(1);

  const conteos = useMemo(
    () => ({
      todos: reportes.length,
      sin_rutina: reportes.filter((r) => pertenece(r, "sin_rutina")).length,
      seguimiento: reportes.filter((r) => pertenece(r, "seguimiento")).length,
      al_dia: reportes.filter((r) => pertenece(r, "al_dia")).length,
      destacados: reportes.filter((r) => pertenece(r, "destacados")).length,
    }),
    [reportes]
  );

  const conteosPlan = useMemo(
    () => ({
      todos: reportes.length,
      3: reportes.filter((r) => r.planDiasSemana === 3).length,
      4: reportes.filter((r) => r.planDiasSemana === 4).length,
      5: reportes.filter((r) => r.planDiasSemana === 5).length,
      sin_plan: reportes.filter((r) => r.planCodigo === null).length,
    }),
    [reportes]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es");
    return reportes
      .filter(
        (reporte) =>
          pertenece(reporte, filtro) &&
          (filtroPlan === "todos" ||
            (filtroPlan === "sin_plan" ? reporte.planCodigo === null : reporte.planDiasSemana === filtroPlan)) &&
          (!q ||
            reporte.nombre.toLocaleLowerCase("es").includes(q) ||
            reporte.objetivo?.toLocaleLowerCase("es").includes(q))
      )
      .sort((a, b) => ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]);
  }, [reportes, busqueda, filtro, filtroPlan]);

  const porPagina = vista === "compacta" ? 16 : 8;
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);

  const cambiarFiltro = (nuevo: FiltroAlumnos) => {
    setFiltro(nuevo);
    setPagina(1);
  };

  const cambiarFiltroPlan = (nuevo: FiltroPlan) => {
    setFiltroPlan(nuevo);
    setPagina(1);
  };

  if (reportes.length === 0) {
    return (
      <Card>
        <p className="text-body text-text-secondary">Todavía no hay alumnos registrados.</p>
      </Card>
    );
  }

  /**
   * Un color por filtro se fue (azul, rojo, ámbar, verde, violeta): es la
   * misma "tarjeta arcoíris" que el instructivo manda a terminar, solo que en
   * chico — con cinco acentos encendidos a la vez ninguno significaba nada.
   * Queda el oro para el filtro elegido y `data-alerta` para los dos que sí
   * piden trabajo, que se tiñen únicamente cuando su conteo es mayor a cero.
   * El icono se conserva: no dependemos solo del color para distinguirlos.
   */
  const filtros: { id: FiltroAlumnos; etiqueta: string; Icon: typeof Users; alerta?: boolean }[] = [
    { id: "todos", etiqueta: "Todos", Icon: Users },
    { id: "sin_rutina", etiqueta: "Sin rutina", Icon: Dumbbell, alerta: true },
    { id: "seguimiento", etiqueta: "Por revisar", Icon: AlertTriangle, alerta: true },
    { id: "al_dia", etiqueta: "Al día", Icon: CircleCheck },
    { id: "destacados", etiqueta: "Destacados", Icon: Star },
  ];

  return (
    <div className="space-y-4">
      <div className="fila-fichas-panel pb-1">
        {filtros.map(({ id, etiqueta, Icon, alerta }) => {
          const activo = filtro === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => cambiarFiltro(id)}
              aria-pressed={activo}
              className="ficha-panel"
              data-activa={activo ? "true" : undefined}
            >
              <Icon
                size={13}
                className={!activo && alerta && conteos[id] > 0 ? "text-warning" : undefined}
              />
              {etiqueta}
              <b>{conteos[id]}</b>
            </button>
          );
        })}
      </div>

      {/* Clasificación por plan CONTRATADO (días/semana), aparte del estado
          de arriba — pedido explícito: ubicar rápido a quiénes pagan 3, 4 o
          5 días semanales (Access/Select · Pro · Élite) sin abrir cada ficha. */}
      {/* Una sola fila que se desliza, no `flex-wrap`: envueltos, estos cinco
          chips ocupaban tres líneas en celular y empujaban el buscador y el
          primer alumno fuera de la pantalla. */}
      <div className="fila-fichas-panel items-center">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">Plan contratado</span>
        {(
          [
            { id: "todos" as const, etiqueta: "Todos" },
            { id: 3 as const, etiqueta: "3 días · 12/mes" },
            { id: 4 as const, etiqueta: "4 días · 16/mes" },
            { id: 5 as const, etiqueta: "5 días · 20/mes" },
            { id: "sin_plan" as const, etiqueta: "Sin plan asignado" },
          ]
        ).map(({ id, etiqueta }) => {
          const activo = filtroPlan === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => cambiarFiltroPlan(id)}
              aria-pressed={activo}
              className="ficha-panel"
              data-activa={activo ? "true" : undefined}
            >
              {etiqueta}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activo ? "bg-black/15" : "bg-surface"}`}>
                {conteosPlan[id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nombre u objetivo..."
            className="radius-control h-11 w-full border border-border bg-surface-2 pl-10 pr-3 text-sm text-text outline-none transition-colors focus:border-vip/60"
          />
        </div>

        <div className="radius-control flex h-11 gap-1 border border-border bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => {
              setVista("compacta");
              setPagina(1);
            }}
            aria-label="Vista compacta"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${
              vista === "compacta" ? "bg-vip text-black" : "text-text-secondary"
            }`}
          >
            <Users size={13} /> Lista
          </button>
          <button
            type="button"
            onClick={() => {
              setVista("detallada");
              setPagina(1);
            }}
            aria-label="Vista detallada"
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors ${
              vista === "detallada" ? "bg-vip text-black" : "text-text-secondary"
            }`}
          >
            <LayoutList size={13} /> Detalle
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-tertiary">
          Mostrando <span className="font-semibold text-text">{visibles.length}</span> de {filtrados.length}
        </p>
        {(filtro !== "todos" || filtroPlan !== "todos") && (
          <button
            type="button"
            onClick={() => {
              cambiarFiltro("todos");
              cambiarFiltroPlan("todos");
            }}
            className="text-xs font-medium text-vip"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <Card padding="p-5" className="border border-border text-center">
          <p className="text-sm font-medium text-text">No hay alumnos en esta categoría</p>
          <p className="mt-1 text-xs text-text-tertiary">Prueba otro filtro o cambia la búsqueda.</p>
        </Card>
      ) : vista === "compacta" ? (
        <Card padding="p-0" className="overflow-hidden border border-border">
          <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(220px,1.35fr)_150px_24px] gap-4 border-b border-border bg-surface-2/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary md:grid">
            <span>Alumno</span>
            <span>Situación</span>
            <span>Actividad</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {visibles.map((reporte) => {
              const visual = estadoVisual(reporte);
              const prioridad = prioridadVisual(reporte);
              return (
                <div
                  key={reporte.alumnoId}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`${baseHref}/${reporte.alumnoId}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`${baseHref}/${reporte.alumnoId}`);
                  }}
                  className="group grid cursor-pointer gap-2 px-4 py-3.5 transition-colors hover:bg-surface-2 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.35fr)_150px_24px] md:items-center md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-vip/10 text-xs font-bold text-vip">
                      {reporte.nombre.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text">
                        {reporte.nombre}
                        {reporte.alumnoId === sesionUserId && <span className="font-normal text-text-tertiary"> (Tú)</span>}
                      </span>
                      <span className="block truncate text-[11px] text-text-tertiary">
                        {reporte.objetivo || "Objetivo todavía no definido"}
                      </span>
                    </span>
                  </div>

                  <div className="min-w-0 md:flex md:items-center md:gap-2">
                    {prioridad && (
                      <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold ${prioridad.clase}`}>
                        {prioridad.etiqueta}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${visual.clase}`}>
                      <visual.Icon size={11} /> {visual.etiqueta}
                    </span>
                    <EditorPlanRapido reporte={reporte} />
                    <p className="mt-1 truncate text-xs text-text-secondary md:mt-0">{reporte.razonPrioridad}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs md:block">
                    <span className="text-text-secondary">
                      {reporte.diasSinEntrenar === null
                        ? "Sin entrenamientos"
                        : reporte.diasSinEntrenar === 0
                          ? "Entrenó hoy"
                          : `Último: hace ${reporte.diasSinEntrenar} d`}
                    </span>
                    <span className="text-text-tertiary md:block">{reporte.pctSesiones}% del mes</span>
                  </div>
                  <ChevronRight size={16} className="hidden text-text-tertiary transition-transform group-hover:translate-x-0.5 md:block" />
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {visibles.map((reporte) => (
            <TarjetaReporteAlumno
              key={reporte.alumnoId}
              reporte={reporte}
              esTuPerfil={reporte.alumnoId === sesionUserId}
              baseHref={baseHref}
            />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            disabled={paginaActual === 1}
            onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary disabled:opacity-35"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span className="text-xs text-text-tertiary">
            Página <strong className="text-text">{paginaActual}</strong> de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={paginaActual === totalPaginas}
            onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary disabled:opacity-35"
          >
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
