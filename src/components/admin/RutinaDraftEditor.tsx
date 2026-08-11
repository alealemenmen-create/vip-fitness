"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Search, Copy, RefreshCcw, Pencil, Check } from "lucide-react";
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
import { patronMovimiento } from "@/lib/rutinas/patrones";

/** Revisión de IA del borrador. Opcional: solo el flujo del generador la pasa
 * — desde un PDF importado no hay ficha ni brief contra qué contrastar. */
export type RevisarRutinaFn = (
  rutina: RutinaExtraida
) => Promise<{ ok: true; revision: RevisionResuelta } | { ok: false; error: string }>;

/** Biblioteca real para el selector de ejercicios (tarea: "que yo presione
 * sobre el ejercicio y se me dé una lista para elegir, no que tenga que
 * escribir"). Opcional: si no llega (otros llamadores de este editor que
 * todavía no la pasan), el nombre sigue siendo un campo de texto libre. */
export type EjercicioBiblioteca = { id: string; nombre: string; grupo: string; equipo: string };

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

/** Colores de lectura del borrador. Bíceps y tríceps se separan aunque la
 * base todavía los guarde juntos como `brazos`. */
function grupoVisual(ejercicio: Pick<Ejercicio, "nombre" | "grupoMuscular">): GrupoVisual {
  const patron = patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular);
  if (patron.startsWith("biceps_")) return { etiqueta: "Bíceps", color: "#06b6d4" };
  if (patron.startsWith("triceps_")) return { etiqueta: "Tríceps", color: "#a855f7" };
  const grupos: Record<NonNullable<Ejercicio["grupoMuscular"]>, GrupoVisual> = {
    pecho: { etiqueta: "Pecho", color: "#ef4444" },
    espalda: { etiqueta: "Espalda", color: "#3b82f6" },
    piernas: { etiqueta: "Piernas", color: "#22c55e" },
    hombros: { etiqueta: "Hombros", color: "#f59e0b" },
    brazos: { etiqueta: "Brazos", color: "#8b5cf6" },
    core: { etiqueta: "Core", color: "#ec4899" },
    cardio: { etiqueta: "Cardio", color: "#14b8a6" },
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
  grupoSugerido,
  biblioteca,
  onElegir,
  onCerrar,
}: {
  grupoSugerido: string | null;
  biblioteca: EjercicioBiblioteca[];
  onElegir: (e: EjercicioBiblioteca) => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [soloGrupo, setSoloGrupo] = useState(Boolean(grupoSugerido));

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return biblioteca
      .filter((e) => !soloGrupo || !grupoSugerido || e.grupo === grupoSugerido)
      .filter((e) => !q || `${e.nombre} ${e.grupo} ${e.equipo}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [biblioteca, busqueda, soloGrupo, grupoSugerido]);

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
      {grupoSugerido && (
        <label className="text-micro mb-1.5 flex items-center gap-1.5 text-text-tertiary">
          <input type="checkbox" checked={soloGrupo} onChange={(e) => setSoloGrupo(e.target.checked)} />
          Solo {grupoSugerido}
        </label>
      )}
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
            <span className="text-micro shrink-0 text-text-tertiary">{e.grupo}</span>
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
  onIndividual: (nombre: string) => void;
  onEncadenar?: (nombre: string, cantidad: number) => void;
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
    if (!tecnica) return onIndividual(nombre);
    const cantidad = tecnica.cantidadEjercicios ?? 2;
    if (tecnica.tipo === "encadenada" && onEncadenar) return onEncadenar(tecnica.nombre, cantidad);
    onIndividual(tecnica.nombre);
  };

  return (
    <div>
      <Select value={conocida ? nombreBase : ""} onChange={(e) => elegir(e.target.value)} className="py-1.5">
        <option value="">Sin técnica especial</option>
        <optgroup label="Individuales (este ejercicio solo)">
          {individuales.map((t) => (
            <option key={t.nombre} value={t.nombre}>
              {t.nombre}
            </option>
          ))}
        </optgroup>
        <optgroup label="Encadenadas (unen varios ejercicios)">
          {encadenadas.map((t) => (
            <option key={t.nombre} value={t.nombre}>
              {t.nombre} — {t.cantidadEjercicios ?? 2} ejercicios
            </option>
          ))}
        </optgroup>
      </Select>
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
  tipo: "individual" | "encadenada";
  cantidadEjercicios: number | null;
};

function EjercicioForm({
  numero,
  ejercicio,
  grupoSugerido,
  biblioteca,
  tecnicas,
  onChange,
  onRemove,
  onEncadenar,
}: {
  numero: number;
  ejercicio: Ejercicio;
  grupoSugerido: string | null;
  biblioteca?: EjercicioBiblioteca[];
  /** Las técnicas reales del gimnasio. Sin esto el campo sigue siendo texto
   * libre, que es como funcionaba antes. */
  tecnicas?: TecnicaOpcion[];
  onChange: (e: Ejercicio) => void;
  onRemove: () => void;
  /** Elegir una técnica encadenada no es un dato de ESTE ejercicio: une a
   * varios seguidos. Lo resuelve el día, que es quien los conoce a todos. */
  onEncadenar?: (nombre: string, cantidad: number) => void;
}) {
  // El resumen útil queda siempre visible. Técnica, observación y progresión
  // empiezan cerradas para que una rutina de 30 ejercicios no obligue a
  // recorrer una página interminable.
  const [ampliado, setAmpliado] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const colorTecnica = colorTecnicaVisual(ejercicio.tecnicaTipo);
  const visual = grupoVisual(ejercicio);

  return (
    <div
      className="radius-control border px-2 py-1.5"
      style={{
        borderColor: visual.color,
        boxShadow: colorTecnica
          ? `inset 3px 0 0 ${visual.color}, 0 0 0 1px ${colorTecnica}`
          : `inset 3px 0 0 ${visual.color}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-caption w-4 shrink-0 text-right text-text-tertiary">{numero}</span>
        {biblioteca ? (
          <button
            type="button"
            onClick={() => setEligiendo((v) => !v)}
            className="radius-control min-w-0 flex-1 truncate border border-border bg-surface-2 px-2.5 py-2 text-left text-secondary font-bold"
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
          grupoSugerido={ejercicio.grupoMuscular ?? grupoSugerido}
          biblioteca={biblioteca}
          onCerrar={() => setEligiendo(false)}
          onElegir={(elegido) => {
            onChange({
              ...ejercicio,
              nombre: elegido.nombre,
              ejercicioId: elegido.id,
              grupoMuscular: (elegido.grupo as Ejercicio["grupoMuscular"]) ?? ejercicio.grupoMuscular,
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

      <div className="mt-1 flex items-center gap-1 pl-[22px]">
        <label className="text-caption shrink-0 text-text-tertiary">Series</label>
        <Input
          type="number"
          min="1"
          value={ejercicio.series}
          onChange={(e) => onChange({ ...ejercicio, series: Number(e.target.value) })}
          className="w-12 px-1.5 py-1 text-center"
        />
        <label className="text-caption shrink-0 text-text-tertiary">Reps</label>
        <Input
          value={ejercicio.reps}
          onChange={(e) => onChange({ ...ejercicio, reps: e.target.value })}
          className="w-16 px-1.5 py-1 text-center"
        />
        <label className="text-caption shrink-0 text-text-tertiary">Desc.</label>
        <Input
          type="number"
          min="0"
          value={ejercicio.descansoSegundos ?? ""}
          onChange={(e) =>
            onChange({
              ...ejercicio,
              descansoSegundos: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="w-14 px-1.5 py-1 text-center"
        />
        <button
          type="button"
          onClick={() => setAmpliado((v) => !v)}
          aria-label={ampliado ? "Ocultar detalles" : "Más detalles"}
          className="ml-auto shrink-0 p-1 text-text-tertiary"
        >
          {ampliado ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

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
              onIndividual={(nombre) => onChange({ ...ejercicio, tecnicaTipo: nombre })}
              onEncadenar={onEncadenar}
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
}) {
  // Coordenadas de la tarjeta abierta para editar, no el ejercicio en sí:
  // así, al insertar uno nuevo, alcanza con apuntar a su posición para que
  // aparezca ya abierto (ver `insertar` más abajo).
  const [editando, setEditando] = useState<{ dia: number; ej: number } | null>(null);

  const insertar = (diaIdx: number, posicion: number) => {
    onInsertarEjercicio(diaIdx, posicion);
    setEditando({ dia: diaIdx, ej: posicion });
  };

  return (
    <div className={expandida ? "space-y-4" : "max-h-[34rem] space-y-3 overflow-y-auto pr-1"}>
      <p className="text-card-title font-bold text-text">{draft.nombreRutina}</p>
      {draft.dias.map((dia, diaIdx) => (
        <Fragment key={`${dia.numero}-${dia.nombre}`}>
        <section className="radius-control overflow-hidden border border-border">
          <div className="flex items-center justify-between gap-2 bg-surface-2 px-2.5 py-2">
            <p className="text-secondary font-bold text-vip">DÍA {dia.numero} · {dia.nombre}</p>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-micro text-text-tertiary">
                {dia.tipo === "descanso" ? "Descanso" : `${dia.ejercicios.length} ejercicios`}
              </span>
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
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-surface px-2.5 py-1.5">
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
          )}
          {dia.descripcion && <p className="text-micro border-t border-border px-2.5 py-1.5 text-text-tertiary">{dia.descripcion}</p>}
          {dia.tipo === "entrenamiento" && (
            <div className="space-y-3 border-t border-border p-2 pb-4">
              {dia.ejercicios.map((ejercicio, indice) => {
                const visual = grupoVisual(ejercicio);
                const colorTecnica = colorTecnicaVisual(ejercicio.tecnicaTipo);
                const abierto = editando?.dia === diaIdx && editando.ej === indice;
                return (
                  <div key={`${dia.numero}-${indice}-${ejercicio.nombre}`} className="relative">
                    {abierto ? (
                      <div className="radius-control border border-vip/50 bg-surface-2 p-2">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-micro font-semibold text-vip">Editando ejercicio {indice + 1}</span>
                          <button
                            type="button"
                            onClick={() => setEditando(null)}
                            className="text-micro flex items-center gap-1 font-semibold text-vip"
                          >
                            <Check size={13} /> Listo
                          </button>
                        </div>
                        <EjercicioForm
                          numero={indice + 1}
                          ejercicio={ejercicio}
                          grupoSugerido={grupoDominante(dia)}
                          biblioteca={biblioteca}
                          tecnicas={tecnicas}
                          onEncadenar={
                            onEncadenar ? (nombre, cantidad) => onEncadenar(diaIdx, indice, nombre, cantidad) : undefined
                          }
                          onChange={(e) => onActualizarEjercicio(diaIdx, indice, e)}
                          onRemove={() => {
                            onQuitarEjercicio(diaIdx, indice);
                            setEditando(null);
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="radius-control border bg-surface px-2 py-1.5"
                        style={{ borderColor: visual.color, boxShadow: `inset 3px 0 0 ${visual.color}` }}
                      >
                        <div className="flex min-w-0 items-center gap-1.5 pl-1">
                          <span className="text-micro w-4 shrink-0 text-right font-semibold text-text-tertiary">{indice + 1}.</span>
                          <strong className="text-caption min-w-0 flex-1 truncate" style={{ color: visual.color, fontWeight: 800 }}>
                            {ejercicio.nombre}
                          </strong>
                          <span className="text-[9px] shrink-0 rounded-full border px-1.5 py-0.5 font-bold uppercase" style={{ color: visual.color, borderColor: visual.color }}>
                            {visual.etiqueta}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditando({ dia: diaIdx, ej: indice })}
                            aria-label={`Editar ${ejercicio.nombre}`}
                            className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-text-tertiary active:bg-vip active:text-black"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                        <p className="text-micro mt-0.5 pl-6 text-text-secondary">
                          {ejercicio.series} series × {ejercicio.reps} reps
                          {ejercicio.descansoSegundos !== null ? ` · ${ejercicio.descansoSegundos}s descanso` : ""}
                        </p>
                        {ejercicio.tecnicaTipo && (
                          <p className="text-micro mt-0.5 pl-6 font-semibold" style={{ color: colorTecnica ?? "var(--color-vip)" }}>
                            {ejercicio.tecnicaTipo}{ejercicio.tecnicaInstruccion ? ` · ${ejercicio.tecnicaInstruccion}` : ""}
                          </p>
                        )}
                        {ejercicio.observacion && <p className="text-micro mt-0.5 pl-6 text-text-tertiary">{ejercicio.observacion}</p>}
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
                      className="absolute -bottom-3.5 right-2 z-[1] grid size-7 place-items-center rounded-full border border-vip bg-surface text-vip shadow-sm active:bg-vip active:text-black"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                );
              })}
              {dia.ejercicios.length === 0 && (
                <button
                  type="button"
                  onClick={() => insertar(diaIdx, 0)}
                  className="radius-control flex w-full items-center justify-center gap-1.5 border border-dashed border-vip/50 py-2.5 text-caption font-semibold text-vip"
                >
                  <Plus size={14} /> Agregar el primer ejercicio del día
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
      ))}
      {onAgregarDia && (
        <button
          type="button"
          onClick={onAgregarDia}
          className="radius-control flex w-full items-center justify-center gap-1.5 border border-dashed border-vip/50 py-3 text-caption font-semibold text-vip"
        >
          <Plus size={15} /> Agregar otro día
        </button>
      )}
      <p className="text-caption text-right font-semibold text-text-secondary">— Alejandro Mendoza · Método VIP Fitness</p>
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
  // `draftInicial` viene de la extracción por IA (`RutinaExtraida` plano,
  // sin config de progresión — eso nunca lo decide la IA). Se completan acá
  // los defaults de Impulso VIP por ejercicio, para que quede prendido de
  // entrada y no solo "se vea prendido" en el checkbox sin estarlo de
  // verdad al publicar (ver DEFAULTS_PROGRESION más arriba).
  const [draft, setDraft] = useState<RutinaConProgresion>(() => ({
    ...draftInicial,
    dias: draftInicial.dias.map((dia) => ({
      ...dia,
      ejercicios: dia.ejercicios.map((ej) => ({ ...DEFAULTS_PROGRESION, ...ej })),
    })),
  }));
  const [publicando, setPublicando] = useState(false);
  const [planCodigo, setPlanCodigo] = useState<CodigoPlanEntrenamiento | "">("");
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

  const publicar = async () => {
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
    <div className="space-y-4">
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
                        grupoSugerido={grupoDominante(dia)}
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

      <Card padding="p-0" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setMostrarPreview((v) => !v)}
          aria-expanded={mostrarPreview}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-secondary font-medium text-text">Vista previa del documento</span>
          {mostrarPreview ? <ChevronUp size={16} className="text-text-secondary" /> : <ChevronDown size={16} className="text-text-secondary" />}
        </button>
        {mostrarPreview && (
          <div className="border-t border-border p-3">
            <p className="text-micro mb-2 text-text-tertiary">
              Vista de revisión por día y grupo muscular. El contenido completo es el que se guarda como documento del alumno.
            </p>
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
            />
          </div>
        )}
      </Card>

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

      <div className="flex gap-2">
        <Button onClick={publicar} loading={publicando} className="flex-1">
          {publicando ? "Publicando…" : "Confirmar y asignar rutina"}
        </Button>
        <Button variant="secondary" size="lg" onClick={onDescartar} className="w-auto px-6">
          Descartar
        </Button>
      </div>
    </div>
  );
}
