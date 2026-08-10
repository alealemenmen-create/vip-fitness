"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { publicarRutinaAVariosAlumnos } from "@/app/admin/archivos/actions";
import { RevisionIAPanel } from "@/components/admin/RevisionIAPanel";
import { serializarRutinaATexto } from "@/lib/generador-rutinas/serializar";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { CambioResuelto, RevisionResuelta } from "@/lib/ai/revisarRutina";
import type { TipoProgresionImpulso } from "@/lib/supabase/types";

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
 * y el resto se despliega solo si hace falta — o solo si ya trae contenido, así
 * nada de lo que extrajo la IA queda escondido. */
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

function EjercicioForm({
  numero,
  ejercicio,
  grupoSugerido,
  biblioteca,
  onChange,
  onRemove,
}: {
  numero: number;
  ejercicio: Ejercicio;
  grupoSugerido: string | null;
  biblioteca?: EjercicioBiblioteca[];
  onChange: (e: Ejercicio) => void;
  onRemove: () => void;
}) {
  const traeExtras = Boolean(
    ejercicio.grupoMuscular || ejercicio.tecnicaTipo || ejercicio.observacion || ejercicio.aptoProgresion
  );
  const [ampliado, setAmpliado] = useState(traeExtras);
  const [eligiendo, setEligiendo] = useState(false);

  return (
    <div className="radius-control border border-border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-caption w-4 shrink-0 text-right text-text-tertiary">{numero}</span>
        {biblioteca ? (
          <button
            type="button"
            onClick={() => setEligiendo((v) => !v)}
            className="radius-control min-w-0 flex-1 truncate border border-border bg-surface-2 px-4 py-3 text-left text-body text-text"
          >
            {ejercicio.nombre || <span className="text-text-tertiary">Toca para elegir ejercicio…</span>}
          </button>
        ) : (
          <Input
            value={ejercicio.nombre}
            onChange={(e) => onChange({ ...ejercicio, nombre: e.target.value })}
            placeholder="Nombre del ejercicio"
            className="flex-1 py-1.5"
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

      <div className="mt-1.5 flex items-center gap-1.5 pl-[22px]">
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
          <Input
            value={ejercicio.tecnicaTipo ?? ""}
            onChange={(e) => onChange({ ...ejercicio, tecnicaTipo: e.target.value || null })}
            placeholder="Técnica especial (ej: Biserie (1/2))"
            className="py-1.5"
          />
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
}: {
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
  const [error, setError] = useState<string | null>(null);
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

  const publicar = async () => {
    setPublicando(true);
    setError(null);

    // El try/finally NO es decorativo. Antes, si la acción del servidor lanzaba
    // (error de red, función cortada por tiempo, fallo del servidor), la promesa
    // se rechazaba y el `setPublicando(false)` de abajo nunca se ejecutaba: el
    // botón quedaba en "Publicando…" para siempre, sin mostrar nada. El
    // entrenador no tenía forma de saber que había fallado, ni yo de saber por
    // qué. Cualquier fallo tiene que terminar en un mensaje en pantalla.
    try {
      const resultado = await publicarRutinaAVariosAlumnos(alumnoIds, draft);

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
      setError(
        `No se pudo publicar: ${e instanceof Error ? e.message : "error inesperado"}. ` +
          "La rutina sigue aquí, puedes intentar de nuevo."
      );
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

      {draft.dias.map((dia, diaIdx) => {
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

      <button
        onClick={() => {
          agregarDia();
          setDiasAbiertos((s) => new Set(s).add(draft.dias.length));
        }}
        className="text-secondary radius-control flex w-full items-center justify-center gap-1 border border-border py-3 text-text-tertiary"
      >
        <Plus size={16} /> Agregar día
      </button>

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
              Esto es exactamente lo que se guarda como documento del alumno al confirmar.
            </p>
            <pre className="text-micro max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-surface-2 p-2 font-sans text-text-secondary">
              {previewTexto}
            </pre>
          </div>
        )}
      </Card>

      {error && <p className="text-caption text-error">{error}</p>}

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
