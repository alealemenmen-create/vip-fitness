import { NOMBRE_METRICA, NOMBRE_MODALIDAD, type ResultadoHistorico } from "@/lib/torneos/types";
import { formatFechaCorta } from "@/lib/date";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Historial público de resultados y premios patrocinados por VIP Fitness. */
export function HistorialTorneos({ historial }: { historial: ResultadoHistorico[] }) {
  if (historial.length === 0) {
    return (
      <p className="text-caption text-text-tertiary">
        Todavía no finalizó ninguna competencia. Los resultados aparecerán aquí.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {historial.map((torneo) => {
        const ordenados = [...torneo.resultados].sort((a, b) => a.puesto - b.puesto);
        const ganador = ordenados[0];
        if (!ganador) return null;
        return (
          <div key={torneo.torneoId} className="ranked-trofeo-card radius-card p-3">
            <p className="text-secondary font-semibold text-text">{torneo.nombre}</p>
            <p className="text-caption mb-2 text-text-tertiary">
              {NOMBRE_MODALIDAD[torneo.modalidad]} · {NOMBRE_METRICA[torneo.metrica]} · {formatFechaCorta(torneo.fechaFin)}
            </p>
            <p className="text-secondary text-text">
              🏆 <span className="font-semibold">{nombreAlumnoPublicado(ganador.nombre)}</span>{" "}
              recibió <span className="font-semibold text-success">+{ganador.puntosDelta.toLocaleString("es-CL")}</span>
            </p>
            {ordenados.slice(1).map((resultado) => (
              <p key={resultado.alumnoId} className="text-caption text-text-tertiary">
                {nombreAlumnoPublicado(resultado.nombre)}: +{resultado.puntosDelta.toLocaleString("es-CL")}
                {resultado.valido === false ? " · sin resultado verificable" : ""}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
