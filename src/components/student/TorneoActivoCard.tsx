"use client";

import { Swords, Check, X, Clock } from "lucide-react";
import { NOMBRE_METRICA, NOMBRE_MODALIDAD, type TorneoPublico } from "@/lib/torneos/types";
import { descripcionRepartoPremio } from "@/lib/torneos/puntos";
import { responderInvitacionTorneo } from "@/app/alumno/inicio/actions";
import { ApostarTorneo } from "./ApostarTorneo";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Recuadro de Inicio: TODOS los torneos abiertos se publican como noticia
 * para todos los alumnos (no hace falta ser invitado para verlos). Si el
 * alumno fue invitado y todavía no respondió, aparecen los botones de
 * aceptar/rechazar; si ya respondió o es solo espectador, se ve como
 * anuncio nomás. */
export function TorneoActivoCard({
  torneos,
  nombrePropio,
  miAlumnoId,
  miSaldo,
}: {
  torneos: TorneoPublico[];
  nombrePropio: string;
  miAlumnoId: string;
  miSaldo: number;
}) {
  if (torneos.length === 0) return null;

  return (
    <div className="space-y-2">
      {torneos.map((t) => (
        <TorneoCard
          key={t.id}
          torneo={t}
          nombrePropio={nombrePropio}
          miAlumnoId={miAlumnoId}
          miSaldo={miSaldo}
        />
      ))}
    </div>
  );
}

function formatCuentaRegresiva(fecha: string, hora: string | null): string {
  // Postgres puede devolver TIME como HH:MM o HH:MM:SS. Antes siempre se
  // agregaba ":00", produciendo HH:MM:SS:00 y una fecha inválida (NaN min).
  const horaNormalizada = hora ? hora.slice(0, 8) : "00:00:00";
  const objetivo = new Date(`${fecha}T${horaNormalizada}`);
  const ahora = new Date();
  const diffMs = objetivo.getTime() - ahora.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "";

  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

  if (dias > 0) return `${dias} día${dias === 1 ? "" : "s"}${horas > 0 ? ` ${horas} h` : ""}`;
  if (horas > 0) return `${horas} h`;
  const minutos = Math.floor((diffMs / (1000 * 60)) % 60);
  return `${minutos} min`;
}

function formatoValor(metrica: TorneoPublico["metrica"], valor: number, unidadManual: string | null): string {
  if (metrica === "progreso_vip") return `${Math.round(valor).toLocaleString("es-CL")} pts`;
  if (metrica === "asistencia") return `${Math.round(valor)} sesión${Math.round(valor) === 1 ? "" : "es"}`;
  if (metrica === "peso_baja" || metrica === "peso_sube") return `${valor.toFixed(1)} kg`;
  return `${valor.toLocaleString("es-CL", { maximumFractionDigits: 2 })}${unidadManual ? ` ${unidadManual}` : ""}`;
}

