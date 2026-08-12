"use client";

import { useActionState, useState } from "react";
import { Coins, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apostarEnTorneo, type ApostarState } from "@/app/alumno/ranked/actions";
import {
  MINIMO_APUESTA,
  TOPE_APUESTA,
  estimarRetorno,
  type Apuesta,
} from "@/lib/torneos/apuestas";
import type { TorneoPublico } from "@/lib/torneos/types";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const estadoInicial: ApostarState = { error: null, ok: false };

/** Montos de un toque. El alumno igual puede escribir cualquier número. */
const ATAJOS = [10, 25, 50, 100, 200];

/**
 * La tribuna de Arena VIP: el que NO compite pone algo suyo por un favorito.
 *
 * Existe para resolver lo que dijo Alejandro — "hice un torneo y fue fome". Un
 * duelo entre dos personas le importa a dos personas; acá los otros 66 tienen
 * algo en juego y por eso miran.
 *
 * Muestra el retorno estimado con `estimarRetorno`, la misma función que se
 * probó aparte, y lo dice claramente: es una ESTIMACIÓN, porque cada apuesta
 * que entre después la mueve. Prometer un número fijo sería mentir.
 */
export function ApostarTorneo({
  torneo,
  miSaldo,
  miAlumnoId,
}: {
  torneo: TorneoPublico;
  miSaldo: number;
  miAlumnoId: string;
}) {
  const [state, formAction, pending] = useActionState(apostarEnTorneo, estadoInicial);
  const [porQuien, setPorQuien] = useState<string | null>(null);
  const [monto, setMonto] = useState<number>(ATAJOS[0]);

  const compiten = torneo.participantes.filter((p) => p.estado === "aceptado");
  const soyParticipante = torneo.participantes.some((p) => p.alumnoId === miAlumnoId);
  const { apuestas } = torneo;

  const nombreDe = (alumnoId: string) =>
    nombreAlumnoPublicado(
      torneo.participantes.find((p) => p.alumnoId === alumnoId)?.nombre ?? "Alumno"
    );

  // Cabecera de la bolsa: se ve siempre que haya algo apostado, aunque el que
  // mira no pueda apostar. Que se sepa cuánto hay en juego es medio chiste.
  const cabecera = apuestas.total > 0 && (
    <p className="text-caption flex items-center gap-1.5 font-semibold text-vip">
      <Coins size={14} />
      {apuestas.total.toLocaleString("es-CL")} pts apostados por {apuestas.cantidad}{" "}
      {apuestas.cantidad === 1 ? "compañero" : "compañeros"}
    </p>
  );

  const repartoActual = apuestas.porParticipante.length > 0 && (
    <div className="mt-1.5 space-y-1">
      {compiten.map((p) => {
        const suyo = apuestas.porParticipante.find((x) => x.alumnoId === p.alumnoId);
        const total = suyo?.total ?? 0;
        const porcentaje = apuestas.total > 0 ? Math.round((total / apuestas.total) * 100) : 0;
        return (
          <div key={p.alumnoId} className="flex items-center gap-2">
            <span className="text-micro w-24 shrink-0 truncate text-text-secondary">
              {nombreAlumnoPublicado(p.nombre)}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-vip" style={{ width: `${porcentaje}%` }} />
            </div>
            <span className="text-micro w-10 shrink-0 text-right font-semibold text-text">
              {porcentaje}%
            </span>
          </div>
        );
      })}
    </div>
  );

  // Ya apostó: se le muestra qué puso y por quién, y nada más. Una sola
  // apuesta por torneo (lo impone el índice único de la tabla).
  if (apuestas.miApuesta) {
    return (
      <div className="radius-control mt-2 border border-vip/25 bg-vip/5 px-3 py-2">
        {cabecera}
        <p className="text-caption mt-1 flex items-center gap-1.5 font-semibold text-text">
          <Check size={14} className="text-vip" />
          Apostaste {apuestas.miApuesta.puntos} pts por {nombreDe(apuestas.miApuesta.porAlumnoId)}
        </p>
        {repartoActual}
      </div>
    );
  }

  if (soyParticipante) {
    return (
      <div className="radius-control mt-2 border border-border bg-surface-2 px-3 py-2">
        {cabecera}
        <p className="text-micro mt-1 text-text-tertiary">
          Estás compitiendo: no puedes apostar en tu propia competencia.
        </p>
        {repartoActual}
      </div>
    );
  }

  if (!apuestas.abiertas) {
    return apuestas.total > 0 ? (
      <div className="radius-control mt-2 border border-border bg-surface-2 px-3 py-2">
        {cabecera}
        <p className="text-micro mt-1 flex items-center gap-1 text-text-tertiary">
          <Lock size={11} /> Las apuestas cerraron cuando empezó la competencia.
        </p>
        {repartoActual}
      </div>
    ) : null;
  }

  if (compiten.length < 2) {
    return (
      <p className="text-micro mt-2 text-text-tertiary">
        Las apuestas se abren cuando haya al menos dos competidores confirmados.
      </p>
    );
  }

  const sinSaldo = miSaldo < MINIMO_APUESTA;
  const maximo = Math.min(TOPE_APUESTA, miSaldo);
  // La estimación se calcula contra lo ya apostado, sumando la apuesta propia.
  const estimacion =
    porQuien && monto >= MINIMO_APUESTA
      ? estimarRetorno(apuestasComoLista(apuestas), porQuien, Math.min(monto, maximo))
      : null;

  return (
    <div className="radius-control mt-2 border border-vip/25 bg-vip/5 px-3 py-2.5">
      {cabecera}
      {repartoActual}

      {sinSaldo ? (
        <p className="text-micro mt-1.5 text-text-tertiary">
          Necesitas al menos {MINIMO_APUESTA} Puntos VIP para apostar. Entrena y vuelve.
        </p>
      ) : (
        <form action={formAction} className="mt-2 space-y-2">
          <input type="hidden" name="torneo_id" value={torneo.id} />
          <input type="hidden" name="por_alumno_id" value={porQuien ?? ""} />
          <input type="hidden" name="puntos" value={Math.min(monto, maximo)} />

          <p className="text-micro font-semibold uppercase tracking-wide text-vip">
            Apuesta por tu favorito
          </p>
          <div className="flex flex-wrap gap-1.5">
            {compiten.map((p) => (
              <button
                key={p.alumnoId}
                type="button"
                onClick={() => setPorQuien(p.alumnoId)}
                className={`radius-control px-2.5 py-1.5 text-caption font-semibold ${
                  porQuien === p.alumnoId
                    ? "bg-vip text-black"
                    : "border border-border bg-surface text-text-secondary"
                }`}
              >
                {nombreAlumnoPublicado(p.nombre)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {ATAJOS.filter((valor) => valor <= maximo).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setMonto(valor)}
                className={`radius-control px-2.5 py-1 text-caption font-bold ${
                  monto === valor
                    ? "bg-text text-bg"
                    : "border border-border bg-surface text-text-secondary"
                }`}
              >
                {valor}
              </button>
            ))}
            <span className="text-micro text-text-tertiary">
              Tienes {miSaldo.toLocaleString("es-CL")} pts
            </span>
          </div>

          {estimacion && (
            <p className="text-micro text-text-secondary">
              Si acierta, recuperas cerca de{" "}
              <strong className="text-vip">{estimacion.retornoEstimado} pts</strong> (
              {estimacion.multiplicador.toFixed(2)}×). Es una estimación: cambia con cada
              apuesta nueva que entre.
            </p>
          )}

          {state.error && <p className="text-caption text-error">{state.error}</p>}

          <Button
            type="submit"
            size="xsAuto"
            className="w-full"
            loading={pending}
            disabled={pending || !porQuien}
          >
            {porQuien
              ? `Apostar ${Math.min(monto, maximo)} pts por ${nombreDe(porQuien)}`
              : "Elige por quién apuestas"}
          </Button>
          <p className="text-[9px] leading-relaxed text-text-tertiary">
            Se descuenta de tus Puntos VIP al apostar. Si nadie acierta, si aciertan todos o si
            hay empate, se devuelve todo. Una sola apuesta por competencia.
          </p>
        </form>
      )}
    </div>
  );
}

/** El resumen que llega del servidor viene agregado por participante; la
 * estimación necesita una lista de apuestas. Los ids no importan para el
 * cálculo (solo los montos y por quién van), así que se sintetizan. */
function apuestasComoLista(apuestas: TorneoPublico["apuestas"]): Apuesta[] {
  return apuestas.porParticipante.map((p) => ({
    alumnoId: `agregado:${p.alumnoId}`,
    porAlumnoId: p.alumnoId,
    puntos: p.total,
  }));
}
