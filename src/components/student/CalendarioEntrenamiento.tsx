"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Moon, Check, AlertTriangle, Play } from "lucide-react";
import { iniciarRutinaDesdeCalendario, cancelarYEmpezarOtroDia } from "@/app/alumno/entrenar/actions";
import type { NumeroCalendario, EstadoNumero, DiaVistaPrevia } from "@/app/alumno/entrenar/data";
import { FotoDiaEntrenamiento, ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { CuadroFotoReferencia } from "@/components/student/SesionEjercicioCard";
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
    <div className="tira-sesiones-entrenar -mx-1 flex gap-0.5 overflow-x-auto border-b border-white/[0.04] px-1 pb-1">
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
              data-estado={n.estado}
              data-activa={activo ? "true" : "false"}
              className="selector-sesion-item relative flex min-w-0 flex-1 shrink-0 flex-col items-center gap-0.5 px-0.5 py-1 transition-colors duration-200 ease-in-out"
              style={{ background: "transparent" }}
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
              <span className="flex h-2.5 items-center justify-center">
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
              {activo && <span className="absolute inset-x-2 -bottom-1 h-px bg-acento-fuerte" />}
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
  rutinaId,
  soloLectura = false,
  sesionesPorSemana,
  descansoDespuesDe,
  ultimoNumeroHecho,
  planNombre,
  planPausado,
  cupoAgotado,
  vistasPrevias,
}: {
  numeros: NumeroCalendario[];
  pagina: number;
  seleccionInicial: number;
  rutinaId: string;
  soloLectura?: boolean;
  sesionesPorSemana: number;
  descansoDespuesDe: string[];
  ultimoNumeroHecho: number | null;
  planNombre: string | null;
  planPausado: boolean;
  cupoAgotado: boolean;
  vistasPrevias: Record<string, NonNullable<DiaVistaPrevia>>;
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
  const vistaPrevia = vistasPrevias[actual.dia.id] ?? null;
  const grupos = resumen?.gruposMusculares ?? [];
  // Cardio va siempre al final, no por el orden en que se cargaron los
  // ejercicios: un día "Pecho + Bíceps" con una bicicleta de calentamiento al
  // principio no puede titularse "Cardio" solo porque esa fue la primera
  // fila. Si el día es puramente cardio, ahí sí es el título.
  const gruposPrincipales = grupos.filter((g) => g !== "cardio");
  const tieneCardio = grupos.includes("cardio");
  const titulo = descanso
    ? "Descanso"
    : gruposPrincipales.length > 0
      ? gruposPrincipales.slice(0, 2).map((g) => ETIQUETAS_GRUPO_MUSCULAR[g]).join(" · ")
      : tieneCardio
        ? ETIQUETAS_GRUPO_MUSCULAR.cardio
        : actual.dia.nombre;

  return (
    <div className="space-y-2.5">
      {/* Semana y sesiones quedan ancladas exactamente debajo del logo. El
          fondo de borde a borde evita que los ejercicios se transparenten al
          pasar por debajo durante el scroll. */}
      <div className="selector-sesiones-fijo sticky top-0 z-20 -mx-4 space-y-1 border-b border-white/[0.05] bg-bg/95 px-4 pb-1.5 pt-1 shadow-[0_10px_24px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        {/* Navegación de semanas */}
        <div className="flex items-center justify-between">
          <Link
            href={`/alumno/entrenar?pagina=${Math.max(1, pagina - 1)}`}
            aria-label="Semana anterior"
            className="flex h-7 w-7 items-center justify-center text-text-tertiary"
          >
            <ChevronLeft size={18} />
          </Link>
          {/* "Plan Élite · Semana 3 de 4 · 9 de 12 sesiones" en una sola línea
              centrada: pedido de Alejandro (2026-08-16), antes el nombre del
              plan vivía repetido debajo de la tarjeta de presentación. Sin
              nombre de plan, la línea de semana/sesiones queda igual que
              siempre. */}
          <span className="min-w-0 truncate text-center text-[9px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
            {planNombre && <>{planNombre} · </>}
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
      </div>

      {/* Tarjeta principal del día. `tarjeta-modelo-oscura` la mantiene en
          oscuro también con el tema claro — ver el porqué en globals.css. */}
      <div className="tarjeta-modelo-oscura tarjeta-entrenamiento-premium resumen-sesion-entrenar tarjeta-presentacion-compacta radius-card overflow-hidden bg-surface">
        {/* Un solo envoltorio directo: `.resumen-sesion-entrenar > *` fuerza
            `position: relative` en sus hijos directos (ver globals.css), así
            que la foto (que necesita quedar `absolute`) tiene que ser NIETA,
            no hija, de la tarjeta. Adentro sí ocupa la tarjeta entera —
            pedido de Alejandro (2026-08-16) para que la silueta se vea
            completa hasta abajo, detrás de la barra de Ejercicios/Series/
            Minutos, en vez de cortarse arriba de ella. */}
        <div className="relative">
          {descanso ? (
            <div className="pointer-events-none absolute right-4 top-3 opacity-30">
              <Moon size={72} className="text-text-tertiary" />
            </div>
          ) : (
            <FotoDiaEntrenamiento grupos={grupos} />
          )}

          <div className="relative z-10 flex min-h-[52px] flex-col justify-end px-3 py-1.5">
            {/* Sin eyebrow ("PRÓXIMA SESIÓN · SEMANA...") ni subtítulo
                repetido debajo del título: pedido de Alejandro (2026-08-16),
                esa información ya vive arriba del calendario de sesiones y
                el subtítulo repetía el mismo texto que el título. */}
            <h2 className="text-[20px] font-[750] leading-none tracking-[-0.035em] text-text">{titulo}</h2>
          </div>

          {/* Barra de datos duros, como en la referencia. Sin fondo propio:
              se deja ver al modelo detrás (pedido de Alejandro, 2026-08-16).
              `datos-sesion-entrenar` no es un fondo: es un velo negro que se
              va cerrando hacia abajo. El modelo se sigue viendo, pero "48
              Minutos" deja de caer sobre la piel iluminada del muslo, que era
              donde el número perdía contraste. */}
          {resumen && (
            <div className="datos-sesion-entrenar relative z-10 grid grid-cols-3 border-t border-white/[0.06]">
              <Dato valor={resumen.cantidadEjercicios} etiqueta="Ejercicios" />
              <Dato valor={resumen.cantidadSeries} etiqueta="Series" borde />
              <Dato valor={resumen.minutosEstimados} etiqueta="Minutos" />
            </div>
          )}

          {actual.estado === "completado" && (
            <div className="relative z-10 flex items-center justify-center gap-1.5 border-t border-white/[0.06] bg-surface py-2 text-[9px] text-success">
              <Check size={14} /> Completado
            </div>
          )}
        </div>
      </div>

      {actual.estado === "no_iniciado" && (planPausado || cupoAgotado) ? (
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
      ) : vistaPrevia ? (
        <ListaEjerciciosPrevia vista={vistaPrevia} />
      ) : null}

      {actual.estado === "completado" && actual.sesionId && (
        <Link href={`/alumno/entrenar/sesion/${actual.sesionId}`} className="radius-control flex h-11 w-full items-center justify-center border border-white/[0.09] text-caption font-semibold text-text-secondary">
          Ver registro de esta sesión
        </Link>
      )}

      {!soloLectura && !planPausado && !cupoAgotado && actual.estado !== "completado" && (
        <AccionEntrenamientoFija actual={actual} rutinaId={rutinaId} conflicto={conflicto} />
      )}
    </div>
  );
}

