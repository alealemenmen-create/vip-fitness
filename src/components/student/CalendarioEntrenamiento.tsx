"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Moon, Check, AlertTriangle } from "lucide-react";
import { iniciarSesion, cancelarYEmpezarOtroDia } from "@/app/alumno/entrenar/actions";
import type { NumeroCalendario, EstadoNumero } from "@/app/alumno/entrenar/data";
import { FotoDiaEntrenamiento, ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";

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
  onSeleccionar,
}: {
  numeros: NumeroCalendario[];
  seleccionado: number;
  onSeleccionar: (n: number) => void;
}) {
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {numeros.map((n) => {
        const activo = n.numero === seleccionado;
        const descanso = n.dia.tipo === "descanso";
        return (
          <button
            key={n.numero}
            onClick={() => onSeleccionar(n.numero)}
            className="radius-control flex min-w-0 flex-1 shrink-0 flex-col items-center gap-0.5 px-1 py-2.5 transition-colors duration-200 ease-in-out"
            style={{ background: activo ? "var(--color-acento-suave)" : "transparent" }}
          >
            <span
              className={`text-caption leading-none ${activo ? "text-acento-fuerte" : "text-text-tertiary"}`}
            >
              {descanso ? "DESC." : "DÍA"}
            </span>
            <span
              className={`text-body font-semibold leading-tight ${activo ? "text-text" : "text-text-secondary"}`}
            >
              {descanso ? <Moon size={16} className="mt-0.5" /> : n.numero}
            </span>
            <span
              className="mt-0.5 h-1.5 w-1.5 rounded-full"
              style={{
                background: COLOR_PUNTO[n.estado],
                border: n.estado === "no_iniciado" ? "1px solid var(--color-border)" : "none",
              }}
            />
          </button>
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
}: {
  numeros: NumeroCalendario[];
  pagina: number;
  seleccionInicial: number;
  proximoNumero: number;
  rutinaId: string;
  soloLectura?: boolean;
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
  const titulo = descanso ? "Descanso" : (grupos[0] ? ETIQUETAS_GRUPO_MUSCULAR[grupos[0]] : actual.dia.nombre);
  const subtitulo = descanso
    ? (actual.dia.descripcion ?? "Día de recuperación")
    : grupos.length > 0
      ? grupos.map((g) => ETIQUETAS_GRUPO_MUSCULAR[g]).join(" · ")
      : actual.dia.nombre;

  return (
    <div className="space-y-4">
      {/* Navegación de semanas */}
      <div className="flex items-center justify-between">
        <Link
          href={`/alumno/entrenar?pagina=${Math.max(1, pagina - 1)}`}
          aria-label="Semana anterior"
          className="flex h-9 w-9 items-center justify-center text-text-tertiary"
        >
          <ChevronLeft size={22} />
        </Link>
        <span className="text-body font-semibold text-text">Semana {pagina}</span>
        <Link
          href={`/alumno/entrenar?pagina=${pagina + 1}`}
          aria-label="Próxima semana"
          className="flex h-9 w-9 items-center justify-center text-text-tertiary"
        >
          <ChevronRight size={22} />
        </Link>
      </div>

      <TiraDias numeros={numeros} seleccionado={seleccionado} onSeleccionar={setSeleccionado} />

      {/* Tarjeta principal del día. `tarjeta-modelo-oscura` la mantiene en
          oscuro también con el tema claro — ver el porqué en globals.css. */}
      <div className="tarjeta-modelo-oscura efecto-3d radius-card overflow-hidden bg-surface">
        <div className="relative flex min-h-[168px] flex-col justify-end overflow-hidden p-5">
          {descanso ? (
            <div className="pointer-events-none absolute right-4 top-3 opacity-30">
              <Moon size={72} className="text-text-tertiary" />
            </div>
          ) : (
            <FotoDiaEntrenamiento grupos={grupos} />
          )}

          <div className="relative">
            <p className="text-caption mb-1 text-text-tertiary">
              {actual.numero === proximoNumero ? "HOY TOCA" : `DÍA ${actual.numero}`}
            </p>
            <h2 className="text-h2 text-text">{titulo}</h2>
            <p className="text-secondary mt-1 text-text-secondary">{subtitulo}</p>
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
          <div className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-caption text-success">
            <Check size={14} /> Completado
          </div>
        )}

        <div className="border-t border-border p-3">
          {actual.estado === "no_iniciado" ? (
            soloLectura ? null : (
              <BotonEmpezarDia actual={actual} descanso={descanso} rutinaId={rutinaId} conflicto={conflicto} />
            )
          ) : (
            <Link
              href={`/alumno/entrenar/sesion/${actual.sesionId}`}
              className={`radius-control flex h-14 w-full items-center justify-center gap-2 text-body font-semibold ${
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
          className="btn-accion boton-entrenar-pulso radius-control flex h-14 w-full items-center justify-center gap-2 text-body font-semibold"
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
                  <p className="text-body font-medium text-text">Tenés un entrenamiento activo</p>
                  <p className="text-caption mt-1 text-text-secondary">
                    El día {conflicto.numero} sigue en curso. ¿Querés continuar ese, o cancelarlo
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
    <div className={`py-3.5 text-center ${borde ? "border-x border-border" : ""}`}>
      <p className="text-h3 text-text">{valor}</p>
      <p className="text-caption text-text-tertiary">{etiqueta}</p>
    </div>
  );
}
