"use client";

import { Swords, Check, X, Clock } from "lucide-react";
import { NOMBRE_METRICA, type TorneoPublico } from "@/lib/torneos/types";
import { responderInvitacionTorneo } from "@/app/alumno/inicio/actions";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Recuadro de Inicio: TODOS los torneos abiertos se publican como noticia
 * para todos los alumnos (no hace falta ser invitado para verlos). Si el
 * alumno fue invitado y todavía no respondió, aparecen los botones de
 * aceptar/rechazar; si ya respondió o es solo espectador, se ve como
 * anuncio nomás. */
export function TorneoActivoCard({ torneos, nombrePropio }: { torneos: TorneoPublico[]; nombrePropio: string }) {
  if (torneos.length === 0) return null;

  return (
    <div className="space-y-2">
      {torneos.map((t) => (
        <TorneoCard key={t.id} torneo={t} nombrePropio={nombrePropio} />
      ))}
    </div>
  );
}

function formatCuentaRegresiva(fecha: string, hora: string | null): string {
  const objetivo = new Date(`${fecha}T${hora ?? "00:00"}:00`);
  const ahora = new Date();
  const diffMs = objetivo.getTime() - ahora.getTime();
  if (diffMs <= 0) return "";

  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

  if (dias > 0) return `${dias} día${dias === 1 ? "" : "s"}${horas > 0 ? ` ${horas} h` : ""}`;
  if (horas > 0) return `${horas} h`;
  const minutos = Math.floor((diffMs / (1000 * 60)) % 60);
  return `${minutos} min`;
}

function TorneoCard({ torneo: t, nombrePropio }: { torneo: TorneoPublico; nombrePropio: string }) {
  const rivales = t.participantes
    .filter((p) => p.nombre !== nombrePropio)
    .map((p) => nombreAlumnoPublicado(p.nombre));
  const faltaEmpezar = formatCuentaRegresiva(t.fechaInicio, t.horaInicio);
  const faltaTerminar = formatCuentaRegresiva(t.fechaFin, t.horaFin);

  return (
    <div className="panel-vip-espejo radius-card px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Swords size={18} className="shrink-0 text-vip" />
          <p className="text-body font-bold text-text">{t.nombre}</p>
        </div>
        <p className="text-caption shrink-0 whitespace-nowrap font-semibold text-vip">
          {t.puntosEnJuego.toLocaleString("es-CL")} pts en juego
        </p>
      </div>

      <p className="text-caption mt-1 text-text-secondary">{NOMBRE_METRICA[t.metrica]}</p>

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

      <p className="text-caption mt-1 flex items-center gap-1 font-semibold text-text">
        <Clock size={12} />
        {faltaEmpezar ? `Empieza en ${faltaEmpezar}` : faltaTerminar ? `Quedan ${faltaTerminar}` : "En curso"}
      </p>

      {t.miEstado === "pendiente" && (
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

      {t.miEstado === "aceptado" && (
        <p className="text-caption mt-2 flex items-center gap-1 font-semibold text-vip">
          <Check size={14} /> Estás compitiendo{rivales.length > 0 ? ` contra ${rivales.join(", ")}` : ""}
        </p>
      )}
    </div>
  );
}
