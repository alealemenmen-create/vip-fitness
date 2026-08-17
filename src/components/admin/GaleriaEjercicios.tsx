"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Camera, Plus, X, Check, ImageIcon, Play, TriangleAlert, Film, ListChecks, Printer, Merge, CircleAlert, LibraryBig, ClipboardCheck, Undo2, UploadCloud, Wrench, ChevronLeft, ChevronRight, ShieldCheck, Link2Off, VideoOff, Copy, Loader2, Dumbbell } from "lucide-react";
import { CargaMasivaFotos } from "@/components/admin/CargaMasivaFotos";
import { ModoGimnasio } from "@/components/admin/ModoGimnasio";
import { Card } from "@/components/ui/Card";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import {
  subirFotoEjercicio,
  crearEjercicioNuevo,
  actualizarNombreEjercicio,
  actualizarClasificacionEjercicio,
  actualizarDetallesEjercicio,
  actualizarPatronMovimiento,
  actualizarPerfilImpulsoEjercicio,
  desactivarEjercicio,
  quitarVideoEjercicio,
  obtenerUsosRutina,
  reasignarEntradaRutina,
  resolverReporteFoto,
  iniciarSubidaVideoCloudflare,
  confirmarSubidaVideoCloudflare,
  sincronizarVideoCloudflare,
  quitarVideoCloudflare,
  type UsoRutina,
  vincularNombreRutinaSinEjercicio,
  type VincularNombreRutinaState,
  combinarEjerciciosDuplicados,
  type CombinarDuplicadosState,
  deshacerFusionEjercicios,
  type DeshacerFusionState,
  resolverAliasEnDisputa,
  type ResolverAliasState,
  agregarAliasEjercicio,
  type AgregarAliasState,
  quitarFotoEjercicio,
  type QuitarFotoState,
  restaurarFotoAnteriorEjercicio,
  type RestaurarFotoAnteriorState,
} from "@/app/admin/ejercicios/actions";
import { normalizar } from "@/lib/alimentos/emparejar";
import { detectarAliasEnDisputa, emparejarEjercicio } from "@/lib/ejercicios/emparejar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { Ejercicio, EjercicioIncompleto } from "@/lib/ejercicios/tipos";
import type { PatronMovimiento } from "@/lib/rutinas/patrones";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { ModalVideo } from "@/components/student/ModalVideo";
import { CuadroFotoReferencia } from "@/components/student/SesionEjercicioCard";
import type { UsoEjercicioInventario } from "@/lib/ejercicios/inventario";
import type { FusionEjercicio } from "@/lib/ejercicios/data";
import { duracionVideo, subirDirectoCloudflare } from "@/lib/ejercicios/videoCliente";
import {
  obtenerMultimediaDeEjercicio,
  agregarFotoGaleria,
  elegirFotoPrincipal,
  quitarFotoGaleria,
  restaurarVideoArchivado,
  type ItemMultimedia,
  type AgregarFotoGaleriaState,
  type CambioMultimediaReciente,
} from "@/app/admin/ejercicios/multimediaActions";
import type { ItemIngestaHuerfano } from "@/app/admin/ejercicios/ingestaActions";

const ETIQUETAS_GRUPO: Record<string, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

/** Mismo vocabulario que usa el generador para clasificar por nombre (ver
 * `patronMovimiento()` en lib/rutinas/patrones.ts), agrupado por zona para que
 * elegir entre 28 opciones no sea una lista plana interminable. */
const GRUPOS_PATRON: { etiqueta: string; opciones: { valor: PatronMovimiento; etiqueta: string }[] }[] = [
  {
    etiqueta: "Pecho",
    opciones: [
      { valor: "pecho_press_horizontal", etiqueta: "Press horizontal" },
      { valor: "pecho_press_inclinado", etiqueta: "Press inclinado" },
      { valor: "pecho_aislamiento", etiqueta: "Aislamiento (aperturas/cruces)" },
    ],
  },
  {
    etiqueta: "Espalda",
    opciones: [
      { valor: "espalda_traccion_vertical", etiqueta: "Tracción vertical (jalón/dominada)" },
      { valor: "espalda_remo_horizontal", etiqueta: "Remo horizontal" },
      { valor: "espalda_pullover", etiqueta: "Pullover" },
      { valor: "espalda_bisagra", etiqueta: "Bisagra (peso muerto/hiperextensión)" },
      { valor: "espalda_trapecio", etiqueta: "Trapecio (encogimientos)" },
    ],
  },
  {
    etiqueta: "Hombros",
    opciones: [
      { valor: "hombro_press_vertical", etiqueta: "Press vertical" },
      { valor: "hombro_lateral", etiqueta: "Elevación lateral" },
      { valor: "hombro_posterior", etiqueta: "Deltoide posterior" },
      { valor: "hombro_anterior", etiqueta: "Deltoide anterior (frontal)" },
    ],
  },
  {
    etiqueta: "Bíceps",
    opciones: [
      { valor: "biceps_supinado", etiqueta: "Supinado (curl clásico)" },
      { valor: "biceps_neutro", etiqueta: "Neutro (martillo)" },
      { valor: "biceps_hombro_flexionado", etiqueta: "Hombro flexionado (predicador/Scott)" },
    ],
  },
  {
    etiqueta: "Tríceps",
    opciones: [
      { valor: "triceps_polea_abajo", etiqueta: "Hacia abajo (polea)" },
      { valor: "triceps_sobre_cabeza", etiqueta: "Sobre la cabeza (overhead)" },
      { valor: "triceps_compuesto", etiqueta: "Compuesto (fondos/press cerrado)" },
    ],
  },
  {
    etiqueta: "Pierna",
    opciones: [
      { valor: "pierna_dominante_rodilla", etiqueta: "Dominante de rodilla (sentadilla/prensa)" },
      { valor: "pierna_bisagra_cadera", etiqueta: "Bisagra de cadera (peso muerto rumano)" },
      { valor: "pierna_empuje_cadera", etiqueta: "Empuje de cadera (hip thrust)" },
      { valor: "pierna_flexion_rodilla", etiqueta: "Flexión de rodilla (curl femoral)" },
      { valor: "pierna_extension_rodilla", etiqueta: "Extensión de rodilla (cuádriceps)" },
      { valor: "pierna_abduccion", etiqueta: "Abducción" },
      { valor: "pierna_aduccion", etiqueta: "Aducción" },
      { valor: "pierna_pantorrilla", etiqueta: "Pantorrilla" },
    ],
  },
  {
    etiqueta: "Otros",
    opciones: [
      { valor: "core", etiqueta: "Core" },
      { valor: "cardio", etiqueta: "Cardio" },
      { valor: "otro", etiqueta: "Otro / sin encajar" },
    ],
  },
];

const ESTADO_INICIAL_PATRON = { error: null, ok: false };
const ESTADO_INICIAL_CLASIFICACION = { error: null, ok: false };

const TECNICAS_IMPULSO = [
  ["tempo_controlado", "Tempo controlado"],
  ["pausa_isometrica", "Pausa isométrica"],
  ["serie_descarga", "Serie de descarga"],
  ["drop_set", "Drop set"],
  ["rest_pause", "Rest-pause"],
  ["fallo_controlado", "Fallo técnico"],
] as const;

function EditorPerfilImpulso({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(actualizarPerfilImpulsoEjercicio, { error: null, ok: false });

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-vip/25 bg-vip/[0.05] p-3">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <div>
        <p className="text-caption font-semibold text-text">Seguridad de Impulso VIP</p>
        <p className="mt-0.5 text-micro leading-snug text-text-tertiary">
          Define qué puede pedir Ale durante una sesión. Impulso no lo adivina por el nombre.
        </p>
      </div>
      <label className="block text-caption text-text-secondary">
        Intensidad máxima
        <select
          name="impulso_intensidad_maxima"
          defaultValue={ejercicio.impulsoIntensidadMaxima}
          className="radius-control mt-1 w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
        >
          <option value="ninguna">Ninguna técnica intensa</option>
          <option value="baja">Baja · solo control técnico</option>
          <option value="media">Media · permite descarga</option>
          <option value="alta">Alta · solo alumnos avanzados</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-caption text-text-secondary">Técnicas autorizadas</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {TECNICAS_IMPULSO.map(([valor, etiqueta]) => (
            <label key={valor} className="flex min-h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-2 text-micro text-text">
              <input
                type="checkbox"
                name="impulso_tecnicas_permitidas"
                value={valor}
                defaultChecked={ejercicio.impulsoTecnicasPermitidas.includes(valor)}
                className="accent-vip"
              />
              {etiqueta}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-caption text-text-secondary">
        <input
          type="checkbox"
          name="impulso_requiere_supervision"
          defaultChecked={ejercicio.impulsoRequiereSupervision}
          className="accent-vip"
        />
        Exigir supervisión de Ale para la técnica
      </label>
      {!ejercicio.impulsoPerfilRevisado && (
        <p className="text-micro font-semibold text-warning">Perfil automático pendiente de revisión manual.</p>
      )}
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && <p className="flex items-center gap-1 text-caption text-success"><Check size={12} /> Perfil revisado y guardado.</p>}
      <button
        type="submit"
        disabled={pending}
        className="radius-control flex h-9 w-full items-center justify-center border border-vip/35 bg-vip/10 text-caption font-semibold text-vip disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar seguridad de Impulso"}
      </button>
    </form>
  );
}

/**
 * Clasificación biomecánica estructurada de UN ejercicio (columna
 * `patron_movimiento`, migración 0051). Mientras esta columna esté vacía, el
 * motor sigue adivinando el patrón por el nombre — cargarla acá es el primer
 * paso para reemplazar esa heurística por dato real, ejercicio por ejercicio.
 */