function ListaEjerciciosPrevia({ vista }: { vista: NonNullable<DiaVistaPrevia> }) {
  if (vista.tipo === "descanso") {
    return (
      <div className="radius-card border border-white/[0.08] bg-surface p-4 text-caption text-text-secondary">
        {vista.descripcion ?? "Día de recuperación."}
      </div>
    );
  }
  return (
    <section className="lista-vista-previa" aria-label="Ejercicios de la sesión seleccionada">
      <div className="lista-vista-previa-cabecera">
        <span>Lo que harás hoy</span>
        <span>{vista.ejercicios.length} ejercicios</span>
      </div>
      {vista.ejercicios.map((ejercicio, indice) => {
        const tecnicaAnterior = indice > 0 ? vista.ejercicios[indice - 1]?.tecnicaTipo : null;
        const tecnicaSiguiente = vista.ejercicios[indice + 1]?.tecnicaTipo ?? null;
        const tecnicaEncadenada = !!ejercicio.tecnicaTipo && (tecnicaAnterior === ejercicio.tecnicaTipo || tecnicaSiguiente === ejercicio.tecnicaTipo);
        return (
        <article
          key={ejercicio.id}
          data-tecnica={ejercicio.tecnicaTipo?.toLowerCase() ?? undefined}
          data-encadenado={tecnicaEncadenada ? "true" : "false"}
          className="ejercicio-vista-previa flex min-h-[78px] items-center gap-3 border-b border-white/[0.045] px-1.5 py-2.5 last:border-b-0"
        >
          <CuadroFotoReferencia
            ilustracionSlug={ejercicio.ilustracionSlug}
            fotoMiniaturaUrl={ejercicio.fotoMiniaturaUrl}
            fotoCompletaUrl={ejercicio.fotoCompletaUrl}
            videoUrl={ejercicio.videoUrl}
            videoCloudflareUid={ejercicio.videoCloudflareUid}
            videoCloudflareEstado={ejercicio.videoCloudflareEstado}
            videoCloudflareMiniaturaUrl={ejercicio.videoCloudflareMiniaturaUrl}
            nombre={ejercicio.nombre}
            diaEjercicioId={ejercicio.id}
            ejercicioId={ejercicio.ejercicioId}
            compacto
            tamanoCompacto={52}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-[#f3d889]">
              {ejercicio.orden}{ejercicio.grupoMuscular ? ` · ${ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular]}` : ""}
            </p>
            <p className="mt-0.5 truncate text-[15px] font-[650] leading-tight tracking-[-0.025em] text-text">{ejercicio.nombre}</p>
            {ejercicio.tecnicaTipo && (
              <span className="mt-1 inline-flex text-[8px] font-semibold uppercase tracking-[0.08em] text-[#ae8cff]">
                {ejercicio.tecnicaTipo}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold tracking-[-0.01em] text-text">{ejercicio.seriesProgramadas} × {ejercicio.repsProgramadas}</p>
            {ejercicio.descansoSegundos != null && (
              <p className="mt-1 text-[9px] text-text-tertiary">◷ {ejercicio.descansoSegundos}s</p>
            )}
          </div>
        </article>
        );
      })}
    </section>
  );
}

const suscribirSinCambios = () => () => {};

/** CTA único y fijo: al tocarlo crea e inicia la sesión en la misma acción. */
function AccionEntrenamientoFija({
  actual,
  rutinaId,
  conflicto,
}: {
  actual: NumeroCalendario;
  rutinaId: string;
  conflicto: NumeroCalendario | null;
}) {
  // paso 0: cerrado. paso 1: "tenés otra sesión activa, ¿continuar o cambiar?".
  // paso 2: confirmación extra antes de abandonarla de verdad — pedido de
  // Alejandro (2026-08-17), la misma acción no tiene vuelta atrás en
  // BotonIniciarRutinaFijo (ver ese componente) así que acá pide lo mismo.
  const [paso, setPaso] = useState<0 | 1 | 2>(0);
  const montado = useSyncExternalStore(suscribirSinCambios, () => true, () => false);
  if (!montado) return null;

  if (actual.estado === "en_progreso" && actual.sesionId) {
    return createPortal(
      <div className="fixed inset-x-0 bottom-[calc(var(--alto-nav-alumno,110px)+12px)] z-30 mx-auto w-full max-w-md px-4">
        <Link href={`/alumno/entrenar/sesion/${actual.sesionId}`} className="boton-iniciar-cristal-vip flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-[14px] font-bold tracking-[-0.02em]">
          Continuar rutina <ChevronRight size={17} />
        </Link>
      </div>,
      document.body
    );
  }

  return createPortal(
    <>
      <form
        action={iniciarRutinaDesdeCalendario}
        className="fixed inset-x-0 bottom-[calc(var(--alto-nav-alumno,110px)+12px)] z-30 mx-auto w-full max-w-md px-4"
        onSubmit={(e) => {
          if (conflicto) {
            e.preventDefault();
            setPaso(1);
          }
        }}
      >
        <input type="hidden" name="dia_id" value={actual.dia.id} />
        <input type="hidden" name="rutina_id" value={rutinaId} />
        <input type="hidden" name="numero_calendario" value={actual.numero} />
        <button
          type="submit"
          className="boton-iniciar-cristal-vip flex h-11 w-full items-center justify-center gap-2 rounded-[11px] text-[14px] font-bold tracking-[-0.02em] transition active:scale-[0.99]"
        >
          <Play size={17} strokeWidth={2.6} /> Iniciar rutina
        </button>
      </form>

      {paso > 0 &&
        conflicto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
            onClick={() => setPaso(0)}
          >
            <div
              className="radius-card w-full max-w-sm space-y-3 bg-surface p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {paso === 1 ? (
                <>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-vip" />
                    <div>
                      <p className="text-body font-medium text-text">Tienes un entrenamiento activo</p>
                      <p className="text-caption mt-1 text-text-secondary">
                        La sesión {conflicto.numero} sigue en curso. ¿Quieres continuar esa, o
                        cancelarla para empezar esta?
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/alumno/entrenar/sesion/${conflicto.sesionId}`}
                    className="btn-accion radius-control flex h-12 w-full items-center justify-center text-body font-semibold"
                  >
                    Continuar el activo
                  </Link>

                  <button
                    type="button"
                    onClick={() => setPaso(2)}
                    className="radius-control flex h-12 w-full items-center justify-center border border-error/50 text-body font-medium text-error"
                  >
                    Cancelar ese y empezar este
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaso(0)}
                    className="radius-control flex h-11 w-full items-center justify-center text-caption font-medium text-text-tertiary"
                  >
                    Volver
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-error" />
                    <div>
                      <p className="text-body font-medium text-text">¿Confirmas que quieres abandonarla?</p>
                      <p className="text-caption mt-1 text-text-secondary">
                        La sesión {conflicto.numero} va a quedar abandonada. Esto no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <form action={cancelarYEmpezarOtroDia}>
                    <input type="hidden" name="sesion_id_cancelar" value={conflicto.sesionId ?? ""} />
                    <input type="hidden" name="dia_id" value={actual.dia.id} />
                    <input type="hidden" name="rutina_id" value={rutinaId} />
                    <input type="hidden" name="numero_calendario" value={actual.numero} />
                    <input type="hidden" name="iniciar_ahora" value="true" />
                    <button
                      type="submit"
                      className="radius-control flex h-12 w-full items-center justify-center bg-error text-body font-semibold text-white"
                    >
                      Sí, abandonarla y empezar esta
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => setPaso(1)}
                    className="radius-control flex h-11 w-full items-center justify-center text-caption font-medium text-text-tertiary"
                  >
                    No, volver
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>,
    document.body
  );
}

function Dato({ valor, etiqueta, borde = false }: { valor: number; etiqueta: string; borde?: boolean }) {
  return (
    <div className={`py-1.5 text-center ${borde ? "border-x border-white/[0.045]" : ""}`}>
      <p className="text-[15px] font-[700] leading-none tracking-[-0.035em] text-text">{valor}</p>
      <p className="mt-1 text-[7px] font-medium leading-none tracking-[0.02em] text-text-tertiary">{etiqueta}</p>
    </div>
  );
}
