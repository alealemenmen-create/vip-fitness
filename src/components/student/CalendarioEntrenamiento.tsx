"use client";

import { Fragment, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Moon, Check, AlertTriangle, Eye } from "lucide-react";
import { iniciarSesion, cancelarYEmpezarOtroDia } from "@/app/alumno/entrenar/actions";
import type { NumeroCalendario, EstadoNumero, GrupoMuscular } from "@/app/alumno/entrenar/data";
import { FotoDiaEntrenamiento, ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import {
  SEMANAS_POR_MES,
  semanaDelMes,
  sesionDelMes,
  sesionesPorMes,
} from "@/lib/entrenamiento/ciclo-sesiones";

const COLOR_PUNTO: Record<EstadoNumero, string> = {
  no_iniciado: "transparent",
  en_progreso: "var(--color-acento-fuerte)",
  completado: "var(--color-success)",
};

/** Selector horizontal de días — mismo rol que "DAY 1 / REST" de la
 * referencia: el número es del calendario falso, no una fecha. */
function TiraDias({
  numeros,
  seleccionado,
  sesionesPorSemana,
  descansoDespuesDe,
  ultimoNumeroHecho,
  onSeleccionar,
}: {
  numeros: NumeroCalendario[];
  seleccionado: number;
  sesionesPorSemana: number;
  /** Ids de días de entrenamiento que en la rutina llevan un descanso
   * detrás. Se dibuja una luna finita entre medio, sin casillero ni número:
   * el descanso es una recomendación, no una sesión que haya que registrar. */
  descansoDespuesDe: string[];
  /** La última sesión que el alumno terminó de verdad, en toda la rutina — no
   * solo en esta semana. `null` si todavía no hizo ninguna. */
  ultimoNumeroHecho: number | null;
  onSeleccionar: (n: number) => void;
}) {
  return (
    <div className="-mx-1 flex gap-0.5 overflow-x-auto px-1">
      {numeros.map((n, indice) => {
        const activo = n.numero === seleccionado;
        const hecha = n.estado === "completado";
        const esUltimaHecha = hecha && n.numero === ultimoNumeroHecho;
        // Solo puede quedar en `true` para sesiones de descanso ya registradas
        // con la regla vieja: la rueda no vuelve a ofrecerlas. Se sigue
        // dibujando para no reescribir lo que el alumno ya hizo.
        const descanso = n.dia.tipo === "descanso";
        return (
          <Fragment key={n.numero}>
            <button
              onClick={() => onSeleccionar(n.numero)}
              className="radius-control flex min-w-0 flex-1 shrink-0 flex-col items-center gap-0.5 px-0.5 py-1.5 transition-colors duration-200 ease-in-out"
              style={{ background: activo ? "var(--color-acento-suave)" : "transparent" }}
            >
              {/* "ÚLTIMA" en vez de "SESIÓN" en la que acaba de hacer: es el
                  ancla para volver a ubicarse. "Acá es donde se pierden los
                  alumnos" — Alejandro. */}
              <span
                className={`text-[8px] leading-none ${
                  esUltimaHecha ? "font-bold text-success" : activo ? "text-acento-fuerte" : "text-text-tertiary"
                }`}
              >
                {descanso ? "DESC." : esUltimaHecha ? "ÚLTIMA" : "SESIÓN"}
              </span>
              <span
                className={`text-[12px] font-semibold leading-tight ${
                  hecha ? "text-success" : activo ? "text-text" : "text-text-secondary"
                }`}
              >
                {/* El número del MES, no el de la semana: en la semana 2 se
                    ven 4, 5 y 6, que es como el alumno cuenta lo que lleva. */}
                {descanso ? <Moon size={13} className="mt-0.5" /> : sesionDelMes(n.numero, sesionesPorSemana)}
              </span>
              {/* Un check y no un puntito de 4px: el punto verde no se
                  distinguía del gris de un vistazo, que es como se mira esta
                  tira. Las que no están hechas conservan el punto — un círculo
                  vacío al lado de un check se lee solo. */}
              {/* Alto fijo: el check mide más que el punto y sin esto los
                  casilleros quedaban a distinta altura entre sí. */}
              <span className="flex h-3 items-center justify-center">
                {hecha ? (
                  <Check
                    size={11}
                    strokeWidth={3.5}
                    className="text-success"
                    aria-label={esUltimaHecha ? "Última sesión hecha" : "Sesión hecha"}
                  />
                ) : (
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{
                      background: COLOR_PUNTO[n.estado],
                      border: n.estado === "no_iniciado" ? "1px solid var(--color-border)" : "none",
                    }}
                  />
                )}
              </span>
            </button>
            {/* No después del último: ahí el descanso ya se entiende solo
                (se acabó la semana) y una luna colgando al final se lee como
                si faltara algo. */}
            {!descanso && indice < numeros.length - 1 && descansoDespuesDe.includes(n.dia.id) && (
              <span
                className="flex shrink-0 items-center px-0.5 text-text-tertiary"
                title="Descanso recomendado"
                aria-label="Descanso recomendado"
              >
                <Moon size={10} />
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export function CalendarioEntrenamiento({
  numeros,
  pagina,
  seleccionInicial,
  proximoNumero,
  rutinaId,
  soloLectura = false,
  sesionesPorSemana,
  descansoDespuesDe,
  ultimoNumeroHecho,
  planNombre,
  planPausado,
  cupoAgotado,
}: {
  numeros: NumeroCalendario[];
  pagina: number;
  seleccionInicial: number;
  proximoNumero: number;
  rutinaId: string;
  soloLectura?: boolean;
  sesionesPorSemana: number;
  descansoDespuesDe: string[];
  ultimoNumeroHecho: number | null;
  planNombre: string | null;
  planPausado: boolean;
  cupoAgotado: boolean;
}) {
  const [seleccionado, setSeleccionado] = useState(seleccionInicial);
  const actual = numeros.find((n) => n.numero === seleccionado) ?? numeros[0];

  if (!actual) return null;

  const descanso = actual.dia.tipo === "descanso";
  // Mismo criterio que el chequeo server-side de `iniciarSesion`: solo cuenta
  // como "activo de verdad" un día con `estado === "en_progreso"` (ver
  // `enProgresoDeVerdad` en entrenar/data.ts) — una vista previa todavía
  // bloqueada no bloquea nada. Se calcula acá para poder ofrecer el modal de
  // elegir ANTES de mandar el formulario, en vez de redirigir en silencio.
  const conflicto =
    actual.estado === "no_iniciado"
      ? (numeros.find((n) => n.estado === "en_progreso" && n.numero !== actual.numero) ?? null)
      : null;
  const resumen = actual.dia.resumen;
  const grupos = resumen?.gruposMusculares ?? [];
  // Cardio va siempre al final, no por el orden en que se cargaron los
  // ejercicios: un día "Pecho + Bíceps" con una bicicleta de calentamiento al
  // principio no puede titularse "Cardio" solo porque esa fue la primera
  // fila. Si el día es puramente cardio, ahí sí es el título.
  const gruposPrincipales = grupos.filter((g) => g !== "cardio");
  const tieneCardio = grupos.includes("cardio");
  const gruposOrdenados = [...gruposPrincipales, ...(tieneCardio ? (["cardio"] as GrupoMuscular[]) : [])];
  const titulo = descanso
    ? "Descanso"
    : gruposPrincipales.length > 0
      ? gruposPrincipales.slice(0, 2).map((g) => ETIQUETAS_GRUPO_MUSCULAR[g]).join(" · ")
      : tieneCardio
        ? ETIQUETAS_GRUPO_MUSCULAR.cardio
        : actual.dia.nombre;
  const subtitulo = descanso
    ? (actual.dia.descripcion ?? "Día de recuperación")
    : gruposOrdenados.length > 0
      ? gruposOrdenados.map((g) => ETIQUETAS_GRUPO_MUSCULAR[g]).join(" · ")
      : actual.dia.nombre;

  return (
    <div className="space-y-2">
      {/* Navegación de semanas */}
      <div className="flex items-center justify-between">
        <Link
          href={`/alumno/entrenar?pagina=${Math.max(1, pagina - 1)}`}
          aria-label="Semana anterior"
          className="flex h-7 w-7 items-center justify-center text-text-tertiary"
        >
          <ChevronLeft size={18} />
        </Link>
        {/* "Semana 3 de 4 · 9 de 12 sesiones" en vez de "Semana 3": el alumno
            necesita ubicarse en el mes, no solo en la semana suelta. Pedido de
            Alejandro. */}
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
          Semana {semanaDelMes(pagina)} de {SEMANAS_POR_MES} ·{" "}
          {sesionDelMes(actual.numero, sesionesPorSemana)} de {sesionesPorMes(sesionesPorSemana)} sesiones
        </span>
        <Link
          href={`/alumno/entrenar?pagina=${pagina + 1}`}
          aria-label="Próxima semana"
          className="flex h-7 w-7 items-center justify-center text-text-tertiary"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      <TiraDias
        numeros={numeros}
        seleccionado={seleccionado}
        sesionesPorSemana={sesionesPorSemana}
        descansoDespuesDe={descansoDespuesDe}
        ultimoNumeroHecho={ultimoNumeroHecho}
        onSeleccionar={setSeleccionado}
      />

      {/* Tarjeta principal del día. `tarjeta-modelo-oscura` la mantiene en
          oscuro también con el tema claro — ver el porqué en globals.css. */}
      <div className="tarjeta-modelo-oscura tarjeta-entrenamiento-premium radius-card overflow-hidden bg-surface">
        <div className="relative flex min-h-[132px] flex-col justify-end overflow-hidden p-4">
          {descanso ? (
            <div className="pointer-events-none absolute right-4 top-3 opacity-30">
              <Moon size={72} className="text-text-tertiary" />
            </div>
          ) : (
            <FotoDiaEntrenamiento grupos={grupos} />
          )}

          <div className="relative">
            <p className="mb-0.5 text-[9px] tracking-[0.08em] text-text-tertiary">
              {actual.numero === proximoNumero
                ? `PRÓXIMA SESIÓN · SEMANA ${semanaDelMes(pagina)} DE ${SEMANAS_POR_MES}`
                : `SEMANA ${semanaDelMes(pagina)} · SESIÓN ${sesionDelMes(actual.numero, sesionesPorSemana)} DE ${sesionesPorMes(sesionesPorSemana)}`}
            </p>
            <h2 className="text-[26px] font-bold leading-none text-text">{titulo}</h2>
            <p className="mt-1 text-[11px] text-text-secondary">{subtitulo}</p>
          </div>
        </div>

        {/* Barra de datos duros, como en la referencia */}
        {resumen && (
          <div className="grid grid-cols-3 border-t border-border">
            <Dato valor={resumen.cantidadEjercicios} etiqueta="Ejercicios" />
            <Dato valor={resumen.cantidadSeries} etiqueta="Series" borde />
            <Dato valor={resumen.minutosEstimados} etiqueta="Minutos" />
          </div>
        )}

        {actual.estado === "completado" && (
          <div className="flex items-center justify-center gap-1.5 border-t border-border py-2 text-[9px] text-success">
            <Check size={14} /> Completado
          </div>
        )}

        <div className="border-t border-border p-2">
          {actual.estado === "no_iniciado" ? (
            soloLectura ? null : planPausado || cupoAgotado ? (
              <div className="radius-control border border-warning/40 bg-warning/10 px-3 py-3 text-center">
                <p className="text-[11px] font-semibold text-warning">
                  {planPausado ? "Plan pausado por tu entrenador" : "Sesiones mensuales completadas"}
                </p>
                <p className="mt-1 text-[9px] text-text-secondary">
                  {planPausado
                    ? "Tu progreso está guardado. Consulta al entrenador para reactivarlo."
                    : "Tu cupo se renueva automáticamente el próximo mes."}
                </p>
              </div>
            ) : (
              <BotonEmpezarDia actual={actual} descanso={descanso} rutinaId={rutinaId} conflicto={conflicto} />
            )
          ) : (
            <Link
              href={`/alumno/entrenar/sesion/${actual.sesionId}`}
              className={`radius-control flex h-12 w-full items-center justify-center gap-2 text-[13px] font-semibold ${
                actual.estado === "en_progreso"
                  ? "btn-accion"
                  : "border border-border text-text"
              }`}
            >
              {actual.estado === "en_progreso" ? "Continuar entrenamiento" : "Ver registro"}
              <ChevronRight size={20} />
            </Link>
          )}
        </div>
      </div>
      {planNombre && (
        <p className="text-center text-[9px] text-text-tertiary">
          {planNombre} · Semana {semanaDelMes(pagina)} de {SEMANAS_POR_MES} · sesión{" "}
          {sesionDelMes(actual.numero, sesionesPorSemana)} de {sesionesPorMes(sesionesPorSemana)}
        </p>
      )}
    </div>
  );
}

/**
 * Único botón para empezar/ver un día sin sesión todavía. El texto es "Ver
 * entrenamiento" a propósito y no "Iniciar" — ni siquiera tocándolo arranca
 * de verdad el cronómetro: crea la sesión y lleva a la pantalla de la
 * rutina, donde queda bloqueada hasta tocar "Iniciar rutina" ahí adentro
 * (ver sesion/[id]/page.tsx). El nombre no debe prometer un compromiso que
 * el botón no toma.
 *
 * Si hay OTRO día con un entrenamiento realmente activo, en vez de mandar el
 * formulario (que hoy redirigiría ahí en silencio) abre un modal para elegir:
 * seguir con el que está activo, o cancelarlo y empezar este.
 */
function BotonEmpezarDia({
  actual,
  descanso,
  rutinaId,
  conflicto,
}: {
  actual: NumeroCalendario;
  descanso: boolean;
  rutinaId: string;
  conflicto: NumeroCalendario | null;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <>
      <form
        action={iniciarSesion}
        className="space-y-2"
        onSubmit={(e) => {
          if (conflicto) {
            e.preventDefault();
            setModalAbierto(true);
          }
        }}
      >
        <input type="hidden" name="dia_id" value={actual.dia.id} />
        <input type="hidden" name="rutina_id" value={rutinaId} />
        <input type="hidden" name="numero_calendario" value={actual.numero} />
        <button
          type="submit"
          className="btn-accion boton-entrenar-pulso radius-control flex h-12 w-full items-center justify-center gap-2 text-[13px] font-semibold"
        >
          {descanso ? "Registrar día de descanso" : "Ver entrenamiento"}
          <ChevronRight size={20} />
        </button>
      </form>

      {modalAbierto &&
        conflicto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setModalAbierto(false)}
          >
            <div
              className="radius-card w-full max-w-sm space-y-3 bg-surface p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-vip" />
                <div>
                  <p className="text-body font-medium text-text">Tienes un entrenamiento activo</p>
                  <p className="text-caption mt-1 text-text-secondary">
                    El día {conflicto.numero} sigue en curso. ¿Quieres continuar ese, o cancelarlo
                    para empezar este?
                  </p>
                </div>
              </div>

              <Link
                href={`/alumno/entrenar/sesion/${conflicto.sesionId}`}
                className="btn-accion radius-control flex h-12 w-full items-center justify-center text-body font-semibold"
              >
                Continuar el activo
              </Link>

              {/* Mirar sin comprometerse. Antes las dos únicas salidas eran
                  seguir con el otro día o cancelarlo, así que para saber qué
                  traía este había que arrancarlo: "debería dejarme ver"
                  (Alejandro). Esta no crea sesión ni toca el cupo. */}
              <Link
                href={`/alumno/entrenar/dia/${actual.dia.id}`}
                className="radius-control flex h-12 w-full items-center justify-center gap-2 border border-border text-body font-medium text-text"
              >
                <Eye size={18} /> Ver qué toca este día
              </Link>

              <form action={cancelarYEmpezarOtroDia}>
                <input type="hidden" name="sesion_id_cancelar" value={conflicto.sesionId ?? ""} />
                <input type="hidden" name="dia_id" value={actual.dia.id} />
                <input type="hidden" name="rutina_id" value={rutinaId} />
                <input type="hidden" name="numero_calendario" value={actual.numero} />
                <button
                  type="submit"
                  className="radius-control flex h-12 w-full items-center justify-center border border-error/50 text-body font-medium text-error"
                >
                  Cancelar ese y empezar este
                </button>
              </form>

              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="radius-control flex h-11 w-full items-center justify-center text-caption font-medium text-text-tertiary"
              >
                Volver
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function Dato({ valor, etiqueta, borde = false }: { valor: number; etiqueta: string; borde?: boolean }) {
  return (
    <div className={`py-2 text-center ${borde ? "border-x border-border" : ""}`}>
      <p className="text-[18px] font-bold leading-none text-text">{valor}</p>
      <p className="mt-1 text-[8px] leading-none text-text-tertiary">{etiqueta}</p>
    </div>
  );
}