function EditorPatronMovimiento({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(actualizarPatronMovimiento, ESTADO_INICIAL_PATRON);

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <span className="text-caption block text-text-tertiary">
        Patrón de movimiento — lo que hoy adivina el generador por el nombre
      </span>
      <select
        name="patron_movimiento"
        defaultValue={ejercicio.patronMovimiento ?? ""}
        className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
      >
        <option value="">Sin clasificar (usar heurística por nombre)</option>
        {GRUPOS_PATRON.map((grupo) => (
          <optgroup key={grupo.etiqueta} label={grupo.etiqueta}>
            {grupo.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-caption flex items-center gap-1 text-success">
          <Check size={12} /> Patrón guardado.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar patrón"}
      </button>
    </form>
  );
}

/** Grupo muscular, categoría y equipo de un ejercicio YA CARGADO — antes
 * solo se elegían al crearlo (instructivo del panel §8.8: "un ejercicio ya
 * cargado no se puede reclasificar" era el hueco real). Mismas tres listas
 * que usa `ModalEjercicioNuevo` (`GRUPOS`/`CATEGORIAS`/`EQUIPOS`, más abajo
 * en este archivo), para que crear y reclasificar ofrezcan exactamente las
 * mismas opciones. */
function EditorClasificacion({
  ejercicio,
}: {
  /** Acepta tanto un `Ejercicio` completo (reclasificar uno ya cargado) como
   * una `EjercicioIncompleto` (completar la ficha — instructivo §7.3): solo
   * se le pide el pedazo que de verdad usa, no el objeto entero, así sirve
   * para los dos casos sin duplicar este formulario. Al guardar, la fila
   * desaparece sola de "Completar ficha" en el próximo render — el mismo
   * `revalidatePath` que ya dispara cualquier edición de esta pantalla. */
  ejercicio: {
    id: string;
    grupoMuscular: string | null;
    categoria: string | null;
    equipo: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(actualizarClasificacionEjercicio, ESTADO_INICIAL_CLASIFICACION);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <p className="text-caption font-semibold text-text">Clasificación</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-micro text-text-tertiary">Grupo</span>
          <select
            name="grupo_muscular"
            defaultValue={ejercicio.grupoMuscular ?? ""}
            className="radius-control mt-1 w-full border border-border bg-surface-2 px-2 py-2 text-[11px] text-text"
          >
            <option value="" disabled>Elegir…</option>
            {GRUPOS.map((g) => (
              <option key={g.valor} value={g.valor}>{g.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-text-tertiary">Categoría</span>
          <select
            name="categoria"
            defaultValue={ejercicio.categoria ?? ""}
            className="radius-control mt-1 w-full border border-border bg-surface-2 px-2 py-2 text-[11px] text-text"
          >
            <option value="" disabled>Elegir…</option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-micro text-text-tertiary">Equipo</span>
          <select
            name="equipo"
            defaultValue={ejercicio.equipo ?? ""}
            className="radius-control mt-1 w-full border border-border bg-surface-2 px-2 py-2 text-[11px] text-text"
          >
            <option value="" disabled>Elegir…</option>
            {EQUIPOS.map((e) => (
              <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
            ))}
          </select>
        </label>
      </div>
      {/* Aviso de impacto (instructivo: "confirmaciones indican alcance"):
          reclasificar puede mover al ejercicio de familia de zona/equipo en
          `emparejarEjercicio` y cambiar a qué le empareja el sistema de acá
          en adelante — no toca rutinas ya vinculadas, esas siguen por id. */}
      <p className="text-micro text-text-tertiary">
        No afecta rutinas ya vinculadas a este ejercicio; sí cambia cómo el sistema lo reconoce de ahora en más.
      </p>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-caption flex items-center gap-1 text-success">
          <Check size={12} /> Clasificación guardada.
        </p>
      )}
      <Button type="submit" size="xs" loading={pending}>Guardar clasificación</Button>
    </form>
  );
}

export type ReporteFotoPendiente = {
  id: string;
  ejercicioId: string | null;
  nombreEjercicio: string;
  fotoUrl: string | null;
  creadoEn: string;
  alumnoNombre: string;
};

const ESTADO_INICIAL_VINCULO: VincularNombreRutinaState = { error: null, ok: false };
const ESTADO_INICIAL_COMBINAR: CombinarDuplicadosState = { error: null, ok: false };
const ESTADO_INICIAL_DESHACER: DeshacerFusionState = { error: null, ok: false };
const ESTADO_INICIAL_RESTAURAR_FOTO: RestaurarFotoAnteriorState = { error: null, ok: false };

function firmaPosibleDuplicado(nombre: string): string {
  return normalizar(nombre)
    .split(" ")
    .filter((palabra) => !["de", "del", "la", "el", "al", "en", "con"].includes(palabra))
    .map((palabra) => palabra
      .replace(/iones$/, "ion")
      .replace(/ales$/, "al")
      .replace(/ares$/, "ar")
      .replace(/([aeiou])s$/, "$1"))
    .join(" ");
}

function CombinarDuplicadoForm({ original, duplicado }: { original: Ejercicio; duplicado: Ejercicio }) {
  const [state, action, pending] = useActionState(combinarEjerciciosDuplicados, ESTADO_INICIAL_COMBINAR);
  return (
    <form
      action={action}
      onSubmit={(evento) => {
        if (!window.confirm(`¿Combinar "${duplicado.nombre}" con "${original.nombre}"? Las rutinas se asociarán al original y el otro nombre quedará como alias.`)) evento.preventDefault();
      }}
      className="mt-1.5"
    >
      <input type="hidden" name="original_id" value={original.id} />
      <input type="hidden" name="duplicado_id" value={duplicado.id} />
      <button type="submit" disabled={pending} className="radius-control flex items-center gap-1 border border-warning/40 px-2 py-1 text-[9px] font-semibold text-warning disabled:opacity-50">
        <Merge size={11} /> {pending ? "Combinando…" : "Combinar con el original"}
      </button>
      {state.error && <p className="text-micro mt-1 text-error">{state.error}</p>}
      {state.ok && <p className="text-micro mt-1 text-success">{state.mensaje}</p>}
    </form>
  );
}

const ESTADO_INICIAL_ALIAS: ResolverAliasState = { error: null, ok: false };

/**
 * Dos ejercicios legítimos que reclaman el mismo alias. No es un duplicado: es
 * una palabra que quedó registrada en los dos, y mientras siga así ninguna
 * rutina que la use puede mostrar foto (el emparejador se niega a adivinar
 * entre dos músculos distintos).
 *
 * Va aparte de "Posibles duplicados" a propósito, porque la acción correcta es
 * la contraria: acá no hay que combinar nada — combinar "Extensión unilateral
 * de tríceps" con la de cuádriceps desactivaría un ejercicio real y le
 * trasladaría sus usos al otro.
 */
function AliasEnDisputaCard({
  alias,
  ejercicios,
  usosPorEjercicio,
}: {
  alias: string;
  ejercicios: Ejercicio[];
  usosPorEjercicio: Record<string, UsoEjercicioInventario>;
}) {
  const [state, action, pending] = useActionState(resolverAliasEnDisputa, ESTADO_INICIAL_ALIAS);
  // Solo se puede quitar de los que lo tienen como alias: si uno lo lleva como
  // nombre propio, ese es su dueño natural y no hay nada que sacarle.
  const quitables = ejercicios.filter((ejercicio) =>
    ejercicio.aliases.some((item) => normalizar(item) === normalizar(alias)),
  );

  return (
    <div className="radius-control border border-border bg-surface p-2.5">
      <p className="text-caption text-text">
        <span className="font-bold text-warning">“{alias}”</span> está registrado en {ejercicios.length} ejercicios.
      </p>
      <p className="text-micro mt-0.5 text-text-tertiary">
        Mientras dure, las rutinas que lo usen quedan sin foto en vez de mostrar la equivocada.
      </p>

      <p className="text-micro mt-2 font-semibold text-text-secondary">¿A cuál pertenece?</p>
      <div className="mt-1.5 space-y-1.5">
        {ejercicios.map((ejercicio) => {
          const usos = usosPorEjercicio[ejercicio.id]?.cantidad ?? 0;
          const otros = quitables.filter((item) => item.id !== ejercicio.id);
          return (
            <div key={ejercicio.id} className="radius-control border border-border bg-surface-2 p-2">
              <p className="text-caption font-semibold text-text">{ejercicio.nombre}</p>
              <p className="text-micro text-text-tertiary">
                {ETIQUETAS_GRUPO[ejercicio.grupoMuscular] ?? ejercicio.grupoMuscular}
                {usos > 0 && ` · ${usos} ${usos === 1 ? "uso" : "usos"} en rutinas`}
              </p>
              {otros.length > 0 && (
                <form action={action} className="mt-1.5">
                  <input type="hidden" name="alias" value={alias} />
                  {/* Elegir un dueño = quitarle el alias al otro. Con más de dos
                      en disputa se resuelve de a uno, repitiendo la pregunta. */}
                  <input type="hidden" name="ejercicio_id" value={otros[0].id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="radius-control flex items-center gap-1 border border-vip/40 px-2 py-1 text-[9px] font-semibold text-vip disabled:opacity-50"
                  >
                    <Check size={11} /> {pending ? "Guardando…" : `Es de este — quitarlo de ${otros[0].nombre}`}
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      {state.error && <p className="text-micro mt-1.5 text-error">{state.error}</p>}
      {state.ok && <p className="text-micro mt-1.5 text-success">{state.mensaje}</p>}
    </div>
  );
}

function FusionHistorialCard({ fusion }: { fusion: FusionEjercicio }) {
  const [state, action, pending] = useActionState(deshacerFusionEjercicios, ESTADO_INICIAL_DESHACER);
  const fecha = new Date(fusion.fusionadoEn).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });

  return (
    <div className="radius-control flex items-center gap-2 border border-border bg-surface p-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-caption text-text">
          <strong className="text-text">{fusion.duplicadoNombre}</strong> → {fusion.originalNombre}
        </p>
        <p className="text-micro text-text-tertiary">
          {fecha}
          {fusion.usosTrasladados > 0 && ` · ${fusion.usosTrasladados} uso${fusion.usosTrasladados === 1 ? "" : "s"} trasladado${fusion.usosTrasladados === 1 ? "" : "s"}`}
        </p>
        {state.error && <p className="text-micro mt-1 text-error">{state.error}</p>}
        {state.ok && <p className="text-micro mt-1 text-success">{state.mensaje}</p>}
      </div>
      {fusion.deshecho || state.ok ? (
        <span className="shrink-0 text-micro font-semibold text-text-tertiary">Restaurado</span>
      ) : (
        <form
          action={action}
          onSubmit={(evento) => {
            if (!window.confirm(`¿Restaurar "${fusion.duplicadoNombre}"? Vuelve a activarse y recupera sus usos en rutinas.`)) evento.preventDefault();
          }}
        >
          <input type="hidden" name="fusion_id" value={fusion.id} />
          <button type="submit" disabled={pending} className="radius-control flex shrink-0 items-center gap-1 border border-border px-2 py-1 text-[9px] font-semibold text-text-secondary disabled:opacity-50">
            <Undo2 size={11} /> {pending ? "Restaurando…" : "Deshacer"}
          </button>
        </form>
      )}
    </div>
  );
}

/** Ofrece volver a la foto que este ejercicio tenía antes del último
 * reemplazo (ver ejercicio_foto_version_anterior, migración 0094). Solo
 * aparece cuando hay una versión guardada — un reemplazo confirmado y sin
 * arrepentimiento no deja rastro acá. */
function EditorFotoAnterior({ ejercicioId, versionAnteriorEn }: { ejercicioId: string; versionAnteriorEn: string }) {
  const [state, formAction, pending] = useActionState(restaurarFotoAnteriorEjercicio, ESTADO_INICIAL_RESTAURAR_FOTO);
  const fecha = new Date(versionAnteriorEn).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  if (state.ok) {
    return <p className="text-caption flex items-center gap-1.5 rounded-xl border border-success/30 bg-success/5 p-3 text-success"><Check size={14} /> {state.mensaje}</p>;
  }

  return (
    <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="text-caption font-semibold text-text">Hay una foto anterior guardada</p>
      <p className="text-micro text-text-tertiary">Reemplazada el {fecha}. Se puede volver a ella si el cambio fue un error.</p>
      {state.error && <p className="text-micro text-error">{state.error}</p>}
      <form
        action={formAction}
        onSubmit={(evento) => {
          if (!window.confirm("¿Restaurar la foto anterior? La que está puesta ahora se pierde.")) evento.preventDefault();
        }}
      >
        <input type="hidden" name="ejercicio_id" value={ejercicioId} />
        <button type="submit" disabled={pending} className="radius-control flex h-9 w-full items-center justify-center gap-1.5 border border-border text-caption font-semibold text-text disabled:opacity-50">
          <Undo2 size={13} /> {pending ? "Restaurando…" : "Restaurar foto anterior"}
        </button>
      </form>
    </div>
  );
}

function puntajeParecido(nombreRutina: string, ejercicio: Ejercicio): number {
  const origen = normalizar(nombreRutina);
  const candidatos = [ejercicio.nombre, ...ejercicio.aliases].map(normalizar);
  const tokens = new Set(origen.split(" ").filter((token) => token.length > 2));
  return Math.max(...candidatos.map((candidato) => {
    if (candidato === origen) return 1000;
    let puntos = candidato.includes(origen) || origen.includes(candidato) ? 80 : 0;
    for (const token of tokens) if (candidato.includes(token)) puntos += 12;
    return puntos;
  }));
}

/** Corrector manual para los nombres libres que todavía no apuntan a la
 * biblioteca. La búsqueda filtra los 121 ejercicios y, antes de escribir,
 * muestra candidatos por palabras coincidentes para acelerar variantes. */
function VincularNombreRutina({ item, ejercicios }: { item: { nombre: string; cantidad: number }; ejercicios: Ejercicio[] }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Ejercicio | null>(null);
  const [state, formAction, pending] = useActionState(vincularNombreRutinaSinEjercicio, ESTADO_INICIAL_VINCULO);
  const opciones = useMemo(() => {
    const q = normalizar(busqueda);
    if (q) return ejercicios.filter((ejercicio) => normalizar(`${ejercicio.nombre} ${ejercicio.aliases.join(" ")}`).includes(q)).slice(0, 12);
    return [...ejercicios].sort((a, b) => puntajeParecido(item.nombre, b) - puntajeParecido(item.nombre, a) || a.nombre.localeCompare(b.nombre, "es")).slice(0, 8);
  }, [busqueda, ejercicios, item.nombre]);

  return (
    <div className="border-b border-warning/20 py-2 last:border-0">
      <button type="button" onClick={() => setAbierto((valor) => !valor)} className="flex w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1"><span className="text-caption block font-semibold text-text">{item.nombre}</span><span className="text-micro text-text-tertiary">{item.cantidad} {item.cantidad === 1 ? "aparición" : "apariciones"}</span></span>
        <span className="rounded-full bg-warning/15 px-2 py-1 text-[9px] font-bold text-warning">{abierto ? "CERRAR" : "VINCULAR"}</span>
      </button>
      {abierto && (
        <form action={formAction} className="mt-2 space-y-2 rounded-xl border border-border bg-surface p-2.5">
          <input type="hidden" name="nombre_rutina" value={item.nombre} />
          <input type="hidden" name="ejercicio_id" value={seleccionado?.id ?? ""} />
          <Input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar ejercicio base…" className="!py-2 text-caption" />
          <div className="scrollbar-fina max-h-48 space-y-1 overflow-y-auto">
            {opciones.map((ejercicio) => (
              <button key={ejercicio.id} type="button" onClick={() => setSeleccionado(ejercicio)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${seleccionado?.id === ejercicio.id ? "border-vip bg-vip/10" : "border-border bg-surface-2"}`}>
                <span className="min-w-0 flex-1"><span className="text-caption block font-semibold text-text">{ejercicio.nombre}</span>{ejercicio.aliases.length > 0 && <span className="text-micro block truncate text-text-tertiary">{ejercicio.aliases.join(" · ")}</span>}</span>
                {seleccionado?.id === ejercicio.id && <Check size={15} className="shrink-0 text-vip" />}
              </button>
            ))}
            {opciones.length === 0 && <p className="text-caption px-2 py-3 text-text-tertiary">No hay coincidencias. Prueba otra palabra.</p>}
          </div>
          {seleccionado && <p className="text-caption text-text-secondary">Se unirá <strong className="text-text">{item.nombre}</strong> con <strong className="text-vip">{seleccionado.nombre}</strong> y se guardará como alias.</p>}
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          {state.ok && <p className="text-caption text-success">{state.mensaje}</p>}
          <Button type="submit" size="xs" loading={pending} disabled={!seleccionado}>Vincular todas las apariciones</Button>
        </form>
      )}
    </div>
  );
}

/** La miniatura a mostrar: la foto subida desde acá si existe, si no la
 * ilustración estática de siempre (public/ejercicios/<slug>). Mismo criterio
 * que usa la app del alumno (ver SesionEjercicioCard). */
function fotoDe(ej: Ejercicio): string | null {
  if (ej.fotoMiniaturaUrl) return ej.fotoMiniaturaUrl;
  const { src, origen } = resolverIlustracion(ej.ilustracionSlug, null);
  return origen === "ilustracion" ? src : null;
}

/** El reintento con query string es solo para Storage/CDN. Next 16 bloquea
 * query strings en imágenes locales de /public salvo que se abra un patrón
 * explícito; además esas imágenes locales ya usan `must-revalidate` y no
 * necesitan cache-buster. */
function fotoConReintento(foto: string | null, buster?: number): string | null {
  if (!foto || !buster || foto.startsWith("/")) return foto;
  return `${foto}${foto.includes("?") ? "&" : "?"}r=${buster}`;
}

export function GaleriaEjercicios({
  ejercicios,
  reportes = [],
  usosPorEjercicio = {},
  nombresRutinaSinVincular = [],
  historialFusiones = [],
  versionesAnterioresFotos = {},
  ejerciciosIncompletos = [],
  cambiosRecientesMultimedia = [],
  itemsIngestaHuerfanos = [],
}: {
  ejercicios: Ejercicio[];
  reportes?: ReporteFotoPendiente[];
  usosPorEjercicio?: Record<string, UsoEjercicioInventario>;
  nombresRutinaSinVincular?: { nombre: string; cantidad: number }[];
  historialFusiones?: FusionEjercicio[];
  versionesAnterioresFotos?: Record<string, string>;
  /** Cola "Completar ficha" (instructivo §7.3) — creados desde el alta
   * rápida sin grupo/categoría/equipo. A propósito no están en `ejercicios`:
   * ver el comentario de `EjercicioIncompleto`. */
  ejerciciosIncompletos?: EjercicioIncompleto[];
  /** Portadas/videos reemplazados en los últimos 7 días (Fase 3 + Calidad
   * ampliada, Fase 4, §15). */
  cambiosRecientesMultimedia?: CambioMultimediaReciente[];
  /** Archivos de carga masiva que quedaron a medias hace más de un día
   * (Fase 2 + Calidad ampliada, Fase 4, §15). */
  itemsIngestaHuerfanos?: ItemIngestaHuerfano[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Ejercicio | null>(null);
  const [probandoVideo, setProbandoVideo] = useState<Ejercicio | null>(null);
  const [creando, setCreando] = useState<{ nombre: string; archivo?: File; tipo?: "imagen" | "video" } | null>(null);
  const [modoGimnasioAbierto, setModoGimnasioAbierto] = useState(false);
  // El portal de la lista imprimible (ver más abajo) solo puede montarse una
  // vez que el árbol ya hidrató: portalear a document.body durante el mismo
  // render que hidrata rompe React, porque el HTML que mandó el servidor no
  // tiene ese nodo ahí — se mezcla mal con los <script> que Next inyecta al
  // final del body y tira "Hydration failed".
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    // react-hooks/set-state-in-effect: falso positivo, mismo caso que ya
    // documentado en este archivo — detectar "ya hidrató" no tiene otra
    // fuente que un efecto, no hay prop/estado del que derivarlo en render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMontado(true);
  }, []);
  // Justo después de subir una foto nueva, a veces el CDN de Storage todavía
  // no terminó de propagarla y la primera carga falla (el archivo ya está
  // subido de verdad, es solo una demora de segundos). Antes, ese primer
  // fallo quedaba marcado para siempre y solo se arreglaba recargando la
  // página a mano — confuso justo después de ver "Foto actualizada". Ahora
  // se reintenta una vez, con una pequeña demora, antes de darse por
  // vencido y caer al placeholder neutro.
  //
  // El "cache-buster" del reintento tiene que ser realmente único
  // (Date.now(), no un contador chico tipo 1, 2, 3...): Safari puede guardar
  // en caché esa primera respuesta fallida, y una recarga de página nueva
  // vuelve a pedir exactamente la misma URL sin el "?r=" (el estado del
  // reintento se resetea) — con un contador chico, el reintento de ESA
  // sesión nueva puede terminar pidiendo un "?r=1" que ya se había intentado
  // y fallado en una sesión anterior, chocando con esa misma caché vieja.
  // Un timestamp nunca se repite entre sesiones.
  // Antes todo (34 reportes, duplicados, 124 ejercicios) vivía apilado en una
  // sola pantalla de más de 40.000px de alto en celular — había que bajar
  // muchísimo para llegar a la biblioteca de fotos. Se reparte en 4 pestañas
  // (sección 8.1 del instructivo de reorganización): Pendientes abre primero
  // si hay trabajo, si no abre Biblioteca directamente.
  const [pestana, setPestana] = useState<"pendientes" | "mesa" | "biblioteca" | "carga" | "calidad" | "referencia">(
    reportes.length > 0 ? "pendientes" : "biblioteca"
  );
  // Las tarjetas de resumen de la página enlazan con #anclas a secciones
  // puntuales (ver AdminStatCard en page.tsx) — ahora esas secciones viven
  // adentro de una pestaña, así que el hash decide con cuál abrir. En un
  // efecto y no en el useState inicial: leer `window.location.hash` durante
  // el render rompe la pureza (el servidor no tiene hash) y desajusta la
  // hidratación.
  // react-hooks/set-state-in-effect: falso positivo, mismo caso que ya
  // documentado en SesionEjercicioCard.tsx — lee estado externo (el hash de
  // la URL) que no existe en el servidor, justo el uso que la propia
  // documentación de React recomienda resolver en un efecto.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.location.hash === "#inventario-ejercicios") setPestana("referencia");
    else if (window.location.hash === "#reportes-ejercicios") setPestana("pendientes");
    else if (window.location.hash === "#biblioteca-ejercicios") setPestana("biblioteca");
  }, []);
  const [erroresFoto, setErroresFoto] = useState<ReadonlySet<string>>(new Set());
  // Solo se lee dentro de su propio updater funcional (más abajo) — no hace
  // falta la variable de lectura acá afuera.
  const [, setYaReintentado] = useState<ReadonlySet<string>>(new Set());
  const [cacheBuster, setCacheBuster] = useState<Readonly<Record<string, number>>>({});

  function onErrorFoto(id: string) {
    setYaReintentado((prev) => {
      if (prev.has(id)) {
        setErroresFoto((s) => new Set(s).add(id));
        return prev;
      }
      setTimeout(() => setCacheBuster((c) => ({ ...c, [id]: Date.now() })), 1500);
      return new Set(prev).add(id);
    });
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ejercicios;
    return ejercicios.filter((e) => e.nombre.toLowerCase().includes(q));
  }, [ejercicios, busqueda]);

  const sinFoto = ejercicios.filter((e) => !e.fotoMiniaturaUrl && !e.fotoCompletaUrl).length;
  const ejerciciosAlfabeticos = useMemo(
    () => [...ejercicios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })),
    [ejercicios],
  );
  const aliasEnDisputa = useMemo(() => detectarAliasEnDisputa(ejercicios), [ejercicios]);
  // Un alias compartido no es un duplicado, y ofrecer "Combinar" ahí es
  // directamente peligroso: cuádriceps y tríceps comparten el alias "extensión
  // unilateral" y son ejercicios distintos. Esos pares salen de la lista de
  // duplicados y se resuelven arriba, quitándole la palabra a uno de los dos.
  const paresEnDisputa = useMemo(
    () => new Set(aliasEnDisputa.map((d) => d.ejercicios.map((e) => e.id).sort().join(":"))),
    [aliasEnDisputa],
  );
  const gruposDuplicados = useMemo(() => {
    const porFirma = new Map<string, Map<string, Ejercicio>>();
    for (const ejercicio of ejercicios) {
      for (const variante of [ejercicio.nombre, ...ejercicio.aliases]) {
        const firma = firmaPosibleDuplicado(variante);
        if (!firma) continue;
        const grupo = porFirma.get(firma) ?? new Map<string, Ejercicio>();
        grupo.set(ejercicio.id, ejercicio);
        porFirma.set(firma, grupo);
      }
    }
    const vistos = new Set<string>();
    return Array.from(porFirma.values())
      .map((grupo) => Array.from(grupo.values()))
      .filter((grupo) => grupo.length > 1)
      .map((grupo) => grupo.sort((a, b) => {
        const fotoA = Number(Boolean(a.fotoMiniaturaUrl || a.fotoCompletaUrl));
        const fotoB = Number(Boolean(b.fotoMiniaturaUrl || b.fotoCompletaUrl));
        return fotoB - fotoA || Number(Boolean(b.ilustracionSlug)) - Number(Boolean(a.ilustracionSlug)) || (usosPorEjercicio[b.id]?.cantidad ?? 0) - (usosPorEjercicio[a.id]?.cantidad ?? 0);
      }))
      .filter((grupo) => {
        const clave = grupo.map((item) => item.id).sort().join(":");
        if (vistos.has(clave) || paresEnDisputa.has(clave)) return false;
        vistos.add(clave);
        return true;
      })
      .sort((a, b) => a[0].nombre.localeCompare(b[0].nombre, "es", { sensitivity: "base" }));
  }, [ejercicios, usosPorEjercicio, paresEnDisputa]);
  // Chequeo determinista (instructivo 8.5, "foto que ya está asignada a otro
  // ejercicio"): dos ejercicios distintos apuntando exactamente a la misma
  // URL de Storage casi siempre es un error de carga, no una coincidencia.
  const fotosCompartidas = useMemo(() => {
    const porUrl = new Map<string, Ejercicio[]>();
    for (const ejercicio of ejercicios) {
      for (const url of [ejercicio.fotoMiniaturaUrl, ejercicio.fotoCompletaUrl]) {
        if (!url) continue;
        const lista = porUrl.get(url) ?? [];
        if (!lista.some((item) => item.id === ejercicio.id)) lista.push(ejercicio);
        porUrl.set(url, lista);
      }
    }
    const vistos = new Set<string>();
    const grupos: { url: string; ejercicios: Ejercicio[] }[] = [];
    for (const [url, lista] of porUrl) {
      if (lista.length < 2) continue;
      const clave = lista.map((item) => item.id).sort().join(":");
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      grupos.push({ url, ejercicios: lista });
    }
    return grupos.sort((a, b) => a.ejercicios[0].nombre.localeCompare(b.ejercicios[0].nombre, "es", { sensitivity: "base" }));
  }, [ejercicios]);
  // "video con error" (instructivo 8.5): estado persistido en la fila, no
  // hace falta ninguna comprobación nueva del lado del cliente.
  const videosConError = useMemo(
    () => ejercicios.filter((e) => e.videoCloudflareEstado === "error").sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })),
    [ejercicios],
  );
  // "duplicado exacto" (instructivo 8.5): a diferencia de fotosCompartidas
  // (misma URL), esto agrupa por CONTENIDO — detecta cuando la misma foto se
  // subió por separado a dos ejercicios distintos, cada una con su propio
  // archivo y URL de Storage. Ver foto_hash, migración 0095 — nulo en fotos
  // subidas antes de esa migración, así que no cubre la biblioteca vieja.
  const fotosDuplicadasPorHash = useMemo(() => {
    const porHash = new Map<string, Ejercicio[]>();
    for (const ejercicio of ejercicios) {
      if (!ejercicio.fotoHash) continue;
      const lista = porHash.get(ejercicio.fotoHash) ?? [];
      lista.push(ejercicio);
      porHash.set(ejercicio.fotoHash, lista);
    }
    return Array.from(porHash.values())
      .filter((grupo) => grupo.length > 1)
      .sort((a, b) => a[0].nombre.localeCompare(b[0].nombre, "es", { sensitivity: "base" }));
  }, [ejercicios]);
  const reportesAgrupados = useMemo(() => {
    const grupos = new Map<string, {
      ids: string[];
      ejercicioId: string | null;
      nombre: string;
      nombresReportados: Set<string>;
      alumnos: Set<string>;
      fotoUrl: string | null;
    }>();
    for (const reporte of reportes) {
      // Con ejercicio_id, todos apuntan al mismo problema global aunque la
      // rutina lo haya escrito con otra variante. Sin id, se agrupa por el
      // nombre normalizado para evitar duplicados por mayúsculas o tildes.
      const clave = reporte.ejercicioId
        ? `id:${reporte.ejercicioId}`
        : `nombre:${normalizar(reporte.nombreEjercicio)}`;
      const ejercicio = reporte.ejercicioId ? ejercicios.find((item) => item.id === reporte.ejercicioId) : null;
      const grupo = grupos.get(clave) ?? {
        ids: [],
        ejercicioId: reporte.ejercicioId,
        nombre: ejercicio?.nombre ?? reporte.nombreEjercicio,
        nombresReportados: new Set<string>(),
        alumnos: new Set<string>(),
        fotoUrl: null,
      };
      grupo.ids.push(reporte.id);
      grupo.nombresReportados.add(reporte.nombreEjercicio);
      grupo.alumnos.add(reporte.alumnoNombre);
      grupo.fotoUrl ??= reporte.fotoUrl;
      grupos.set(clave, grupo);
    }
    return Array.from(grupos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [reportes, ejercicios]);

  const pendientesCantidad = reportesAgrupados.length;
  // Los nombres de rutina sin vincular quedan fuera de esta cuenta a
  // propósito: son un backlog de fondo (decenas o cientos, normal en
  // cualquier momento), no defectos activos. Meterlos acá volvería la
  // insignia de la pestaña una alarma falsa ("173 problemas") en vez de una
  // señal real de calidad.
  // "ejercicio sin video" (instructivo §15) — a diferencia de "sin foto"
  // (que ya tiene su propio contador arriba de siempre), este no existía
  // como señal de calidad hasta Fase 4.
  const sinVideo = useMemo(() => ejercicios.filter((e) => !e.videoCloudflareUid), [ejercicios]);
  // "ejercicio con múltiples reportes" (instructivo §15) — ya calculado en
  // reportesAgrupados, solo hace falta filtrar los que tienen más de un
  // alumno reclamando lo mismo.
  const reportesMultiples = useMemo(() => reportesAgrupados.filter((g) => g.ids.length > 1), [reportesAgrupados]);

  const calidadCantidad =
    gruposDuplicados.length + aliasEnDisputa.length + fotosCompartidas.length + videosConError.length +
    erroresFoto.size + fotosDuplicadasPorHash.length + ejerciciosIncompletos.length +
    cambiosRecientesMultimedia.length + itemsIngestaHuerfanos.length + reportesMultiples.length;

  const reportesPorEjercicio = useMemo(() => {
    const conteo: Record<string, number> = {};
    for (const reporte of reportes) {
      if (reporte.ejercicioId) conteo[reporte.ejercicioId] = (conteo[reporte.ejercicioId] ?? 0) + 1;
    }
    return conteo;
  }, [reportes]);
  const faltanPorCompletar = useMemo(
    () => ejercicios.filter((e) => !fotoDe(e) || (reportesPorEjercicio[e.id] ?? 0) > 0).length,
    [ejercicios, reportesPorEjercicio],
  );
  // Nombres que no están en la biblioteca ni se parecen a nada que exista: son
  // altas pendientes, no fotos pendientes. Vienen de dos lados — un alumno que
  // pidió la foto, o una rutina recién importada que trajo un ejercicio nuevo.
  // En los dos casos la acción es la misma: darlo de alta.
  const nombresReportadosSinEjercicio = useMemo(() => {
    const nombres = new Set<string>();
    for (const grupo of reportesAgrupados) {
      if (grupo.ejercicioId) continue;
      if (emparejarEjercicio(grupo.nombre, ejercicios)) continue;
      nombres.add(grupo.nombre);
    }
    // Los de rutinas se ordenan por peso: el que aparece en más días de
    // entrenamiento es el que más urge dar de alta.
    const deRutinas = nombresRutinaSinVincular
      .filter((item) => !emparejarEjercicio(item.nombre, ejercicios))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 30);
    for (const item of deRutinas) nombres.add(item.nombre);
    return [...nombres];
  }, [reportesAgrupados, ejercicios, nombresRutinaSinVincular]);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Secciones de la galería" className="flex gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: "pendientes" as const, etiqueta: "Pendientes", Icon: CircleAlert, cantidad: pendientesCantidad },
            { id: "mesa" as const, etiqueta: "Mesa", Icon: Wrench, cantidad: faltanPorCompletar },
            { id: "biblioteca" as const, etiqueta: "Biblioteca", Icon: LibraryBig, cantidad: ejercicios.length },
            { id: "carga" as const, etiqueta: "Carga masiva", Icon: UploadCloud, cantidad: null },
            { id: "calidad" as const, etiqueta: "Calidad", Icon: ShieldCheck, cantidad: calidadCantidad },
            { id: "referencia" as const, etiqueta: "Referencia", Icon: ClipboardCheck, cantidad: null },
          ]
        ).map(({ id, etiqueta, Icon, cantidad }) => {
          const activo = pestana === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => setPestana(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                activo ? "border-vip bg-vip text-black" : "border-border bg-surface-2 text-text-secondary hover:border-vip/40"
              }`}
            >
              <Icon size={14} />
              {etiqueta}
              {cantidad !== null && cantidad > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activo ? "bg-black/15" : "bg-surface"}`}>{cantidad}</span>
              )}
            </button>
          );
        })}
      </div>

      {pestana === "pendientes" && reportes.length === 0 && (
        <Card padding="p-4" className="text-center">
          <p className="text-caption font-semibold text-text">Sin pendientes ahora mismo</p>
          <p className="text-micro mt-1 text-text-tertiary">Ningún reporte de foto por revisar.</p>
        </Card>
      )}

      {pestana === "pendientes" && reportes.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/35 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error">
              <TriangleAlert size={17} />
            </span>
            <div>
              <p className="text-caption font-bold text-text">Solicitudes de fotos</p>
              <p className="text-micro text-text-tertiary">Resolvé con foto o con un clip — se actualiza para todos.</p>
            </div>
          </div>
          {reportesAgrupados.map((grupo) => {
            // El id guardado en el reporte puede apuntar a un ejercicio que ya
            // no está activo (se fusionó con otro después de que llegara el
            // reporte). Si el id directo no aparece en la biblioteca, se busca
            // por nombre/alias antes de darlo por inexistente — si no, el
            // botón terminaría ofreciendo crear un ejercicio nuevo con el
            // mismo nombre en vez de abrir el que ya tiene la foto buena.
            const ejercicio =
              ejercicios.find((item) => item.id === grupo.ejercicioId) ??
              emparejarEjercicio(grupo.nombre, ejercicios)?.ejercicio ??
              null;
            const fotoActual = ejercicio ? fotoDe(ejercicio) : null;
            const alumnos = Array.from(grupo.alumnos).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
            const nombresReportados = Array.from(grupo.nombresReportados);
            return (
              <Card key={grupo.ejercicioId ?? `nombre:${normalizar(grupo.nombre)}`} padding="p-2.5" className="border-error/25">
                <div className="flex items-center gap-2.5">
                  <div className="flex shrink-0 gap-1">
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                      {grupo.fotoUrl ? (
                        <Image src={grupo.fotoUrl} alt="Foto reportada" fill sizes="56px" className="object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-text-tertiary"><ImageIcon size={18} /></div>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide text-white">Reportada</span>
                    </div>
                    {ejercicio && (
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                        {fotoActual ? (
                          <Image src={fotoActual} alt="Foto actual en la biblioteca" fill sizes="56px" className="object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-text-tertiary"><ImageIcon size={18} /></div>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center text-[7px] font-bold uppercase tracking-wide text-white">Ahora</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-caption font-bold text-text">{grupo.nombre}</p>
                      <span className="rounded-full bg-error/15 px-2 py-0.5 text-[9px] font-bold text-error">
                        {grupo.ids.length} {grupo.ids.length === 1 ? "REPORTE" : "REPORTES"}
                      </span>
                    </div>
                    <p className={`text-micro font-semibold ${grupo.fotoUrl ? "text-error" : "text-vip"}`}>
                      {grupo.fotoUrl ? "La foto no corresponde" : "Falta la foto"}
                    </p>
                    <p className="text-micro text-text-tertiary">
                      Reportaron: {alumnos.join(", ")}
                    </p>
                    {nombresReportados.some((nombre) => nombre !== grupo.nombre) && (
                      <p className="text-micro mt-0.5 text-text-tertiary">En rutinas figura como: {nombresReportados.join(" · ")}</p>
                    )}
                    {ejercicio && ejercicio.nombre !== grupo.nombre && (
                      <p className="text-micro mt-0.5 font-semibold text-success">Ya está fusionado en: {ejercicio.nombre} — comparado con &quot;Ahora&quot; arriba, ¿es la foto correcta?</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => ejercicio ? setEditando(ejercicio) : setCreando({ nombre: grupo.nombre })}
                    className="btn-accion radius-control h-9 text-caption font-bold"
                  >
                    {grupo.fotoUrl ? "Corregir ahora" : "Resolver con foto o video"}
                  </button>
                  <form action={resolverReporteFoto}>
                    {grupo.ids.map((id) => <input key={id} type="hidden" name="reporte_id" value={id} />)}
                    <button type="submit" className="radius-control h-9 w-full border border-border text-caption font-semibold text-text-secondary">
                      Resolver todos
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {pestana === "pendientes" && sinFoto > 0 && (
        <Card padding="p-2.5" className="flex items-center gap-2">
          <ImageIcon size={16} className="shrink-0 text-text-tertiary" />
          <p className="text-caption text-text-secondary">
            {sinFoto} ejercicio{sinFoto === 1 ? "" : "s"} todavía sin foto propia.
          </p>
        </Card>
      )}

      {pestana === "calidad" && calidadCantidad === 0 && nombresRutinaSinVincular.length === 0 && sinVideo.length === 0 && (
        <Card padding="p-4" className="text-center">
          <p className="text-caption font-semibold text-text">Sin problemas de calidad detectados</p>
          <p className="text-micro mt-1 text-text-tertiary">Ni duplicados, ni alias en disputa, ni medios rotos, ni nombres sin vincular.</p>
        </Card>
      )}

      {pestana === "calidad" && ejerciciosIncompletos.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-vip/40 bg-vip/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-vip/15 text-vip">
              <Wrench size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Completar ficha</span>
              <span className="text-micro block text-text-tertiary">
                Creados desde el alta rápida sin clasificar — no entran a Armar rutina hasta completarlos
              </span>
            </span>
            <span className="rounded-full bg-vip/15 px-2 py-1 text-micro font-bold text-vip">{ejerciciosIncompletos.length}</span>
          </div>
          <div className="space-y-2">
            {ejerciciosIncompletos.map((incompleto) => (
              <div key={incompleto.id} className="radius-control space-y-2 border border-border bg-surface p-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                    {incompleto.fotoMiniaturaUrl && (
                      <Image src={incompleto.fotoMiniaturaUrl} alt="" fill sizes="44px" className="object-cover" />
                    )}
                  </div>
                  <p className="text-caption min-w-0 flex-1 truncate font-semibold text-text">{incompleto.nombre}</p>
                </div>
                <EditorClasificacion ejercicio={incompleto} />
              </div>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && reportesMultiples.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/40 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error"><TriangleAlert size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Ejercicios con varios reclamos</span>
              <span className="text-micro block text-text-tertiary">Más de un alumno pidió lo mismo — priorizalos primero</span>
            </span>
            <span className="rounded-full bg-error/15 px-2 py-1 text-micro font-bold text-error">{reportesMultiples.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {reportesMultiples.map((grupo) => (
              <span key={grupo.ejercicioId ?? grupo.nombre} className="radius-control border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text">
                {grupo.nombre} · {grupo.ids.length}
              </span>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && cambiosRecientesMultimedia.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-border bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-text-secondary"><Undo2 size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Cambios recientes de portada/video</span>
              <span className="text-micro block text-text-tertiary">Últimos 7 días — restaurable desde la ficha de cada ejercicio</span>
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-micro font-bold text-text-secondary">{cambiosRecientesMultimedia.length}</span>
          </div>
          <div className="space-y-1">
            {cambiosRecientesMultimedia.map((cambio) => (
              <button
                key={cambio.id}
                type="button"
                onClick={() => {
                  const encontrado = ejercicios.find((e) => e.id === cambio.ejercicioId);
                  if (encontrado) setEditando(encontrado);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-surface-2"
              >
                <span className="text-micro truncate text-text">
                  {cambio.tipo === "video" ? <Film size={11} className="mr-1 inline" /> : <ImageIcon size={11} className="mr-1 inline" />}
                  {cambio.ejercicioNombre}
                </span>
                <span className="text-micro shrink-0 text-text-tertiary">{new Date(cambio.archivadoEn).toLocaleDateString("es-AR")}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && itemsIngestaHuerfanos.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-warning/45 bg-warning/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-warning/15 text-warning"><UploadCloud size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Cargas sin terminar</span>
              <span className="text-micro block text-text-tertiary">Quedaron a medias hace más de un día — revisalas desde Carga masiva</span>
            </span>
            <span className="rounded-full bg-warning/15 px-2 py-1 text-micro font-bold text-warning">{itemsIngestaHuerfanos.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {itemsIngestaHuerfanos.map((item) => (
              <span key={item.id} className="radius-control border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary">
                {item.nombreArchivo}
              </span>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && sinVideo.length > 0 && (
        <details className="rounded-[20px] border border-border bg-surface p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-text-secondary"><Film size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Ejercicios sin video</span>
              <span className="text-micro block text-text-tertiary">Backlog, no un error — priorizá por uso en rutinas cuando grabes</span>
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-micro font-bold text-text-secondary">{sinVideo.length}</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sinVideo.slice(0, 60).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditando(e)}
                className="radius-control border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium text-text-secondary"
              >
                {e.nombre}
              </button>
            ))}
            {sinVideo.length > 60 && <span className="text-micro text-text-tertiary">y {sinVideo.length - 60} más…</span>}
          </div>
        </details>
      )}

      {pestana === "calidad" && aliasEnDisputa.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-warning/45 bg-warning/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-warning/15 text-warning">
              <TriangleAlert size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Nombres en disputa</span>
              <span className="text-micro block text-text-tertiary">Un mismo alias en dos ejercicios distintos</span>
            </span>
            <span className="rounded-full bg-warning/15 px-2 py-1 text-micro font-bold text-warning">{aliasEnDisputa.length}</span>
          </div>
          <p className="text-micro text-text-tertiary">
            Estos <strong className="text-text">no son duplicados</strong>: son dos ejercicios reales que comparten una palabra.
            Elige de quién es y el otro la suelta — no se combina ni se borra nada.
          </p>
          <div className="space-y-2">
            {aliasEnDisputa.map((disputa) => (
              <AliasEnDisputaCard
                key={`${disputa.alias}:${disputa.ejercicios.map((e) => e.id).join(":")}`}
                alias={disputa.alias}
                ejercicios={disputa.ejercicios}
                usosPorEjercicio={usosPorEjercicio}
              />
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && fotosCompartidas.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/40 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error"><Copy size={16} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Foto compartida entre ejercicios</span><span className="text-micro block text-text-tertiary">La misma imagen quedó asignada a más de uno</span></span>
            <span className="rounded-full bg-error/15 px-2 py-1 text-micro font-bold text-error">{fotosCompartidas.length}</span>
          </div>
          <p className="text-micro text-text-tertiary">Casi siempre es un error de carga: revisa cuál de los dos es el dueño real y vuelve a subir la foto del otro.</p>
          <div className="space-y-2">
            {fotosCompartidas.map((grupo) => (
              <div key={grupo.url} className="radius-control flex items-center gap-2.5 border border-border bg-surface p-2.5">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  <Image src={grupo.url} alt="Foto compartida" fill sizes="48px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  {grupo.ejercicios.map((ejercicio) => (
                    <button key={ejercicio.id} type="button" onClick={() => setEditando(ejercicio)} className="text-caption block truncate font-semibold text-text underline decoration-dotted underline-offset-2">
                      {ejercicio.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && fotosDuplicadasPorHash.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/40 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error"><Copy size={16} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Duplicado exacto por contenido</span><span className="text-micro block text-text-tertiary">La misma foto se subió a más de un ejercicio</span></span>
            <span className="rounded-full bg-error/15 px-2 py-1 text-micro font-bold text-error">{fotosDuplicadasPorHash.length}</span>
          </div>
          <p className="text-micro text-text-tertiary">Archivos distintos, mismo contenido — probablemente la misma foto del celular se subió dos veces por error.</p>
          <div className="space-y-2">
            {fotosDuplicadasPorHash.map((grupo) => (
              <div key={grupo.map((item) => item.id).join(":")} className="radius-control flex items-center gap-2.5 border border-border bg-surface p-2.5">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {grupo[0].fotoMiniaturaUrl && <Image src={grupo[0].fotoMiniaturaUrl} alt="Foto duplicada" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  {grupo.map((ejercicio) => (
                    <button key={ejercicio.id} type="button" onClick={() => setEditando(ejercicio)} className="text-caption block truncate font-semibold text-text underline decoration-dotted underline-offset-2">
                      {ejercicio.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && videosConError.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/40 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error"><VideoOff size={16} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Videos con error</span><span className="text-micro block text-text-tertiary">Cloudflare no pudo procesar el video</span></span>
            <span className="rounded-full bg-error/15 px-2 py-1 text-micro font-bold text-error">{videosConError.length}</span>
          </div>
          <div className="space-y-1.5">
            {videosConError.map((ejercicio) => (
              <button key={ejercicio.id} type="button" onClick={() => setEditando(ejercicio)} className="radius-control flex w-full items-center justify-between border border-border bg-surface px-2.5 py-2 text-left">
                <span className="text-caption font-semibold text-text">{ejercicio.nombre}</span>
                <span className="text-micro font-semibold text-error">Volver a subir</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && erroresFoto.size > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/40 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error"><Link2Off size={16} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">URLs de foto rotas</span><span className="text-micro block text-text-tertiary">Detectadas en esta sesión al navegar la galería — puede haber más sin visitar</span></span>
            <span className="rounded-full bg-error/15 px-2 py-1 text-micro font-bold text-error">{erroresFoto.size}</span>
          </div>
          <div className="space-y-1.5">
            {ejercicios.filter((e) => erroresFoto.has(e.id)).map((ejercicio) => (
              <button key={ejercicio.id} type="button" onClick={() => setEditando(ejercicio)} className="radius-control flex w-full items-center justify-between border border-border bg-surface px-2.5 py-2 text-left">
                <span className="text-caption font-semibold text-text">{ejercicio.nombre}</span>
                <span className="text-micro font-semibold text-error">Volver a subir</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pestana === "calidad" && nombresRutinaSinVincular.length > 0 && (
        <details className="rounded-[20px] border border-warning/35 bg-warning/5 p-3" open>
          <summary className="cursor-pointer text-caption font-semibold text-warning">{nombresRutinaSinVincular.length} nombres de rutinas todavía sin enlazar a la galería</summary>
          <p className="text-micro mt-1 text-text-tertiary">Abre un nombre, busca el ejercicio base y vincúlalo. Se corrigen todas sus apariciones y queda como alias para el futuro.</p>
          <div className="mt-2">{nombresRutinaSinVincular.map((item) => <VincularNombreRutina key={item.nombre} item={item} ejercicios={ejerciciosAlfabeticos} />)}</div>
        </details>
      )}

      {pestana === "calidad" && gruposDuplicados.length > 0 && (
        <details className="rounded-[20px] border border-warning/40 bg-warning/5 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-warning/15 text-warning"><Merge size={16} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Posibles ejercicios duplicados</span><span className="text-micro block text-text-tertiary">Se prioriza como original el que tenga foto propia</span></span>
            <span className="rounded-full bg-warning/15 px-2 py-1 text-micro font-bold text-warning">{gruposDuplicados.length}</span>
          </summary>
          <p className="text-micro mt-2 text-text-tertiary">Solo son sugerencias: nombres parecidos pueden ser ejercicios distintos. Revisa cada grupo antes de combinar; nunca se borra automáticamente.</p>
          <div className="mt-2 space-y-2">
            {gruposDuplicados.map((grupo) => {
              const [original, ...variantes] = grupo;
              const conFoto = Boolean(original.fotoMiniaturaUrl || original.fotoCompletaUrl);
              return (
                <div key={grupo.map((item) => item.id).join(":")} className="radius-control border border-border bg-surface p-2.5">
                  <p className="text-caption font-bold text-text">Original sugerido: <span className="text-vip">{original.nombre}</span></p>
                  <p className="text-micro text-text-tertiary">{conFoto ? "Tiene foto propia" : original.ilustracionSlug ? "Tiene ilustración original" : "Sin foto propia"}</p>
                  {variantes.map((duplicado) => {
                    const usos = usosPorEjercicio[duplicado.id]?.cantidad ?? 0;
                    return (
                      <div key={duplicado.id} className="mt-2 border-t border-border pt-2">
                        <p className="text-caption text-text-secondary">Posible variante: <strong className="text-text">{duplicado.nombre}</strong></p>
                        {usos > 0 && (
                          <p className="text-micro mt-0.5 text-warning">
                            Afecta {usos} {usos === 1 ? "uso" : "usos"} en rutinas — se trasladan al original.
                          </p>
                        )}
                        <CombinarDuplicadoForm original={original} duplicado={duplicado} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {pestana === "calidad" && historialFusiones.length > 0 && (
        <details className="rounded-[20px] border border-border bg-surface p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-text-secondary"><Undo2 size={16} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Historial de fusiones</span><span className="text-micro block text-text-tertiary">Últimos 30 días · se puede restaurar</span></span>
          </summary>
          <div className="mt-2 space-y-2">
            {historialFusiones.map((fusion) => (
              <FusionHistorialCard key={fusion.id} fusion={fusion} />
            ))}
          </div>
        </details>
      )}

      {pestana === "mesa" && (
        <MesaDeTrabajo
          ejercicios={ejercicios}
          usosPorEjercicio={usosPorEjercicio}
          reportesPorEjercicio={reportesPorEjercicio}
          nombresRutinaSinVincular={nombresRutinaSinVincular}
          nombresReportadosSinEjercicio={nombresReportadosSinEjercicio}
        />
      )}

      {pestana === "carga" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setModoGimnasioAbierto(true)}
            className="radius-control flex h-11 w-full items-center justify-center gap-2 border border-vip/40 text-secondary font-semibold text-vip"
          >
            <Dumbbell size={16} /> Modo gimnasio — sesión de grabación
          </button>
          <CargaMasivaFotos
            ejercicios={ejercicios}
            onCrearEjercicio={(nombre, archivo, tipo) => setCreando({ nombre, archivo, tipo })}
          />
        </div>
      )}

      {modoGimnasioAbierto && (
        <ModoGimnasio
          ejercicios={ejercicios}
          reportesPorEjercicio={reportesPorEjercicio}
          onCerrar={() => setModoGimnasioAbierto(false)}
          onIrACargaMasiva={() => {
            setModoGimnasioAbierto(false);
            setPestana("carga");
          }}
        />
      )}

      {pestana === "referencia" && (
        <details id="inventario-ejercicios" className="scroll-mt-28 rounded-[20px] border border-border bg-surface p-3" open>
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-vip/15 text-vip"><ListChecks size={17} /></span>
            <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Lista completa de ejercicios</span><span className="text-micro block text-text-tertiary">Alfabética · foto real · presencia en rutinas</span></span>
            <span className="rounded-full bg-surface-2 px-2 py-1 text-micro font-bold text-text-secondary">{ejercicios.length}</span>
          </summary>
          <button type="button" onClick={() => window.print()} className="radius-control mt-3 flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-[10px] font-semibold text-text-secondary">
            <Printer size={13} /> Imprimir / guardar PDF
          </button>
          <div className="scrollbar-fina mt-3 max-h-[560px] overflow-y-auto rounded-xl border border-border">
            {ejerciciosAlfabeticos.map((ejercicio) => {
              const conFotoPropia = Boolean(ejercicio.fotoMiniaturaUrl || ejercicio.fotoCompletaUrl);
              const uso = usosPorEjercicio[ejercicio.id];
              return (
                <button key={ejercicio.id} type="button" onClick={() => setEditando(ejercicio)} className="flex w-full items-start gap-2 border-b border-border/70 px-3 py-2.5 text-left last:border-0 hover:bg-surface-2">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${conFotoPropia ? "bg-success" : "bg-error"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="text-caption block font-semibold text-text">{ejercicio.nombre}</span>
                    <span className="text-micro block text-text-tertiary">
                      {uso?.cantidad
                        ? `En ${uso.cantidad} entrada${uso.cantidad === 1 ? "" : "s"} de rutina${uso.nombres.length ? ` · nombres: ${uso.nombres.map((item) => item.nombre === ejercicio.nombre ? item.nombre : `${item.nombre} (${item.cantidad})`).join(", ")}` : ""}`
                        : "No aparece vinculada en ninguna rutina"}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${conFotoPropia ? "bg-success/12 text-success" : "bg-error/12 text-error"}`}>{conFotoPropia ? "CON FOTO" : "SIN FOTO"}</span>
                  <span className={`hidden shrink-0 rounded-full px-2 py-1 text-[9px] font-bold sm:block ${uso?.cantidad ? "bg-vip/12 text-vip" : "bg-surface-2 text-text-tertiary"}`}>{uso?.cantidad ? "EN RUTINAS" : "SIN USO"}</span>
                </button>
              );
            })}
          </div>
          <p className="text-micro mt-2 text-text-tertiary">Toca cualquier nombre para abrir su foto y sus datos. Los nombres de rutinas sin vincular ahora viven en la pestaña Calidad.</p>
        </details>
      )}

      {/* Portal directo al <body>: el layout del panel admin envuelve todo en
          un contenedor `fixed inset-0 overflow-hidden` del tamaño de la
          pantalla (ver admin/layout.tsx). Si esta sección quedara anidada
          ahí adentro, `position: fixed` de ese contenedor se convierte en su
          bloque de contención y `overflow: hidden` recorta todo lo que no
          entre en una pantalla de teléfono — el PDF salía en blanco porque
          la lista completa nunca llegaba a dibujarse. Como hijo directo de
          body, en cambio, queda fuera de ese recorte. */}
      {montado && createPortal(
        <section id="inventario-ejercicios-imprimible" className="hidden">
          <h1>Biblioteca oficial de ejercicios VIP Fitness</h1>
          <p>{ejercicios.length} ejercicios disponibles · nombres exactos para solicitar rutinas</p>
          {Object.entries(ETIQUETAS_GRUPO).map(([grupo, etiqueta]) => {
            const lista = ejerciciosAlfabeticos.filter((ejercicio) => ejercicio.grupoMuscular === grupo);
            if (lista.length === 0) return null;
            return (
              <div key={grupo}>
                <h2>{etiqueta}</h2>
                <ol>
                  {lista.map((ejercicio) => {
                    const foto = fotoDe(ejercicio);
                    return (
                      <li key={ejercicio.id}>
                        {foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={foto} alt="" />
                        ) : (
                          <span className="miniatura-vacia" aria-hidden="true" />
                        )}
                        <span>
                          <strong>{ejercicio.nombre}</strong>
                          {ejercicio.aliases.length ? ` — también reconocido como: ${ejercicio.aliases.join(", ")}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </section>,
        document.body,
      )}
      <style>{`@media print {
        @page { size: letter; margin: 14mm; }
        body * { visibility: hidden !important; }
        #inventario-ejercicios-imprimible, #inventario-ejercicios-imprimible * { visibility: visible !important; }
        #inventario-ejercicios-imprimible { display: block !important; position: absolute; inset: 0; padding: 0; color: #111; background: white; font-family: Arial, sans-serif; }
        #inventario-ejercicios-imprimible h1 { font-size: 20px; margin: 0 0 4px; }
        #inventario-ejercicios-imprimible h2 { font-size: 14px; margin: 14px 0 5px; border-bottom: 1px solid #999; }
        #inventario-ejercicios-imprimible p { font-size: 10px; line-height: 1.4; }
        #inventario-ejercicios-imprimible ol { columns: 2; column-gap: 24px; padding-left: 0; list-style: none; margin: 0; }
        #inventario-ejercicios-imprimible li { display: flex; align-items: center; gap: 6px; break-inside: avoid; margin-bottom: 5px; font-size: 9.5px; line-height: 1.25; }
        #inventario-ejercicios-imprimible img, #inventario-ejercicios-imprimible .miniatura-vacia { width: 24px; height: 24px; border-radius: 4px; object-fit: cover; flex-shrink: 0; background: #eee; }
      }`}</style>

      {pestana === "biblioteca" && (
        <>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ejercicio..."
              className="radius-control text-caption w-full border border-border bg-surface py-2 pl-8 pr-3 text-text"
            />
          </div>

          <button
            type="button"
            onClick={() => setCreando({ nombre: "" })}
            className="radius-control flex w-full items-center justify-center gap-2 border border-dashed border-vip/50 py-3 text-secondary font-semibold text-vip"
          >
            <Plus size={16} /> Ejercicio nuevo, con foto
          </button>

          {/* Misma lista imprimible que arma la pestaña Referencia (ver
              #inventario-ejercicios-imprimible más abajo) — está siempre en
              el DOM sin importar la pestaña activa, así que el botón de acá
              solo dispara el mismo print, sin duplicar nada. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="radius-control flex w-full items-center justify-center gap-1.5 border border-border py-2 text-caption font-semibold text-text-secondary"
          >
            <Printer size={14} /> Imprimir / guardar PDF de los {ejercicios.length} ejercicios
          </button>

      <div className="space-y-3">
        {filtrados.map((ej) => {
          const fotoBase = erroresFoto.has(ej.id) ? null : fotoDe(ej);
          const buster = cacheBuster[ej.id];
          // El "?r=<timestamp>" fuerza a next/image a pedirla de nuevo en vez
          // de repetir el mismo fallo cacheado — solo se agrega a partir del
          // reintento, y con un valor que nunca choca con uno de antes.
          const foto = fotoConReintento(fotoBase, buster);
          return (
            <Card key={ej.id} padding="p-0" className="tarjeta-modelo-oscura overflow-hidden border-white/10 bg-black">
              <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                <IlustracionEjercicio
                  ilustracionSlug={null}
                  grupoMuscular={ej.grupoMuscular}
                  nombre={ej.nombre}
                  tamano={30}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                    Vista del alumno · {ETIQUETAS_GRUPO[ej.grupoMuscular] ?? ej.grupoMuscular}
                  </p>
                  <p className="text-caption truncate font-bold text-vip">{ej.nombre}</p>
                </div>
                {ej.videoUrl && (
                  <span className="flex items-center gap-1 rounded-full bg-vip/10 px-2 py-1 text-[9px] font-bold text-vip">
                    <Play size={10} fill="currentColor" /> VIDEO
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => (ej.videoUrl ? setProbandoVideo(ej) : setEditando(ej))}
                aria-label={ej.videoUrl ? `Probar video de ${ej.nombre}` : `Editar foto de ${ej.nombre}`}
                className="relative mx-3 flex aspect-video h-auto w-[calc(100%_-_24px)] overflow-hidden rounded-[20px] border border-white/15 bg-black text-left"
              >
                  {foto ? (
                    <>
                      <Image
                        src={foto}
                        alt=""
                        aria-hidden
                        fill
                        sizes="(max-width: 640px) calc(100vw - 56px), 420px"
                        className="scale-110 object-cover opacity-45 blur-xl"
                        style={{ objectPosition: `${ej.fotoPanoramaX}% ${ej.fotoPanoramaY}%` }}
                      />
                      <Image
                        src={foto}
                        alt={ej.nombre}
                        fill
                        sizes="(max-width: 640px) calc(100vw - 56px), 420px"
                        className="z-[1] object-contain object-center"
                        onError={() => onErrorFoto(ej.id)}
                      />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <ImageIcon size={26} />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm">
                    {ej.videoUrl ? <Play size={12} fill="currentColor" /> : <Camera size={13} />}
                  </span>
              </button>

              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setEditando(ej)}
                  className="radius-control flex h-9 items-center justify-center gap-1.5 border border-border bg-surface-2 text-caption font-semibold text-text"
                >
                  <Camera size={13} /> Foto y datos
                </button>
                <button
                  type="button"
                  onClick={() => (ej.videoUrl ? setProbandoVideo(ej) : setEditando(ej))}
                  className="radius-control flex h-9 items-center justify-center gap-1.5 border border-border bg-surface-2 text-caption font-semibold text-vip"
                >
                  <Play size={13} fill="currentColor" /> {ej.videoUrl ? "Probar video" : "Agregar video"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <Card>
          <p className="text-body text-text-secondary">Ningún ejercicio coincide con la búsqueda.</p>
        </Card>
      )}
        </>
      )}

      {editando && (
        <ModalSubirFoto
          ejercicio={editando}
          fotoActual={fotoDe(editando)}
          todosLosEjercicios={ejercicios}
          versionAnteriorEn={versionesAnterioresFotos[editando.id] ?? null}
          onCerrar={() => setEditando(null)}
        />
      )}
      {probandoVideo?.videoUrl && (
        <ModalVideo
          videoUrl={probandoVideo.videoUrl}
          nombre={probandoVideo.nombre}
          onCerrar={() => setProbandoVideo(null)}
        />
      )}
      {creando !== null && (
        <ModalEjercicioNuevo
          nombreInicial={creando.nombre}
          archivoInicial={creando.archivo}
          tipoInicial={creando.tipo}
          ejercicios={ejercicios}
          onAbrirExistente={(ejercicio) => {
            setCreando(null);
            setEditando(ejercicio);
          }}
          onCerrar={() => setCreando(null)}
        />
      )}
    </div>
  );
}

const LADO_MAXIMO_FOTO = 1600;

/** Produce el único archivo que usa la app: suficientemente nítido al
 * ampliarlo y liviano para descargarlo como miniatura. Todo ocurre en el
 * teléfono; los bytes nunca pasan por Vercel. */
async function optimizarFotoEnNavegador(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
  } catch {
    // JPEG/PNG/WebP ya son mostrables por todos los navegadores de la app.
    // Si el canvas puntual del dispositivo falla, subir el archivo original
    // sigue siendo mejor que volver al servidor que corrompía sus bytes.
    if (["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return archivo;
    throw new Error("El teléfono no pudo convertir esa foto. Elige una imagen JPG o PNG.");
  }
}

type FotoSubidaCliente = { miniaturaUrl: string; completaUrl: string; hash: string };

/** SHA-256 en hexadecimal — mismo algoritmo que `hashearImagen` del lado del
 * servidor (procesarFoto.ts), para que "duplicado exacto" (ver Calidad)
 * también detecte fotos subidas por este camino, que nunca pasa por el
 * servidor con los bytes en la mano. */
async function hashearBlobEnNavegador(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Vista previa inmediata y subida directa navegador → Supabase. El servidor
 * recibe solamente la URL final, nunca el archivo binario.
 */
function useFotoInmediata() {
  const [archivoElegido, setArchivoElegido] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaRota, setPreviaRota] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoSubida, setFotoSubida] = useState<FotoSubidaCliente | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const urlPrevia = useRef<string | null>(null);
  // Elegir una foto, arrepentirse y elegir otra de inmediato disparaba dos
  // subidas en paralelo — sin este token, la que terminaba último ganaba
  // `fotoSubida` aunque no fuera la última elegida, y podía guardarse la
  // foto equivocada mostrando la correcta en pantalla.
  const tokenSubida = useRef(0);

  useEffect(() => {
    return () => {
      if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    };
  }, []);

  function mostrarPrevia(blob: Blob) {
    if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    urlPrevia.current = URL.createObjectURL(blob);
    setPrevia(urlPrevia.current);
    setPreviaRota(false);
  }

  async function subir(archivo: File) {
    const miToken = ++tokenSubida.current;
    setSubiendoFoto(true);
    setErrorFoto(null);
    setFotoSubida(null);
    try {
      const fotoLista = await optimizarFotoEnNavegador(archivo);
      if (miToken !== tokenSubida.current) return;
      mostrarPrevia(fotoLista);

      const [hash, supabase] = [await hashearBlobEnNavegador(fotoLista), createBrowserSupabaseClient()];
      if (miToken !== tokenSubida.current) return;
      const ruta = `sueltas/${crypto.randomUUID()}/foto.jpg`;
      const { error } = await supabase.storage.from("ejercicios-fotos").upload(ruta, fotoLista, {
        contentType: fotoLista.type || "image/jpeg",
        cacheControl: "31536000",
      });
      if (error) throw error;
      if (miToken !== tokenSubida.current) return;

      const url = supabase.storage.from("ejercicios-fotos").getPublicUrl(ruta).data.publicUrl;
      setFotoSubida({ miniaturaUrl: url, completaUrl: url, hash });
    } catch (error) {
      if (miToken !== tokenSubida.current) return;
      setErrorFoto(
        error instanceof Error
          ? error.message
          : "No se pudo subir la foto. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      if (miToken === tokenSubida.current) setSubiendoFoto(false);
    }
  }

  async function elegirArchivo(archivo: File) {
    setArchivoElegido(archivo);
    // Visible de inmediato, antes incluso de comprimir o tocar la red.
    mostrarPrevia(archivo);
    await subir(archivo);
  }

  function reintentar() {
    if (archivoElegido) void subir(archivoElegido);
  }

  return {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  };
}

function Overlay({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  // `createPortal` a `document.body`: es el único modal de esta pantalla que
  // NO lo hacía (todos los demás de la app sí, ver AbandonarSesionBoton,
  // ReiniciarRutinaBoton, etc.). Al quedar montado adentro del contenedor con
  // scroll de la página (`.pantalla-scroll`) en vez de directo en el body,
  // cuando el alumno... el entrenador volvía de elegir la foto (cámara o
  // galería), Safari intentaba llevarlo al elemento que había quedado
  // enfocado y terminaba scrolleando esa columna entera hasta arriba del
  // todo — el modal seguía viéndose bien (es `fixed`), pero por detrás la
  // página había saltado, y al cerrarlo aparecía arriba de todo en vez de
  // donde estaba.
  return createPortal(
    <div
      role="dialog"
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="radius-card max-h-[85vh] w-full max-w-md overflow-y-auto bg-surface p-4"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

const ESTADO_INICIAL_FOTO = { error: null, ok: false };
const ESTADO_INICIAL_NOMBRE = { error: null, ok: false };
const ESTADO_INICIAL_ELIMINAR = { error: null, ok: false };

/** Eliminar un ejercicio de la galería, con confirmación en dos pasos. En
 * realidad lo desactiva (`activo = false`, ver `desactivarEjercicio` en
 * actions.ts) — las rutinas que ya lo usan lo siguen mostrando igual, solo
 * deja de listarse y de ofrecerse para rutinas nuevas. */
function BotonEliminar({ ejercicio, onEliminado }: { ejercicio: Ejercicio; onEliminado: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [state, formAction, pending] = useActionState(desactivarEjercicio, ESTADO_INICIAL_ELIMINAR);

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onEliminado, 500);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-caption font-medium text-error"
      >
        Eliminar de la galería
      </button>
    );
  }

  return (
    <div className="radius-control space-y-1.5 border border-error/40 bg-error/5 p-2">
      <p className="text-caption text-text">
        Deja de aparecer en la galería y de ofrecerse para rutinas nuevas. Las rutinas que ya usan esta
        foto no se rompen — la siguen mostrando igual.
      </p>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
        <Button type="submit" variant="destructive" size="xsAuto" loading={pending}>
          Sí, eliminar
        </Button>
        <Button type="button" variant="ghost" size="xsAuto" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </form>
    </div>
  );
}

/** Todas las formas conocidas de nombrar el ejercicio, en el formato que
 * escribe el entrenador: "Press de pecho / Bench press / Press banca". La
 * primera es el nombre que se ve en la galería; el resto son los alias que
 * usa `emparejarEjercicio` para reconocer el mismo movimiento en una rutina
 * nueva, sin importar cómo lo haya escrito. */
function nombresComoTexto(ejercicio: Ejercicio): string {
  return [ejercicio.nombre, ...ejercicio.aliases].join(" / ");
}

const ESTADO_INICIAL_AGREGAR_ALIAS: AgregarAliasState = { error: null, ok: false };

/** Un alias como chip tocable: apretarlo lo saca de la lista, para el caso de
 * un nombre mal escrito o que ya no hace falta. Reusa `resolverAliasEnDisputa`
 * — la misma acción que ya usa "Nombres en disputa" para soltar un alias —
 * porque hacer exactamente eso (sacar UN alias de UN ejercicio) es todo lo
 * que hace falta acá también, sea o no una disputa. */
function AliasChipEliminable({ ejercicio, alias }: { ejercicio: Ejercicio; alias: string }) {
  const [state, formAction, pending] = useActionState(resolverAliasEnDisputa, ESTADO_INICIAL_ALIAS);
  if (state.ok) return null;
  return (
    <form
      action={formAction}
      onSubmit={(evento) => {
        if (!window.confirm(`¿Quitar "${alias}" de ${ejercicio.nombre}? Si una rutina lo escribe así, se queda sin foto hasta que uses otro de sus nombres.`)) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <input type="hidden" name="alias" value={alias} />
      <button
        type="submit"
        disabled={pending}
        className="radius-control flex items-center gap-1 border border-border bg-surface px-2 py-1 text-[10px] text-text-secondary disabled:opacity-50"
      >
        {pending ? "Quitando…" : alias} {!pending && <X size={10} />}
      </button>
    </form>
  );
}

/** Atajo para el caso de todos los días: sumar un nombre suelto sin editar la
 * lista completa separada por "/". Un "+" abre un campo de texto único; al
 * guardar, se agrega como alias nuevo y el campo se limpia solo — pensado
 * para ir vinculando varios reportes seguidos sin fricción. */
function AgregarAliasRapido({ ejercicio }: { ejercicio: Ejercicio }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [state, formAction, pending] = useActionState(agregarAliasEjercicio, ESTADO_INICIAL_AGREGAR_ALIAS);
  // Limpiar el campo al guardar es una reacción a la respuesta del server
  // action, no un efecto secundario — se ajusta durante el render comparando
  // contra la última respuesta ya procesada, sin useEffect (ver "You Might
  // Not Need an Effect" de React: ajustar estado cuando cambia otro estado).
  const [ultimoEstadoVisto, setUltimoEstadoVisto] = useState(state);
  if (state !== ultimoEstadoVisto) {
    setUltimoEstadoVisto(state);
    if (state.ok) {
      setTexto("");
      setAbierto(false);
    }
  }

  return (
    <div className="space-y-1.5">
      {ejercicio.aliases.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="radius-control border border-border bg-surface-2 px-2 py-1 text-[10px] font-semibold text-text">{ejercicio.nombre}</span>
          {ejercicio.aliases.map((alias) => (
            <AliasChipEliminable key={alias} ejercicio={ejercicio} alias={alias} />
          ))}
        </div>
      )}
      {abierto ? (
        <form action={formAction} className="flex items-center gap-1.5">
          <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
          <input type="hidden" name="alias" value={texto} />
          <Input
            autoFocus
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Ej: Elevación de gemelos"
            className="!py-2 text-caption"
          />
          <Button type="submit" size="xsAuto" loading={pending} disabled={!texto.trim()}>Agregar</Button>
          <Button type="button" variant="ghost" size="xsAuto" onClick={() => { setAbierto(false); setTexto(""); }}>Cancelar</Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="radius-control flex items-center gap-1 border border-dashed border-vip/40 px-2.5 py-1.5 text-[11px] font-semibold text-vip"
        >
          <Plus size={12} /> Agregar otro nombre
        </button>
      )}
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && state.mensaje && <p className="text-caption text-success">{state.mensaje}</p>}
    </div>
  );
}

function EditorNombre({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(actualizarNombreEjercicio, ESTADO_INICIAL_NOMBRE);

  return (
    <div className="space-y-2.5">
      <AgregarAliasRapido ejercicio={ejercicio} />
      <details>
        <summary className="cursor-pointer text-micro font-semibold text-text-tertiary">Editar la lista completa (renombrar o quitar varios a la vez)</summary>
        <form action={formAction} className="mt-1.5 space-y-1.5">
          <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
          <span className="text-caption block text-text-tertiary">
            Nombre — separá variantes con &quot;/&quot; para que cualquiera muestre esta misma foto
          </span>
          <Textarea
            name="nombres"
            required
            rows={2}
            defaultValue={nombresComoTexto(ejercicio)}
            placeholder="Ej: Press de pecho / Bench press / Press banca"
            className="!py-2 text-caption"
          />
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          {state.ok && (
            <p className="text-caption flex items-center gap-1 text-success">
              <Check size={12} /> Nombre guardado.
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text disabled:opacity-60"
          >
            {pending ? "Guardando..." : "Guardar nombre"}
          </button>
        </form>
      </details>
    </div>
  );
}

function EditorDetalles({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, action, pending] = useActionState(actualizarDetallesEjercicio, { error: null, ok: false });
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <p className="text-caption font-semibold text-text">Detalles técnicos</p>
      <label className="block"><span className="text-micro text-text-tertiary">Nivel</span><select name="nivel" defaultValue={ejercicio.nivel} className="radius-control mt-1 w-full border border-border bg-surface-2 px-3 py-2 text-caption text-text"><option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option></select></label>
      <label className="block"><span className="text-micro text-text-tertiary">Descripción corta</span><Textarea name="descripcion_corta" rows={2} defaultValue={ejercicio.descripcionCorta ?? ""} placeholder="Qué trabaja y para qué se usa" className="mt-1 text-caption" /></label>
      <label className="block"><span className="text-micro text-text-tertiary">Ejecución correcta</span><Textarea name="tecnica" rows={3} defaultValue={ejercicio.tecnica ?? ""} placeholder="Pasos para realizarlo correctamente" className="mt-1 text-caption" /></label>
      <label className="block"><span className="text-micro text-text-tertiary">Errores comunes · uno por línea</span><Textarea name="errores_comunes" rows={3} defaultValue={ejercicio.erroresComunes.join("\n")} className="mt-1 text-caption" /></label>
      <label className="block"><span className="text-micro text-text-tertiary">Consejos · uno por línea</span><Textarea name="consejos" rows={3} defaultValue={ejercicio.consejos.join("\n")} className="mt-1 text-caption" /></label>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && <p className="text-caption text-success">Detalles guardados.</p>}
      <Button type="submit" size="xs" loading={pending}>Guardar detalles</Button>
    </form>
  );
}

const ESTADO_INICIAL_QUITAR_VIDEO = { error: null, ok: false };
const ESTADO_INICIAL_QUITAR_CLOUDFLARE = { error: null, ok: false };

function EditorVideoCloudflare({ ejercicio }: { ejercicio: Ejercicio }) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [estadoQuitar, accionQuitar, quitando] = useActionState(
    quitarVideoCloudflare,
    ESTADO_INICIAL_QUITAR_CLOUDFLARE
  );

  useEffect(() => {
    if (ejercicio.videoCloudflareEstado !== "procesando") return;
    let cancelado = false;
    const comprobar = async () => {
      const estado = await sincronizarVideoCloudflare(ejercicio.id);
      if (!cancelado && (estado === "listo" || estado === "error")) router.refresh();
    };
    void comprobar();
    const intervalo = window.setInterval(() => void comprobar(), 8_000);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [ejercicio.id, ejercicio.videoCloudflareEstado, router]);

  async function elegir(archivo: File) {
    setError(null);
    setMensaje(null);
    if (archivo.size > 100 * 1024 * 1024) {
      setError("El video supera el máximo de 100 MB.");
      return;
    }
    const duracion = await duracionVideo(archivo);
    if (duracion !== null && duracion > 30.5) {
      setError("El clip debe durar 30 segundos o menos.");
      return;
    }
    setSubiendo(true);
    setProgreso(0);
    try {
      const inicio = await iniciarSubidaVideoCloudflare(ejercicio.id, archivo.size, archivo.type);
      if (!inicio.ok) {
        setError(inicio.error);
        return;
      }
      await subirDirectoCloudflare(inicio.endpoint, archivo, setProgreso);
      await confirmarSubidaVideoCloudflare(ejercicio.id);
      setMensaje("Video recibido. Cloudflare está preparando la reproducción.");
    } catch {
      setError("La subida se interrumpió. Intenta nuevamente.");
    } finally {
      setSubiendo(false);
    }
  }

  const estado = ejercicio.videoCloudflareEstado;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-caption font-semibold text-text">Clip automático del ejercicio</p>
        <p className="text-micro text-text-tertiary">MP4, MOV o WebM · máximo 30 segundos y 100 MB</p>
      </div>
      {estado && (
        <p className={`text-caption ${estado === "error" ? "text-error" : estado === "listo" ? "text-success" : "text-text-secondary"}`}>
          {estado === "subiendo" ? "Subiendo" : estado === "procesando" ? "Procesando en Cloudflare" : estado === "listo" ? "Listo para el alumno" : "Error al procesar"}
          {estado === "listo" && ejercicio.videoCloudflareDuracionSeg != null ? ` · ${Math.round(ejercicio.videoCloudflareDuracionSeg)} s` : ""}
          {estado === "error" && ejercicio.videoCloudflareError ? ` · ${ejercicio.videoCloudflareError}` : ""}
        </p>
      )}
      {subiendo && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`Subida ${progreso}%`}>
          <div className="h-full bg-vip transition-[width]" style={{ width: `${progreso}%` }} />
        </div>
      )}
      <label className={`radius-control flex h-10 w-full items-center justify-center gap-2 border border-vip/40 text-caption font-semibold text-vip ${subiendo ? "opacity-50" : "cursor-pointer"}`}>
        <Film size={16} /> {subiendo ? `Subiendo ${progreso}%` : ejercicio.videoCloudflareUid ? "Reemplazar clip" : "Subir clip"}
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={subiendo}
          className="sr-only"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            if (archivo) void elegir(archivo);
            evento.target.value = "";
          }}
        />
      </label>
      {mensaje && <p className="text-caption text-success">{mensaje}</p>}
      {error && <p className="text-caption text-error">{error}</p>}
      {estadoQuitar.error && <p className="text-caption text-error">{estadoQuitar.error}</p>}
      {ejercicio.videoCloudflareUid && (
        <form action={accionQuitar}>
          <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
          <button type="submit" disabled={quitando} className="text-caption font-medium text-text-tertiary disabled:opacity-50">
            {quitando ? "Quitando…" : "Quitar clip de Cloudflare"}
          </button>
        </form>
      )}
    </div>
  );
}

function EditorVideoAnterior({ ejercicio }: { ejercicio: Ejercicio }) {
  const [estadoQuitar, accionQuitar, pendingQuitar] = useActionState(
    quitarVideoEjercicio,
    ESTADO_INICIAL_QUITAR_VIDEO
  );

  if (!ejercicio.videoUrl) return null;

  return (
    <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="text-caption font-semibold text-text">Video anterior detectado</p>
      <p className="text-micro text-text-tertiary">
        Los enlaces de YouTube están desactivados. Puedes borrarlo ahora o subir un clip nuevo;
        al vincular Cloudflare Stream se quitará automáticamente.
      </p>
      <form action={accionQuitar}>
        <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
        {estadoQuitar.error && <p className="text-caption mb-1 text-error">{estadoQuitar.error}</p>}
        {estadoQuitar.ok && <p className="text-caption mb-1 text-success">Video anterior eliminado.</p>}
        <button
          type="submit"
          disabled={pendingQuitar}
          className="radius-control flex h-9 w-full items-center justify-center border border-border text-caption font-semibold text-text disabled:opacity-60"
        >
          {pendingQuitar ? "Eliminando..." : "Eliminar video anterior"}
        </button>
      </form>
    </div>
  );
}

type PosicionFoto = { x: number; y: number };

function EncuadreArrastrable({
  src,
  nombre,
  formato,
  posicion,
  onChange,
  onError,
}: {
  src: string;
  nombre: string;
  formato: "panorama" | "cuadrado";
  posicion: PosicionFoto;
  onChange: (posicion: PosicionFoto) => void;
  onError: () => void;
}) {
  const inicio = useRef<{ clientX: number; clientY: number; posicion: PosicionFoto } | null>(null);

  const mover = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (!inicio.current) return;
    const rect = evento.currentTarget.getBoundingClientRect();
    const dx = ((evento.clientX - inicio.current.clientX) / rect.width) * 100;
    const dy = ((evento.clientY - inicio.current.clientY) / rect.height) * 100;
    const limitar = (valor: number) => Math.min(100, Math.max(0, valor));
    onChange({
      x: limitar(inicio.current.posicion.x - dx),
      y: limitar(inicio.current.posicion.y - dy),
    });
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-caption font-semibold text-text">{nombre}</p>
        <span className="text-micro text-text-tertiary">Arrastra para centrar</span>
      </div>
      <div
        className={`relative touch-none select-none overflow-hidden border border-vip/35 bg-surface-2 ${
          formato === "panorama" ? "h-[112px] w-full rounded-[20px]" : "mx-auto aspect-square w-[160px] rounded-[20px]"
        }`}
        onPointerDown={(evento) => {
          inicio.current = { clientX: evento.clientX, clientY: evento.clientY, posicion };
          evento.currentTarget.setPointerCapture(evento.pointerId);
        }}
        onPointerMove={mover}
        onPointerUp={() => { inicio.current = null; }}
        onPointerCancel={() => { inicio.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={nombre}
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{ objectPosition: `${posicion.x}% ${posicion.y}%` }}
          onError={onError}
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-5 rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,.35)]" />
        </span>
      </div>
    </div>
  );
}

/**
 * Mesa de trabajo: un ejercicio a la vez, con todo lo que hace falta para
 * dejarlo terminado en una sola pantalla — foto, encuadre, vista real del
 * alumno, clip de Cloudflare y los nombres sueltos que le corresponden.
 *
 * No reimplementa nada: reusa las mismas piezas que ya usaba el modal
 * (`useFotoInmediata`, `EncuadreArrastrable`, `CuadroFotoReferencia`,
 * `EditorVideoCloudflare`) y la misma Server Action de siempre. Lo que cambia
 * es el recorrido: antes había que buscar el ejercicio en la grilla, abrir un
 * modal para la foto, otro editor para el video y una pestaña distinta para
 * los nombres. Acá la cola ya viene ordenada por impacto y se avanza de a uno.
 */
/**
 * Combinar desde la Mesa, con la dirección elegida a mano.
 *
 * La lista de duplicados decide sola cuál sobrevive (gana el que tenga foto),
 * y ahí funciona porque se comparan dos entradas casi iguales. Acá no sirve:
 * el entrenador está parado sobre un ejercicio concreto y necesita leer, antes
 * de tocar nada, cuál de los dos desaparece — porque el que desaparece se
 * lleva sus usos en las rutinas de todos los alumnos.
 */
function CombinarEnMesa({
  actual,
  otro,
  usosActual,
  usosOtro,
}: {
  actual: Ejercicio;
  otro: Ejercicio;
  usosActual: number;
  usosOtro: number;
}) {
  const [state, action, pending] = useActionState(combinarEjerciciosDuplicados, ESTADO_INICIAL_COMBINAR);
  const [abierto, setAbierto] = useState(false);

  const opcion = (queda: Ejercicio, desaparece: Ejercicio, usosDesaparece: number) => (
    <form
      action={action}
      onSubmit={(evento) => {
        if (!window.confirm(`Queda "${queda.nombre}".\n\n"${desaparece.nombre}" deja de existir y sus ${usosDesaparece} usos pasan a "${queda.nombre}".\n\n¿Confirmás?`)) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="original_id" value={actual.id} />
      <input type="hidden" name="duplicado_id" value={otro.id} />
      <input type="hidden" name="original_forzado" value={queda.id} />
      <button
        type="submit"
        disabled={pending}
        className="radius-control w-full border border-border px-2 py-1.5 text-left text-[11px] text-text-secondary disabled:opacity-50"
      >
        Dejar <strong className="text-text">{queda.nombre}</strong>
        <span className="block text-[10px] text-text-tertiary">
          {desaparece.nombre} desaparece · {usosDesaparece} {usosDesaparece === 1 ? "uso pasa" : "usos pasan"} al que queda
        </span>
      </button>
    </form>
  );

  return (
    <div className="radius-control border border-border bg-surface-2 p-2">
      <p className="text-caption font-semibold text-text">{otro.nombre}</p>
      <p className="text-micro text-text-tertiary">
        {ETIQUETAS_GRUPO[otro.grupoMuscular] ?? otro.grupoMuscular}
        {` · ${usosOtro} usos`}
        {otro.fotoMiniaturaUrl || otro.fotoCompletaUrl ? " · ✓ foto propia" : " · sin foto propia"}
      </p>
      {abierto ? (
        <div className="mt-1.5 space-y-1">
          <p className="text-micro text-text-secondary">¿Cuál se queda?</p>
          {opcion(actual, otro, usosOtro)}
          {opcion(otro, actual, usosActual)}
          <button type="button" onClick={() => setAbierto(false)} className="text-micro text-text-tertiary underline">
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="radius-control mt-1.5 flex items-center gap-1 border border-warning/40 px-2 py-1 text-[9px] font-semibold text-warning"
        >
          <Merge size={11} /> Borrar uno y dejar solo el otro
        </button>
      )}
      {state.error && <p className="text-micro mt-1 text-error">{state.error}</p>}
      {state.ok && <p className="text-micro mt-1 text-success">{state.mensaje}</p>}
    </div>
  );
}

const ESTADO_INICIAL_QUITAR_FOTO: QuitarFotoState = { error: null, ok: false };

/** Sacar la foto sin reemplazarla por otra: el ejercicio vuelve a su
 * ilustración de referencia, que es genérica pero del movimiento correcto. */
function QuitarFotoBoton({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, action, pending] = useActionState(quitarFotoEjercicio, ESTADO_INICIAL_QUITAR_FOTO);
  // Se pregunta por la foto PROPIA, no por `fotoDe()`: ese ayudante devuelve la
  // ilustración cuando no hay foto, así que el botón aparecía en ejercicios que
  // no tenían nada que borrar y el servidor rebotaba la operación.
  const tieneFotoPropia = Boolean(ejercicio.fotoMiniaturaUrl || ejercicio.fotoCompletaUrl);
  if (!tieneFotoPropia) {
    // El dibujo compartido no se puede "quitar": es el respaldo del sistema.
    // Decirlo evita que el entrenador busque un botón que no debería existir.
    return ejercicio.ilustracionSlug ? (
      <p className="text-micro mt-1.5 text-text-tertiary">
        Todavía no tiene foto propia — lo que ves es el dibujo de referencia, que puede repetirse en ejercicios parecidos.
        Subí una foto para reemplazarlo.
      </p>
    ) : null;
  }
  return (
    <form
      action={action}
      onSubmit={(evento) => {
        if (!window.confirm(`¿Quitar la foto de "${ejercicio.nombre}"? Vuelve a mostrarse el dibujo de referencia.`)) evento.preventDefault();
      }}
      className="mt-1.5"
    >
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <button type="submit" disabled={pending} className="text-caption font-medium text-text-tertiary underline disabled:opacity-50">
        {pending ? "Quitando…" : "Esta foto no es de este ejercicio — quitarla"}
      </button>
      {state.error && <p className="text-micro mt-1 text-error">{state.error}</p>}
      {state.ok && <p className="text-micro mt-1 text-success">Foto quitada.</p>}
    </form>
  );
}

/** Primera palabra significativa del nombre: la que dice qué movimiento es. */
function palabraDelMovimiento(nombre: string): string {
  const partes = normalizar(nombre).split(" ").filter((p) => p.length > 2 && !["de", "del", "con", "sin", "las", "los", "para"].includes(p));
  const primera = partes[0] ?? "";
  return primera.length > 3 && primera.endsWith("s") ? primera.slice(0, -1) : primera;
}

function FichaMesa({
  ejercicio,
  usos,
  reportes,
  nombresSugeridos,
  parecidos,
  usosPorEjercicio,
  ejercicios,
  onListo,
}: {
  ejercicio: Ejercicio;
  usos: number;
  reportes: number;
  nombresSugeridos: { nombre: string; cantidad: number }[];
  parecidos: Ejercicio[];
  usosPorEjercicio: Record<string, UsoEjercicioInventario>;
  ejercicios: Ejercicio[];
  onListo: () => void;
}) {
  const [state, formAction, pending] = useActionState(subirFotoEjercicio, ESTADO_INICIAL_FOTO);
  const { archivoElegido, previa, previaRota, setPreviaRota, subiendoFoto, fotoSubida, errorFoto, elegirArchivo, reintentar } =
    useFotoInmediata();
  const [panorama, setPanorama] = useState({ x: ejercicio.fotoPanoramaX, y: ejercicio.fotoPanoramaY });
  const [cuadrada, setCuadrada] = useState({ x: ejercicio.fotoCuadradaX, y: ejercicio.fotoCuadradaY });
  const imagenAMostrar = previa ?? fotoDe(ejercicio);

  return (
    <div className="space-y-3">
      <div className="radius-control border border-border bg-surface p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-card-title truncate text-text">{ejercicio.nombre}</p>
            <p className="text-micro text-text-tertiary">
              {ETIQUETAS_GRUPO[ejercicio.grupoMuscular] ?? ejercicio.grupoMuscular}
              {usos > 0 && ` · ${usos} ${usos === 1 ? "uso" : "usos"} en rutinas`}
            </p>
          </div>
          {reportes > 0 && (
            <span className="shrink-0 rounded-full bg-error/15 px-2 py-1 text-[9px] font-bold text-error">
              {reportes} {reportes === 1 ? "RECLAMO" : "RECLAMOS"}
            </span>
          )}
        </div>
      </div>

      {/* 1 · Foto y encuadre */}
      <div className="radius-control border border-border bg-surface p-3">
        <p className="text-caption font-semibold text-text">1 · La foto</p>
        {imagenAMostrar && !previaRota ? (
          <div className="mt-2 space-y-2">
            <p className="text-micro text-text-tertiary">Arrastrá la foto para centrarla. Cada formato guarda su propio centro.</p>
            <EncuadreArrastrable src={imagenAMostrar} nombre="Vista rectangular del alumno" formato="panorama" posicion={panorama} onChange={setPanorama} onError={() => setPreviaRota(true)} />
            <EncuadreArrastrable src={imagenAMostrar} nombre="Vista cuadrada del alumno" formato="cuadrado" posicion={cuadrada} onChange={setCuadrada} onError={() => setPreviaRota(true)} />
            <label className="radius-control flex h-10 w-full cursor-pointer items-center justify-center gap-2 border border-border text-caption font-semibold text-text">
              <Camera size={15} /> Cambiar la foto
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegirArchivo(f); }} />
            </label>
            <QuitarFotoBoton ejercicio={ejercicio} />
          </div>
        ) : (
          <label className="radius-card relative mt-2 flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-vip/40 bg-surface-2">
            <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
              <Camera size={26} className="text-vip" />
              <span className="text-caption">{previaRota ? "Esa imagen no se pudo mostrar. Probá con otra." : "Tocá para elegir o sacar la foto"}</span>
            </span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="absolute inset-0 h-full w-full opacity-0" onChange={(e) => { const f = e.target.files?.[0]; if (f) void elegirArchivo(f); }} />
          </label>
        )}
        {subiendoFoto && <p className="text-micro mt-1.5 text-text-secondary">Preparando la foto…</p>}
        {fotoSubida && !pending && <p className="text-micro mt-1.5 text-success">✓ Lista para guardar</p>}
        {errorFoto && (
          <button type="button" onClick={reintentar} className="text-caption mt-1 font-medium text-vip">Reintentar subir la foto</button>
        )}

        <form
          action={(fd) => {
            if (fotoSubida) {
              fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
              fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
              fd.set("foto_hash_cliente", fotoSubida.hash);
            }
            fd.set("ejercicio_id", ejercicio.id);
            formAction(fd);
          }}
          className="mt-2.5"
        >
          <input type="hidden" name="foto_panorama_x" value={panorama.x} />
          <input type="hidden" name="foto_panorama_y" value={panorama.y} />
          <input type="hidden" name="foto_cuadrada_x" value={cuadrada.x} />
          <input type="hidden" name="foto_cuadrada_y" value={cuadrada.y} />
          {state.error && <p className="text-caption mb-1 text-error">{state.error}</p>}
          {state.ok && <p className="text-caption mb-1 flex items-center gap-1 text-success"><Check size={14} /> Guardado — ya lo ven los alumnos.</p>}
          <button
            type="submit"
            disabled={pending || subiendoFoto || (!!archivoElegido && !fotoSubida) || !imagenAMostrar}
            className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
          >
            {pending ? "Guardando…" : subiendoFoto ? "Preparando…" : "Guardar foto y encuadre"}
          </button>
        </form>
        <div className="mt-3 border-t border-border pt-3">
          <GaleriaMultimediaEjercicio ejercicio={ejercicio} />
        </div>
      </div>

      {/* 2 · Cómo lo ve el alumno */}
      <div className="radius-control border border-border bg-surface p-3">
        <p className="text-caption font-semibold text-text">2 · Cómo lo ve el alumno</p>
        <p className="text-micro mb-2 text-text-tertiary">Es el mismo cuadro de la pantalla de entrenamiento, no una imitación.</p>
        <CuadroFotoReferencia
          ilustracionSlug={ejercicio.ilustracionSlug}
          fotoMiniaturaUrl={imagenAMostrar ?? ejercicio.fotoMiniaturaUrl}
          fotoCompletaUrl={imagenAMostrar ?? ejercicio.fotoCompletaUrl}
          videoUrl={ejercicio.videoUrl}
          videoCloudflareUid={ejercicio.videoCloudflareUid}
          videoCloudflareEstado={ejercicio.videoCloudflareEstado}
          videoCloudflareMiniaturaUrl={ejercicio.videoCloudflareMiniaturaUrl}
          nombre={ejercicio.nombre}
          ejercicioId={ejercicio.id}
          fotoPanoramaX={panorama.x}
          fotoPanoramaY={panorama.y}
          fotoCuadradaX={cuadrada.x}
          fotoCuadradaY={cuadrada.y}
          destacado
          reproducirAutomaticamente={ejercicio.videoCloudflareEstado === "listo"}
        />
      </div>

      {/* 3 · Clip */}
      <div className="radius-control border border-border bg-surface p-3">
        <p className="text-caption mb-2 font-semibold text-text">3 · El clip (opcional)</p>
        <EditorVideoCloudflare ejercicio={ejercicio} />
        <EditorVideoAnterior ejercicio={ejercicio} />
      </div>

      {/* 4 · Nombres que le corresponden */}
      <div className="radius-control border border-border bg-surface p-3">
        <p className="text-caption font-semibold text-text">4 · Cómo lo escriben en las rutinas</p>
        {nombresSugeridos.length > 0 ? (
          <>
            <p className="text-micro mt-0.5 text-text-tertiary">
              Estos nombres sueltos parecen ser este ejercicio. Al vincularlos quedan como alias y las rutinas que los usan muestran esta foto.
            </p>
            <div className="mt-1.5">
              {nombresSugeridos.map((item) => (
                <VincularNombreRutina key={item.nombre} item={item} ejercicios={ejercicios} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-micro mt-0.5 text-text-tertiary">Ningún nombre suelto se parece a este ejercicio.</p>
        )}
        <div className="mt-2 border-t border-border pt-2">
          <EditorNombre ejercicio={ejercicio} />
        </div>
      </div>

      {/* 5 · Separar lo que no es el mismo ejercicio.
          Caso real: "Curl femoral sentado" y "Curl femoral tumbado" no son lo
          mismo, pero mientras el gimnasio no tenga la máquina de sentado
          conviven bajo la misma entrada. Cuando llega la máquina, se crea el
          ejercicio nuevo y desde acá se le mueven sus nombres — sin tocar las
          rutinas a mano ni perder el historial. */}
      <div className="radius-control border border-border bg-surface p-3">
        <p className="text-caption font-semibold text-text">5 · Nombres que hoy caen en este ejercicio</p>
        <p className="text-micro mt-0.5 mb-2 text-text-tertiary">
          Todos estos <strong className="text-text">ya están bien vinculados</strong> y muestran esta foto. No hay nada que
          confirmar. El botón está por si alguno <strong className="text-text">no</strong> es este ejercicio: ahí lo movés al que
          corresponda, y cambia para todos los alumnos.
        </p>
        <UsosRutinaEditor ejercicio={ejercicio} todosLosEjercicios={ejercicios} />
      </div>

      {/* 6 · Parecidos.
          Deliberadamente NO es una cola de preguntas automáticas: probando esa
          idea contra la biblioteca real salieron 60 pares y 55 eran disparates
          ("¿Press de banca y Press francés son el mismo?"), mientras que el
          caso verdadero —Crunch controlado y Crunch abdominal— se perdía por
          tener distinto equipo cargado. El dato que falta no está en el texto,
          está en la cabeza del entrenador. Así que se le muestran los vecinos
          mientras ya está mirando el ejercicio, y decide él en un segundo. */}
      {parecidos.length > 0 && (
        <div className="radius-control border border-border bg-surface p-3">
          <p className="text-caption font-semibold text-text">6 · Parecidos a este</p>
          <p className="text-micro mt-0.5 mb-2 text-text-tertiary">
            Empiezan con la misma palabra. Si alguno es el mismo aparato de tu gimnasio, combinalos.
          </p>
          <p className="text-micro mb-2 rounded-lg border border-border bg-surface-2 p-2 text-text-secondary">
            Combinar une los dos ejercicios en uno: el que elijas se queda, el otro <strong className="text-text">deja de existir</strong> y
            sus rutinas pasan al que queda. <strong className="text-text">No sirve para arreglar una foto.</strong> Si solo la foto está
            mal, cambiala o quitala arriba.
          </p>
          <div className="space-y-2">
            {parecidos.map((otro) => (
              <CombinarEnMesa
                key={otro.id}
                actual={ejercicio}
                otro={otro}
                usosActual={usos}
                usosOtro={usosPorEjercicio[otro.id]?.cantidad ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onListo}
        className="radius-control flex h-11 w-full items-center justify-center gap-2 border border-vip/40 text-caption font-bold text-vip"
      >
        Siguiente ejercicio <ChevronRight size={16} />
      </button>
    </div>
  );
}

function MesaDeTrabajo({
  ejercicios,
  usosPorEjercicio,
  reportesPorEjercicio,
  nombresRutinaSinVincular,
  nombresReportadosSinEjercicio,
}: {
  ejercicios: Ejercicio[];
  usosPorEjercicio: Record<string, UsoEjercicioInventario>;
  reportesPorEjercicio: Record<string, number>;
  nombresRutinaSinVincular: { nombre: string; cantidad: number }[];
  nombresReportadosSinEjercicio: string[];
}) {
  const [indice, setIndice] = useState(0);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [creando, setCreando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // Qué nombre suelto le toca a cada ejercicio, resuelto con el MISMO
  // emparejador que usa la app (alias, abreviaturas, veto por músculo y por
  // equipo). Un comparador propio, más flojo, proponía "Hip Thrust con barra
  // libre" para el press inclinado por compartir la palabra "barra".
  //
  // Se calcula una sola vez para toda la cola, no por ficha: son cientos de
  // nombres contra toda la biblioteca, y rehacerlo en cada "siguiente" no
  // aporta nada.
  const sugeridosPorEjercicio = useMemo(() => {
    const mapa: Record<string, { nombre: string; cantidad: number }[]> = {};
    for (const item of nombresRutinaSinVincular) {
      const r = emparejarEjercicio(item.nombre, ejercicios);
      if (!r) continue;
      (mapa[r.ejercicio.id] ??= []).push(item);
    }
    for (const lista of Object.values(mapa)) lista.sort((a, b) => b.cantidad - a.cantidad);
    return mapa;
  }, [ejercicios, nombresRutinaSinVincular]);

  // La cola se ordena por daño real, no alfabéticamente: primero lo que un
  // alumno reclamó (es una queja explícita), después lo que más gente ve.
  // Entra a la cola todo lo que tenga algo por hacer — sin foto, con reclamo,
  // o con nombres de rutina esperando que alguien los vincule.
  const colaCandidata = useMemo(() => {
    const q = normalizar(busqueda);
    // Buscar manda sobre el filtro: si el entrenador escribe un nombre, quiere
    // ese ejercicio aunque ya esté terminado.
    const base = q
      ? ejercicios.filter((e) => normalizar(`${e.nombre} ${e.aliases.join(" ")}`).includes(q))
      : soloPendientes
        ? ejercicios.filter(
            (e) => !fotoDe(e) || (reportesPorEjercicio[e.id] ?? 0) > 0 || (sugeridosPorEjercicio[e.id]?.length ?? 0) > 0,
          )
        : ejercicios;
    return [...base].sort((a, b) => {
      const reporteA = reportesPorEjercicio[a.id] ?? 0;
      const reporteB = reportesPorEjercicio[b.id] ?? 0;
      if ((reporteA > 0) !== (reporteB > 0)) return reporteB - reporteA;
      return (usosPorEjercicio[b.id]?.cantidad ?? 0) - (usosPorEjercicio[a.id]?.cantidad ?? 0);
    });
  }, [ejercicios, soloPendientes, busqueda, reportesPorEjercicio, usosPorEjercicio, sugeridosPorEjercicio]);

  // El orden y la composición de la cola quedan CONGELADOS mientras se
  // trabaja: `colaCandidata` se recalcula sola (revalidatePath trae datos
  // nuevos apenas se guarda una foto), y con `soloPendientes` activo el
  // ejercicio recién resuelto salía de la lista en el acto — la ficha
  // (keyed por id) se desmontaba, saltaba a otro ejercicio, y el cartel de
  // "Guardado" no llegaba a verse nunca. Solo se recongela al cambiar el
  // filtro o la búsqueda; los datos de cada ejercicio (foto, nombre) siguen
  // frescos porque se resuelven contra `ejercicios` en cada render.
  const [idsCola, setIdsCola] = useState<string[]>(() => colaCandidata.map((e) => e.id));
  useEffect(() => {
    // Recongela la cola a propósito solo cuando cambia el filtro/búsqueda —
    // mismo caso ya documentado en SesionEjercicioCard.tsx para otros
    // useActionState de esta pantalla: sincroniza con una entrada externa
    // (filtros elegidos por el usuario), no con datos derivados que cambian
    // en cada render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdsCola(colaCandidata.map((e) => e.id));
    setIndice(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a propósito: NO depende de colaCandidata completo (cambia con cada guardado), solo de los filtros que la definen.
  }, [soloPendientes, busqueda]);
  const ejerciciosPorId = useMemo(() => new Map(ejercicios.map((e) => [e.id, e])), [ejercicios]);
  const cola = useMemo(
    () => idsCola.map((id) => ejerciciosPorId.get(id)).filter((e): e is Ejercicio => !!e),
    [idsCola, ejerciciosPorId],
  );

  const actual = cola[Math.min(indice, cola.length - 1)];
  const sugeridos = actual ? (sugeridosPorEjercicio[actual.id] ?? []) : [];
  // Vecinos por palabra de movimiento, SIN filtrar por equipo ni por grupo: es
  // justo el filtro que hacía desaparecer "Crunch controlado" contra "Crunch
  // abdominal" (uno cargado como banco, el otro como peso corporal).
  const parecidos = useMemo(() => {
    if (!actual) return [];
    const clave = palabraDelMovimiento(actual.nombre);
    if (!clave) return [];
    return ejercicios
      .filter((e) => e.id !== actual.id && palabraDelMovimiento(e.nombre) === clave)
      .sort((a, b) => (usosPorEjercicio[b.id]?.cantidad ?? 0) - (usosPorEjercicio[a.id]?.cantidad ?? 0))
      .slice(0, 6);
  }, [actual, ejercicios, usosPorEjercicio]);

  if (!actual) {
    return (
      <Card padding="p-4" className="text-center">
        <p className="text-caption font-semibold text-text">No queda nada por completar</p>
        <p className="text-micro mt-1 text-text-tertiary">Todos los ejercicios tienen foto y no hay reclamos abiertos.</p>
        <button type="button" onClick={() => setSoloPendientes(false)} className="text-caption mt-2 font-semibold text-vip">
          Ver igual todos los ejercicios
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Los alumnos piden fotos de ejercicios que nunca se dieron de alta.
          Antes ese reporte no se podía cerrar desde ningún lado: la galería
          ofrecía "Agregar foto" y no había a qué pegarla. Acá se crea el
          ejercicio con el nombre ya escrito y sigue el camino normal. */}
      {nombresReportadosSinEjercicio.length > 0 && (
        <details className="rounded-[20px] border border-vip/35 bg-vip/5 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-vip/15 text-vip"><Plus size={17} /></span>
            <span className="min-w-0 flex-1">
              <span className="text-caption block font-bold text-text">Te pidieron ejercicios que no existen</span>
              <span className="text-micro block text-text-tertiary">Creálos y quedan listos para la foto</span>
            </span>
            <span className="rounded-full bg-vip/15 px-2 py-1 text-micro font-bold text-vip">{nombresReportadosSinEjercicio.length}</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nombresReportadosSinEjercicio.map((nombre) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setCreando(nombre)}
                className="radius-control flex items-center gap-1 border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-text"
              >
                <Plus size={12} className="text-vip" /> {nombre}
              </button>
            ))}
          </div>
        </details>
      )}

      <button
        type="button"
        onClick={() => setCreando("")}
        className="radius-control flex h-10 w-full items-center justify-center gap-2 border border-dashed border-vip/40 text-caption font-semibold text-vip"
      >
        <Plus size={15} /> Agregar un ejercicio nuevo
      </button>

      {creando !== null && (
        <ModalEjercicioNuevo nombreInicial={creando} ejercicios={ejercicios} onCerrar={() => setCreando(null)} />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
          disabled={indice === 0}
          aria-label="Ejercicio anterior"
          className="radius-control grid size-9 shrink-0 place-items-center border border-border text-text-secondary disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-micro font-semibold text-text-secondary">
            {Math.min(indice + 1, cola.length)} de {cola.length}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-vip transition-[width]" style={{ width: `${((Math.min(indice, cola.length - 1) + 1) / cola.length) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIndice((i) => Math.min(cola.length - 1, i + 1))}
          disabled={indice >= cola.length - 1}
          aria-label="Ejercicio siguiente"
          className="radius-control grid size-9 shrink-0 place-items-center border border-border text-text-secondary disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <Input
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setIndice(0); }}
        placeholder="Ir a un ejercicio por nombre…"
        className="!py-2 text-caption"
      />

      {!busqueda && (
        <label className="flex items-center justify-center gap-2 text-micro text-text-tertiary">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => { setSoloPendientes(e.target.checked); setIndice(0); }} />
          Mostrar solo los que faltan o tienen reclamo
        </label>
      )}

      <FichaMesa
        key={actual.id}
        ejercicio={actual}
        usos={usosPorEjercicio[actual.id]?.cantidad ?? 0}
        reportes={reportesPorEjercicio[actual.id] ?? 0}
        nombresSugeridos={sugeridos}
        parecidos={parecidos}
        usosPorEjercicio={usosPorEjercicio}
        ejercicios={ejercicios}
        onListo={() => setIndice((i) => Math.min(cola.length - 1, i + 1))}
      />
    </div>
  );
}

const ESTADO_INICIAL_GALERIA: AgregarFotoGaleriaState = { error: null, ok: false };

/**
 * Historial y ángulos extra (instructivo Fase 3, §8.3) — otras fotos del
 * mismo ejercicio (se puede elegir cualquiera como portada sin perder las
 * demás) y clips de video que quedaron archivados al reemplazarlos (se
 * pueden restaurar, porque desde Fase 3 ya no se borran de Cloudflare). Vive
 * aparte de `ejercicio.fotoMiniaturaUrl`/`videoCloudflareUid` — esos dos
 * siguen siendo la única fuente que ve el alumno; esto es una capa nueva
 * encima, no un reemplazo.
 */
function GaleriaMultimediaEjercicio({ ejercicio }: { ejercicio: Ejercicio }) {
  const router = useRouter();
  const [datos, setDatos] = useState<{ fotosGaleria: ItemMultimedia[]; videosArchivados: ItemMultimedia[] } | null>(null);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [estadoGaleria, formActionGaleria, subiendoGaleria] = useActionState(agregarFotoGaleria, ESTADO_INICIAL_GALERIA);

  const cargar = useCallback(async () => {
    setDatos(await obtenerMultimediaDeEjercicio(ejercicio.id));
  }, [ejercicio.id]);

  useEffect(() => {
    // Carga de datos externa (Supabase), no sincronización de estado React
    // — el mismo caso que la documentación de la regla da como ejemplo de
    // uso correcto de useEffect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar, estadoGaleria.ok]);

  async function usarComoPortada(id: string) {
    setAccionEnCurso(id);
    setErrorAccion(null);
    const resultado = await elegirFotoPrincipal(id);
    if (!resultado.ok) setErrorAccion(resultado.error);
    setAccionEnCurso(null);
    await cargar();
    router.refresh();
  }

  async function quitar(id: string) {
    setAccionEnCurso(id);
    await quitarFotoGaleria(id);
    setAccionEnCurso(null);
    await cargar();
  }

  async function restaurar(id: string) {
    setAccionEnCurso(id);
    setErrorAccion(null);
    const resultado = await restaurarVideoArchivado(id);
    if (!resultado.ok) setErrorAccion(resultado.error);
    setAccionEnCurso(null);
    await cargar();
    router.refresh();
  }

  if (!datos) return null;
  if (datos.fotosGaleria.length === 0 && datos.videosArchivados.length === 0 && !subiendoGaleria) {
    return (
      <div className="space-y-2">
        <p className="text-caption font-semibold text-text">Otras fotos de este ejercicio</p>
        <form action={formActionGaleria}>
          <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
          <label className={`radius-control flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 border border-dashed border-border text-[11px] font-semibold text-text-secondary`}>
            <Plus size={13} /> Agregar otro ángulo
            <input
              type="file"
              name="foto"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="sr-only"
              onChange={(e) => e.target.form?.requestSubmit()}
            />
          </label>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-caption font-semibold text-text">Otras fotos de este ejercicio</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {datos.fotosGaleria.map((foto) => (
            <div key={foto.id} className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
              {foto.urlMiniatura && <Image src={foto.urlMiniatura} alt="" fill sizes="64px" className="object-cover" />}
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-black/70 p-0.5">
                <button
                  type="button"
                  onClick={() => void usarComoPortada(foto.id)}
                  disabled={accionEnCurso === foto.id}
                  aria-label="Usar como portada"
                  className="text-[9px] font-bold text-vip disabled:opacity-50"
                >
                  Usar
                </button>
                <span className="text-white/40">·</span>
                <button
                  type="button"
                  onClick={() => void quitar(foto.id)}
                  disabled={accionEnCurso === foto.id}
                  aria-label="Quitar foto"
                  className="text-[9px] font-bold text-error disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          <form action={formActionGaleria}>
            <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
            <label className="flex size-16 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-vip/40 text-vip">
              {subiendoGaleria ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
              <input
                type="file"
                name="foto"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                disabled={subiendoGaleria}
                className="sr-only"
                onChange={(e) => e.target.form?.requestSubmit()}
              />
            </label>
          </form>
        </div>
        {estadoGaleria.error && <p className="text-micro mt-1 text-error">{estadoGaleria.error}</p>}
      </div>

      {datos.videosArchivados.length > 0 && (
        <div>
          <p className="text-caption font-semibold text-text">Clips anteriores</p>
          <div className="mt-1.5 space-y-1.5">
            {datos.videosArchivados.map((video) => (
              <div key={video.id} className="radius-control flex items-center justify-between gap-2 border border-border bg-surface-2 p-2">
                <span className="text-micro text-text-tertiary">
                  Archivado el {video.archivadoEn ? new Date(video.archivadoEn).toLocaleDateString("es-AR") : "—"}
                </span>
                <button
                  type="button"
                  onClick={() => void restaurar(video.id)}
                  disabled={accionEnCurso === video.id}
                  className="flex items-center gap-1 text-[11px] font-bold text-vip disabled:opacity-50"
                >
                  <Undo2 size={12} /> Restaurar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {errorAccion && <p className="text-micro text-error">{errorAccion}</p>}
    </div>
  );
}

function ModalSubirFoto({
  ejercicio,
  fotoActual,
  todosLosEjercicios,
  versionAnteriorEn,
  onCerrar,
}: {
  ejercicio: Ejercicio;
  fotoActual: string | null;
  todosLosEjercicios: Ejercicio[];
  versionAnteriorEn: string | null;
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(subirFotoEjercicio, ESTADO_INICIAL_FOTO);
  const {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  } = useFotoInmediata();

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onCerrar, 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const imagenAMostrar = previa ?? fotoActual;
  const [panorama, setPanorama] = useState({ x: ejercicio.fotoPanoramaX, y: ejercicio.fotoPanoramaY });
  const [cuadrada, setCuadrada] = useState({ x: ejercicio.fotoCuadradaX, y: ejercicio.fotoCuadradaY });

  return (
    <Overlay onCerrar={onCerrar}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-card-title min-w-0 truncate text-text">{ejercicio.nombre}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      {versionAnteriorEn && (
        <div className="mb-3">
          <EditorFotoAnterior ejercicioId={ejercicio.id} versionAnteriorEn={versionAnteriorEn} />
        </div>
      )}

      {imagenAMostrar && !previaRota ? (
        <div className="space-y-3">
          <p className="text-caption text-text-secondary">
            Mueve la foto con el dedo. Cada formato guarda su propio centro.
          </p>
          <EncuadreArrastrable src={imagenAMostrar} nombre="Vista rectangular del alumno" formato="panorama" posicion={panorama} onChange={setPanorama} onError={() => setPreviaRota(true)} />
          <EncuadreArrastrable src={imagenAMostrar} nombre="Vista cuadrada del alumno" formato="cuadrado" posicion={cuadrada} onChange={setCuadrada} onError={() => setPreviaRota(true)} />
          <label className="radius-control flex h-10 w-full cursor-pointer items-center justify-center gap-2 border border-border text-caption font-semibold text-text">
            <Camera size={15} /> Elegir o tomar otra foto
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void elegirArchivo(f);
            }} />
          </label>
        </div>
      ) : (
        <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
          <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
            <Camera size={26} />
            <span className="text-caption">
              {previaRota
                ? "No se pudo mostrar esta imagen. Elige una foto JPG, PNG o HEIC."
                : "Toca para elegir una foto"}
            </span>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="absolute inset-0 h-full w-full opacity-0" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void elegirArchivo(f);
          }} />
        </label>
      )}
      <div className="relative">
        {/* Estado de la preparación y subida directa a Storage. */}
        {(subiendoFoto || fotoSubida || errorFoto) && (
          <span
            className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
              errorFoto ? "bg-error/80 text-white" : "bg-black/60 text-white"
            }`}
          >
            {subiendoFoto ? "Preparando foto..." : errorFoto ? "No se pudo subir" : "✓ Lista para guardar"}
          </span>
        )}
      </div>
      {errorFoto && (
        <button
          type="button"
          onClick={reintentar}
          className="text-caption mt-1 font-medium text-vip"
        >
          Reintentar subir la foto
        </button>
      )}

      <form
        action={(fd) => {
          if (fotoSubida) {
            fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
            fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
            fd.set("foto_hash_cliente", fotoSubida.hash);
          }
          fd.set("ejercicio_id", ejercicio.id);
          formAction(fd);
        }}
        className="mt-3 space-y-2"
      >
        <input type="hidden" name="foto_panorama_x" value={panorama.x} />
        <input type="hidden" name="foto_panorama_y" value={panorama.y} />
        <input type="hidden" name="foto_cuadrada_x" value={cuadrada.x} />
        <input type="hidden" name="foto_cuadrada_y" value={cuadrada.y} />
        {/* Alternativa para una imagen que ya está publicada en otro sitio. */}
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        {/* Corrección global explícita: esto reemplaza la foto para TODOS
            los alumnos que tengan este ejercicio bien vinculado, no solo
            para quien lo esté editando ahora — hay que dejarlo claro antes
            de guardar, no después. */}
        <p className="text-caption text-text-tertiary">
          Se va a actualizar la foto de{" "}
          <span className="font-semibold text-text">{ejercicio.nombre}</span> para todos los alumnos
          que lo tengan bien vinculado.
        </p>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Foto actualizada — ya la ven los alumnos.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || subiendoFoto || (!!archivoElegido && !fotoSubida)}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Guardando..." : subiendoFoto ? "Preparando la foto..." : "Guardar foto y encuadres"}
        </button>
      </form>

      <div className="mt-4 border-t border-border pt-3">
        <GaleriaMultimediaEjercicio ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2">
          <p className="text-caption font-semibold text-text">Vista previa del alumno</p>
          <p className="text-micro text-text-tertiary">Mismo formato 16:9 del ejercicio activo</p>
        </div>
        <CuadroFotoReferencia
          ilustracionSlug={ejercicio.ilustracionSlug}
          fotoMiniaturaUrl={imagenAMostrar ?? ejercicio.fotoMiniaturaUrl}
          fotoCompletaUrl={imagenAMostrar ?? ejercicio.fotoCompletaUrl}
          videoUrl={ejercicio.videoUrl}
          videoCloudflareUid={ejercicio.videoCloudflareUid}
          videoCloudflareEstado={ejercicio.videoCloudflareEstado}
          videoCloudflareMiniaturaUrl={ejercicio.videoCloudflareMiniaturaUrl}
          nombre={ejercicio.nombre}
          ejercicioId={ejercicio.id}
          fotoPanoramaX={panorama.x}
          fotoPanoramaY={panorama.y}
          fotoCuadradaX={cuadrada.x}
          fotoCuadradaY={cuadrada.y}
          destacado
          reproducirAutomaticamente={ejercicio.videoCloudflareEstado === "listo"}
        />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorNombre ejercicio={ejercicio} />
      </div>

      <div className="mt-4 space-y-3 border-t border-border pt-3">
        <EditorClasificacion ejercicio={ejercicio} />
        <div className="border-t border-border pt-3">
          <EditorPatronMovimiento ejercicio={ejercicio} />
        </div>
        <EditorPerfilImpulso ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorDetalles ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorVideoAnterior ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorVideoCloudflare ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <UsosRutinaEditor ejercicio={ejercicio} todosLosEjercicios={todosLosEjercicios} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <BotonEliminar ejercicio={ejercicio} onEliminado={onCerrar} />
      </div>
    </Overlay>
  );
}

type ElegidoReasignar = { id: string; nombre: string };

const ESTADO_INICIAL_REASIGNAR = { error: null, ok: false };

/**
 * Para ESTE ejercicio de la biblioteca: todas las variantes de texto que hoy
 * usan su enlace en rutinas de alumnos (ver `obtenerUsosRutina`) — y deja
 * corregir un enlace mal hecho SIN tocar la foto de nadie (ver
 * `reasignarEntradaRutina` en actions.ts).
 *
 * Caso real que resuelve: "Press de hombro" quedó vinculado por error al
 * registro de "Press de banca" — acá aparece listado bajo Press de banca, y
 * se puede reasignar hacia el ejercicio correcto sin arriesgar la foto de
 * los alumnos que sí tienen el press de banca bien vinculado.
 */
function UsosRutinaEditor({
  ejercicio,
  todosLosEjercicios,
}: {
  ejercicio: Ejercicio;
  todosLosEjercicios: Ejercicio[];
}) {
  const [usos, setUsos] = useState<UsoRutina[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerUsosRutina(ejercicio.id).then((resultado) => {
      if (!cancelado) setUsos(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [ejercicio.id]);

  if (usos === null) {
    return <p className="text-caption text-text-tertiary">Revisando entradas de rutina...</p>;
  }
  if (usos.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-caption block text-text-tertiary">
        Entradas de rutina que usan esta ficha — si alguna en realidad es OTRO ejercicio, reasignala sin
        tocar esta foto
      </span>
      <div className="space-y-1.5">
        {usos.map((uso) => (
          <UsoRutinaFila
            key={uso.nombre}
            ejercicio={ejercicio}
            uso={uso}
            todosLosEjercicios={todosLosEjercicios}
            onReasignado={() => setUsos((prev) => (prev ? prev.filter((u) => u.nombre !== uso.nombre) : prev))}
          />
        ))}
      </div>
    </div>
  );
}

function UsoRutinaFila({
  ejercicio,
  uso,
  todosLosEjercicios,
  onReasignado,
}: {
  ejercicio: Ejercicio;
  uso: UsoRutina;
  todosLosEjercicios: Ejercicio[];
  onReasignado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<ElegidoReasignar | null>(null);
  const [state, formAction, pending] = useActionState(reasignarEntradaRutina, ESTADO_INICIAL_REASIGNAR);

  useEffect(() => {
    if (state.ok) onReasignado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return [];
    return todosLosEjercicios
      .filter((e) => e.id !== ejercicio.id)
      .filter((e) => normalizar(e.nombre).includes(q) || e.aliases.some((a) => normalizar(a).includes(q)))
      .slice(0, 6);
  }, [busqueda, todosLosEjercicios, ejercicio.id]);

  return (
    <div className="radius-control border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text">
          <span className="font-semibold">«{uso.nombre}»</span> — {uso.cantidad}{" "}
          {uso.cantidad === 1 ? "vez" : "veces"} en rutinas
        </p>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="shrink-0 text-[10px] font-medium text-vip"
          >
            ¿No es este?
          </button>
        )}
      </div>

      {abierto && !elegido && (
        <div className="mt-2 space-y-1.5">
          <input
            type="text"
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar el ejercicio correcto..."
            className="radius-control w-full border border-border bg-surface px-2 py-1.5 text-caption text-text"
          />
          {resultados.length > 0 && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setElegido({ id: r.id, nombre: r.nombre })}
                  className="block w-full rounded px-2 py-1.5 text-left text-caption text-text hover:bg-surface-2"
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setElegido({ id: "", nombre: "sin vincular todavía" })}
              className="text-[10px] text-text-tertiary underline"
            >
              No existe todavía — desvincular sin foto por ahora
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setBusqueda("");
              }}
              className="text-[10px] text-text-tertiary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {elegido && (
        <form action={formAction} className="radius-control mt-2 space-y-1.5 border border-vip/40 bg-vip/5 p-2">
          <input type="hidden" name="ejercicio_id_actual" value={ejercicio.id} />
          <input type="hidden" name="nombre_exacto" value={uso.nombre} />
          <input type="hidden" name="ejercicio_id_nuevo" value={elegido.id} />
          <p className="text-caption text-text">
            Se van a mover las {uso.cantidad} entrada{uso.cantidad === 1 ? "" : "s"} «{uso.nombre}» de{" "}
            <span className="font-semibold">{ejercicio.nombre}</span> hacia{" "}
            <span className="font-semibold">{elegido.nombre}</span>. No se toca ninguna foto.
          </p>
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="xsAuto" loading={pending}>
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="xsAuto" onClick={() => setElegido(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

const ESTADO_INICIAL_CREAR = { error: null, ok: false };

const GRUPOS: { valor: string; etiqueta: string }[] = [
  { valor: "pecho", etiqueta: "Pecho" },
  { valor: "espalda", etiqueta: "Espalda" },
  { valor: "piernas", etiqueta: "Piernas" },
  { valor: "hombros", etiqueta: "Hombros" },
  { valor: "brazos", etiqueta: "Brazos" },
  { valor: "core", etiqueta: "Core" },
  { valor: "cardio", etiqueta: "Cardio" },
];
const CATEGORIAS: { valor: string; etiqueta: string }[] = [
  { valor: "empuje", etiqueta: "Empuje" },
  { valor: "traccion", etiqueta: "Tracción" },
  { valor: "pierna", etiqueta: "Pierna" },
  { valor: "core", etiqueta: "Core" },
  { valor: "cardio", etiqueta: "Cardio" },
  { valor: "aislamiento", etiqueta: "Aislamiento" },
  { valor: "full_body", etiqueta: "Full body" },
];
const EQUIPOS: { valor: string; etiqueta: string }[] = [
  { valor: "barra", etiqueta: "Barra" },
  { valor: "mancuerna", etiqueta: "Mancuerna" },
  { valor: "polea", etiqueta: "Polea" },
  { valor: "maquina", etiqueta: "Máquina" },
  { valor: "smith", etiqueta: "Smith" },
  { valor: "peso_corporal", etiqueta: "Peso corporal" },
  { valor: "kettlebell", etiqueta: "Kettlebell" },
  { valor: "banda", etiqueta: "Banda" },
  { valor: "banco", etiqueta: "Banco" },
  { valor: "otro", etiqueta: "Otro" },
];

function ModalEjercicioNuevo({
  nombreInicial = "",
  archivoInicial,
  tipoInicial,
  ejercicios,
  onAbrirExistente,
  onCerrar,
}: {
  nombreInicial?: string;
  /** Foto o video ya elegido antes de abrir el modal — viene de una fila sin
   * coincidencia en Carga masiva (instructivo §4, "Crear ejercicio con este
   * material") para no obligar a elegir el archivo dos veces. */
  archivoInicial?: File;
  tipoInicial?: "imagen" | "video";
  ejercicios: Ejercicio[];
  onAbrirExistente?: (ejercicio: Ejercicio) => void;
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(crearEjercicioNuevo, ESTADO_INICIAL_CREAR);
  const [grupoNuevo, setGrupoNuevo] = useState("");
  const [nombre, setNombre] = useState(nombreInicial);
  // Mismo emparejador que usa la app real (alias, abreviaturas, veto por
  // músculo y por equipo) — no un comparador de texto suelto: ese proponía
  // "Hip Thrust con barra libre" para el press inclinado por compartir la
  // palabra "barra" (ver Mesa de trabajo). Se compara solo el primer nombre
  // escrito (antes de la "/"), que es lo único que ya se terminó de tipear.
  const posibleExistente = useMemo(() => {
    const primerNombre = nombre.split("/")[0]?.trim();
    if (!primerNombre || primerNombre.length < 3) return null;
    return emparejarEjercicio(primerNombre, ejercicios)?.ejercicio ?? null;
  }, [nombre, ejercicios]);
  const [aviso, setAviso] = useState(true);
  // Si cambia a qué ejercicio se parece lo que va escribiendo (o deja de
  // parecerse a nada), el aviso vuelve a mostrarse — descartarlo para "Hip
  // Thrust" no debería silenciarlo también para "Hack squat" si sigue
  // borrando y reescribiendo el nombre. Ajuste durante el render, sin
  // useEffect, comparando contra el último id ya visto.
  const [ultimoIdVisto, setUltimoIdVisto] = useState<string | null>(posibleExistente?.id ?? null);
  if ((posibleExistente?.id ?? null) !== ultimoIdVisto) {
    setUltimoIdVisto(posibleExistente?.id ?? null);
    setAviso(true);
  }
  const patronesVisibles = useMemo(() => {
    const etiquetasPorGrupo: Record<string, string[]> = {
      pecho: ["Pecho"],
      espalda: ["Espalda"],
      piernas: ["Pierna"],
      hombros: ["Hombros"],
      brazos: ["Bíceps", "Tríceps"],
      core: ["Otros"],
      cardio: ["Otros"],
    };
    const etiquetas = etiquetasPorGrupo[grupoNuevo] ?? [];
    return GRUPOS_PATRON
      .filter((grupo) => etiquetas.includes(grupo.etiqueta))
      .map((grupo) => ({
        ...grupo,
        opciones: grupo.etiqueta === "Otros"
          ? grupo.opciones.filter((opcion) => opcion.valor === grupoNuevo || opcion.valor === "otro")
          : grupo.opciones,
      }));
  }, [grupoNuevo]);
  const {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  } = useFotoInmediata();

  // Clip de Cloudflare elegido en el alta — no se sube todavía: hace falta el
  // id del ejercicio (recién existe después de crearEjercicioNuevo), igual
  // que el resto de la subida de video en esta pantalla (ver
  // EditorVideoCloudflare). Antes esto no existía: el modal solo aceptaba un
  // link y obligaba a crear, cerrar, volver a buscar el ejercicio y recién
  // ahí subir el clip (instructivo §7.5/§16, problema D).
  const [videoArchivo, setVideoArchivo] = useState<File | null>(null);
  const [errorVideo, setErrorVideo] = useState<string | null>(null);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const [progresoVideo, setProgresoVideo] = useState(0);
  const [videoTerminado, setVideoTerminado] = useState(false);
  const subidaVideoIniciada = useRef(false);

  async function elegirVideo(archivo: File) {
    setErrorVideo(null);
    if (archivo.size > 100 * 1024 * 1024) {
      setErrorVideo("El video supera el máximo de 100 MB.");
      return;
    }
    const duracion = await duracionVideo(archivo);
    if (duracion !== null && duracion > 30.5) {
      setErrorVideo("El clip debe durar 30 segundos o menos.");
      return;
    }
    setVideoArchivo(archivo);
  }

  useEffect(() => {
    if (!archivoInicial) return;
    // Precarga el archivo con el que se abrió el modal (viene de "Crear
    // ejercicio con este material" en Carga masiva) — no un ciclo de
    // sincronización con estado externo que cambie durante la vida del modal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void (tipoInicial === "video" ? elegirVideo(archivoInicial) : elegirArchivo(archivoInicial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subirVideoDelAlta(ejercicioId: string) {
    if (!videoArchivo) return;
    subidaVideoIniciada.current = true;
    setSubiendoVideo(true);
    setProgresoVideo(0);
    try {
      const inicio = await iniciarSubidaVideoCloudflare(ejercicioId, videoArchivo.size, videoArchivo.type);
      if (!inicio.ok) {
        setErrorVideo(inicio.error);
        return;
      }
      await subirDirectoCloudflare(inicio.endpoint, videoArchivo, setProgresoVideo);
      await confirmarSubidaVideoCloudflare(ejercicioId);
    } catch {
      setErrorVideo("La subida del video se interrumpió. El ejercicio ya quedó creado — sube el clip de nuevo desde su ficha.");
    } finally {
      setSubiendoVideo(false);
      setVideoTerminado(true);
    }
  }

  useEffect(() => {
    // `crearEjercicioNuevo` puede devolver ok:true CON error (el ejercicio
    // se creó pero la foto falló) — cerrar solo si de verdad no quedó nada
    // pendiente de leer, si no el aviso de la foto parpadea menos de un
    // segundo y el entrenador sigue creyendo que la subió.
    if (!state.ok || state.error) return;
    // Si hay un clip elegido, todavía no se subió — se sube recién ahora que
    // ya existe el id del ejercicio, y el modal espera a que termine (o
    // falle) antes de cerrarse solo.
    if (state.id && videoArchivo && !videoTerminado) {
      if (!subidaVideoIniciada.current) void subirVideoDelAlta(state.id);
      return;
    }
    const id = setTimeout(onCerrar, 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok, state.error, state.id, videoArchivo, videoTerminado]);

  return (
    <Overlay onCerrar={onCerrar}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-card-title text-text">Ejercicio nuevo</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      <form
        action={(fd) => {
          if (fotoSubida) {
            fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
            fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
            fd.set("foto_hash_cliente", fotoSubida.hash);
          }
          formAction(fd);
        }}
        className="space-y-3"
      >
        {/* La misma foto sirve como tarjeta cuadrada y vista ampliada. */}
      <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
          {previa && !previaRota ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPreviaRota(true)}
            />
          ) : (
            <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
              <Camera size={26} />
              <span className="text-caption">
                {previaRota
                  ? "No se pudo mostrar esta imagen. Elige una foto JPG, PNG o HEIC."
                  : "Foto (opcional, se puede subir después)"}
              </span>
            </span>
          )}
          {(subiendoFoto || fotoSubida || errorFoto) && (
            <span
              className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
                errorFoto ? "bg-error/80 text-white" : "bg-black/60 text-white"
              }`}
            >
              {subiendoFoto ? "Preparando foto..." : errorFoto ? "No se pudo subir" : "✓ Lista para guardar"}
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            // Ver comentario del mismo input en el modal de editar: sin
            // "capture" deja elegir entre cámara y galería.
            className="absolute inset-0 h-full w-full opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void elegirArchivo(f);
            }}
          />
        </label>
        {errorFoto && (
          <button type="button" onClick={reintentar} className="text-caption font-medium text-vip">
            Reintentar subir la foto
          </button>
        )}

        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">
            Nombre — separá variantes con &quot;/&quot; si se lo dicen distinto
          </span>
          <input
            name="nombre"
            type="text"
            required
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Ej: Press de pecho / Bench press / Press banca"
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          />
        </label>

        {posibleExistente && aviso && (
          <div className="radius-control space-y-1.5 border border-warning/45 bg-warning/10 p-2.5">
            <p className="text-caption text-text">
              Ya existe <strong className="text-warning">{posibleExistente.nombre}</strong> con este nombre o uno muy
              parecido. ¿Es el mismo ejercicio?
            </p>
            <div className="flex gap-2">
              {onAbrirExistente && (
                <Button type="button" size="xsAuto" onClick={() => onAbrirExistente(posibleExistente)}>
                  Sí, abrir ese
                </Button>
              )}
              <Button type="button" variant="ghost" size="xsAuto" onClick={() => setAviso(false)}>
                No, es distinto
              </Button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">
            Grupo muscular, categoría y equipo — opcional, se puede completar después desde Calidad
          </span>
          <select
            name="grupo_muscular"
            value={grupoNuevo}
            onChange={(evento) => setGrupoNuevo(evento.target.value)}
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="">Sin elegir todavía</option>
            {GRUPOS.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">
            Tipo de movimiento — evita ejercicios repetidos o grupos incompletos
          </span>
          <select
            name="patron_movimiento"
            disabled={!grupoNuevo}
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="">
              {grupoNuevo ? "Sin elegir todavía" : "Primero elige el grupo muscular"}
            </option>
            {patronesVisibles.map((grupo) => (
              <optgroup key={grupo.etiqueta} label={grupo.etiqueta}>
                {grupo.opciones.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="text-micro mt-1 block text-text-tertiary">
            Este dato llega directamente a Armar rutina y alimenta el Semáforo VIP.
          </span>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Categoría</span>
          <select
            name="categoria"
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="">Sin elegir todavía</option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Equipo</span>
          <select
            name="equipo"
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="">Sin elegir todavía</option>
            {EQUIPOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Nivel</span>
          <select name="nivel" defaultValue="intermedio" className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text">
            <option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
          </select>
        </label>

        <details className="radius-control border border-border bg-surface-2 p-2.5">
          <summary className="cursor-pointer text-caption font-semibold text-text">Detalles técnicos y video</summary>
          <div className="mt-2 space-y-2">
            <label className="block"><span className="text-micro text-text-tertiary">Descripción corta</span><Textarea name="descripcion_corta" rows={2} placeholder="Qué trabaja y para qué se usa" className="mt-1 text-caption" /></label>
            <label className="block"><span className="text-micro text-text-tertiary">Ejecución correcta</span><Textarea name="tecnica" rows={3} placeholder="Pasos para realizarlo correctamente" className="mt-1 text-caption" /></label>
            <label className="block"><span className="text-micro text-text-tertiary">Errores comunes · uno por línea</span><Textarea name="errores_comunes" rows={3} className="mt-1 text-caption" /></label>
            <label className="block"><span className="text-micro text-text-tertiary">Consejos · uno por línea</span><Textarea name="consejos" rows={3} className="mt-1 text-caption" /></label>
            <label className="block"><span className="text-micro text-text-tertiary">Video · YouTube o archivo enlazado</span><Input type="url" name="video_url" placeholder="https://…" className="mt-1 text-caption" /></label>
            <div>
              <span className="text-micro text-text-tertiary">O subí un clip directo — MP4, MOV o WebM · máx. 30 s y 100 MB</span>
              <label className={`radius-control mt-1 flex h-10 w-full items-center justify-center gap-2 border border-vip/40 text-caption font-semibold text-vip ${subiendoVideo ? "opacity-50" : "cursor-pointer"}`}>
                <Film size={16} />
                {subiendoVideo
                  ? `Subiendo ${progresoVideo}%`
                  : videoArchivo
                    ? videoTerminado ? "Clip listo" : videoArchivo.name
                    : "Elegir clip"}
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  disabled={subiendoVideo || videoTerminado}
                  className="sr-only"
                  onChange={(evento) => {
                    const archivo = evento.target.files?.[0];
                    if (archivo) void elegirVideo(archivo);
                    evento.target.value = "";
                  }}
                />
              </label>
              {errorVideo && <p className="text-micro mt-1 text-error">{errorVideo}</p>}
            </div>
          </div>
        </details>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> {subiendoVideo || (videoArchivo && !videoTerminado) ? "Ejercicio creado, subiendo el clip…" : "Ejercicio creado."}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || subiendoFoto || subiendoVideo || (!!archivoElegido && !fotoSubida)}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Creando..." : subiendoFoto ? "Esperando la foto..." : subiendoVideo ? `Subiendo clip ${progresoVideo}%` : "Crear ejercicio"}
        </button>
      </form>
    </Overlay>
  );
}