function TorneoCard({
  torneo: t,
  nombrePropio,
  miAlumnoId,
  miSaldo,
}: {
  torneo: TorneoPublico;
  nombrePropio: string;
  miAlumnoId: string;
  miSaldo: number;
}) {
  const rivales = t.participantes
    .filter((p) => p.nombre !== nombrePropio)
    .map((p) => nombreAlumnoPublicado(p.nombre));
  const faltaEmpezar = formatCuentaRegresiva(t.fechaInicio, t.horaInicio);
  const faltaTerminar = formatCuentaRegresiva(t.fechaFin, t.horaFin);
  const marcador = t.participantes
    .filter((participante) => participante.estado === "aceptado")
    .sort((a, b) => {
      if (a.resultadoValido !== b.resultadoValido) return a.resultadoValido ? -1 : 1;
      const valorA = a.valorActual ?? 0;
      const valorB = b.valorActual ?? 0;
      return t.menorEsMejor ? valorA - valorB : valorB - valorA;
    });
  const marcadorConPuesto = marcador.map((participante, indice) => {
    if (!participante.resultadoValido) return { ...participante, puesto: null };
    const anterior = indice > 0 ? marcador[indice - 1] : null;
    const empatado =
      anterior?.resultadoValido && anterior.valorActual === participante.valorActual;
    return {
      ...participante,
      puesto: empatado
        ? marcador
            .slice(0, indice)
            .findLastIndex((candidato) => candidato.valorActual !== participante.valorActual) + 2
        : indice + 1,
    };
  });

  return (
    <div className="ranked-casino-card ranked-torneo-card radius-card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords size={18} className="shrink-0 text-vip" />
          <p className="text-body font-bold text-text">{t.nombre}</p>
        </div>
        <p className="text-caption shrink-0 whitespace-nowrap font-semibold text-vip">
          Bolsa {t.puntosEnJuego.toLocaleString("es-CL")} pts
        </p>
      </div>

      <p className="text-micro mt-1 font-bold uppercase tracking-wide text-vip">
        {NOMBRE_MODALIDAD[t.modalidad]}
      </p>
      <p className="text-caption mt-1 text-text-secondary">{NOMBRE_METRICA[t.metrica]}</p>
      {t.descripcion && <p className="text-caption mt-1 text-text-secondary">{t.descripcion}</p>}
      {t.reglaPublica && (
        <div className="radius-control mt-2 border border-vip/25 bg-vip/5 px-3 py-2">
          <p className="text-micro font-semibold uppercase tracking-wide text-vip">Cómo se gana</p>
          <p className="text-caption mt-0.5 text-text">{t.reglaPublica}</p>
        </div>
      )}
      {/* Competir sigue sin costar nada: la bolsa la pone VIP Fitness. Lo que
          sí arriesga puntos propios es APOSTAR, y es voluntario — por eso la
          frase vieja ("nadie pierde puntos acumulados") ya no va sola. */}
      <p className="text-[9px] mt-2 leading-relaxed text-text-tertiary">
        {descripcionRepartoPremio(t.modalidad === "duelo" ? 2 : 3)} Competir no te cuesta puntos.
      </p>

      {t.participantes.length > 0 && (
        <p className="text-caption mt-1.5 text-text-secondary">
          {t.participantes
            .map(
              (p) =>
                `${nombreAlumnoPublicado(p.nombre)}${p.estado === "rechazado" ? " (declinó)" : ""}`
            )
            .join("  vs  ")}
        </p>
      )}

      {marcador.length > 0 && (
        <div className="mt-2 space-y-1">
          {marcadorConPuesto.map((participante) => (
            <div key={participante.alumnoId} className="radius-control flex items-center gap-2 bg-surface-2 px-3 py-2">
              <span className="text-micro w-4 font-bold text-vip">{participante.puesto ? `#${participante.puesto}` : "—"}</span>
              <span className="text-caption min-w-0 flex-1 truncate font-semibold text-text">
                {nombreAlumnoPublicado(participante.nombre)}
              </span>
              <span className={`text-caption font-bold ${participante.resultadoValido ? "text-vip" : "text-text-tertiary"}`}>
                {participante.resultadoValido && participante.valorActual !== null
                  ? formatoValor(t.metrica, participante.valorActual, t.unidadManual)
                  : "Sin marca"}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-caption mt-1 flex items-center gap-1 font-semibold text-text">
        <Clock size={12} />
        {faltaEmpezar ? `Empieza en ${faltaEmpezar}` : faltaTerminar ? `Quedan ${faltaTerminar}` : "En curso"}
      </p>

      {t.miEstado === "pendiente" && faltaEmpezar && (
        <div className="mt-3 flex gap-2">
          <form action={responderInvitacionTorneo} className="flex-1">
            <input type="hidden" name="torneo_id" value={t.id} />
            <input type="hidden" name="decision" value="aceptado" />
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-vip text-caption font-bold text-black"
            >
              <Check size={16} /> Aceptar
            </button>
          </form>
          <form action={responderInvitacionTorneo} className="flex-1">
            <input type="hidden" name="torneo_id" value={t.id} />
            <input type="hidden" name="decision" value="rechazado" />
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-caption font-bold text-text-secondary"
            >
              <X size={16} /> Rechazar
            </button>
          </form>
        </div>
      )}

      {t.miEstado === "pendiente" && !faltaEmpezar && (
        <p className="text-caption mt-2 text-text-tertiary">La invitación venció al comenzar la competencia.</p>
      )}

      {t.miEstado === "aceptado" && (
        <p className="text-caption mt-2 flex items-center gap-1 font-semibold text-vip">
          <Check size={14} /> Estás compitiendo{rivales.length > 0 ? ` contra ${rivales.join(", ")}` : ""}
        </p>
      )}

      <ApostarTorneo torneo={t} miSaldo={miSaldo} miAlumnoId={miAlumnoId} />
    </div>
  );
}
