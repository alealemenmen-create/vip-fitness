import { NOMBRE_METRICA, type ResultadoHistorico } from "@/lib/torneos/types";
import { formatFechaCorta } from "@/lib/date";
import { nombreAlumnoPublicado } from "@/lib/nombre";

/** Noticias de torneos ya cerrados: quién ganó, quién perdió y cuántos
 * puntos se transfirieron. Pública, la ve cualquier alumno. */
export function HistorialTorneos({ historial }: { historial: ResultadoHistorico[] }) {
  if (historial.length === 0) {
    return (
      <p className="text-caption text-text-tertiary">
        Todavía no se cerró ningún torneo. Cuando termine uno, el resultado va a aparecer acá.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {historial.map((t) => {
        const ordenados = [...t.resultados].sort((a, b) => a.puesto - b.puesto);
        const ganador = ordenados[0];
        const resto = ordenados.slice(1);

        return (
          <div key={t.torneoId} className="radius-card bg-surface-2 p-3">
            <p className="text-secondary font-semibold text-text">{t.nombre}</p>
            <p className="text-caption mb-2 text-text-tertiary">
              {NOMBRE_METRICA[t.metrica]} · {formatFechaCorta(t.fechaFin)}
            </p>

            <p className="text-secondary text-text">
              🏆 <span className="font-semibold">{nombreAlumnoPublicado(ganador.nombre)}</span> ganó{" "}
              <span className="font-semibold text-success">
                +{ganador.puntosDelta.toLocaleString("es-CL")}
              </span>
            </p>
            {resto.map((r) => (
              <p key={r.alumnoId} className="text-caption text-text-tertiary">
                {nombreAlumnoPublicado(r.nombre)}: {r.puntosDelta >= 0 ? "+" : ""}
                {r.puntosDelta.toLocaleString("es-CL")}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
