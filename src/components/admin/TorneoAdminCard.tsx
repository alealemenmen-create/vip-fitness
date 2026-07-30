"use client";

import { useActionState } from "react";
import { Trophy, Lock } from "lucide-react";
import { cargarResultadoManual, cerrarTorneo, type FormState } from "@/app/admin/torneos/actions";
import { NOMBRE_METRICA, type TorneoAdmin } from "@/lib/torneos/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { nombreAlumnoPublicado } from "@/lib/nombre";

const initialState: FormState = { error: null, ok: false };

const ETIQUETA_ESTADO: Record<TorneoAdmin["participantes"][number]["estado"], { texto: string; color: string }> = {
  pendiente: { texto: "esperando respuesta", color: "var(--color-text-tertiary)" },
  aceptado: { texto: "aceptó", color: "var(--color-success)" },
  rechazado: { texto: "rechazó", color: "var(--color-error)" },
};

export function TorneoAdminCard({ torneo }: { torneo: TorneoAdmin }) {
  const aceptados = torneo.participantes.filter((p) => p.estado === "aceptado");
  const listoParaCerrar =
    aceptados.length >= 2 &&
    (torneo.metrica !== "manual" || aceptados.every((p) => p.resultadoManual !== null));

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-card-title text-text">{torneo.nombre}</p>
          <p className="text-caption text-text-tertiary">{NOMBRE_METRICA[torneo.metrica]}</p>
        </div>
        <p className="text-caption shrink-0 text-text-tertiary">
          {torneo.fechaInicio} → {torneo.fechaFin}
        </p>
      </div>

      {torneo.descripcion && <p className="text-secondary text-text-secondary">{torneo.descripcion}</p>}

      <p className="text-caption text-text-tertiary">
        {torneo.puntosEnJuego.toLocaleString("es-CL")} puntos en juego · {aceptados.length}/
        {torneo.participantes.length} aceptaron
      </p>

      {torneo.resultados ? (
        <div className="space-y-1 border-t border-border pt-3">
          {[...torneo.resultados]
            .sort((a, b) => a.puesto - b.puesto)
            .map((r) => (
              <div key={r.alumnoId} className="flex items-center justify-between gap-2">
                <p className="text-secondary text-text">
                  {r.puesto === 1 && "👑 "}
                  {nombreAlumnoPublicado(r.nombre)}
                  <span className="text-caption text-text-tertiary"> · {r.valor}</span>
                </p>
                <p
                  className="text-secondary shrink-0 font-semibold"
                  style={{ color: r.puntosDelta >= 0 ? "var(--color-success)" : "var(--color-error)" }}
                >
                  {r.puntosDelta >= 0 ? "+" : ""}
                  {r.puntosDelta.toLocaleString("es-CL")}
                </p>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-2 border-t border-border pt-3">
          {torneo.participantes.map((p) => (
            <FilaParticipante key={p.alumnoId} torneoId={torneo.id} metrica={torneo.metrica} participante={p} />
          ))}

          <CerrarTorneoBoton torneoId={torneo.id} listo={listoParaCerrar} />
        </div>
      )}
    </Card>
  );
}

function FilaParticipante({
  torneoId,
  metrica,
  participante,
}: {
  torneoId: string;
  metrica: TorneoAdmin["metrica"];
  participante: TorneoAdmin["participantes"][number];
}) {
  const [state, formAction, pending] = useActionState(cargarResultadoManual, initialState);
  const estado = ETIQUETA_ESTADO[participante.estado];

  const nombreYEstado = (
    <p className="min-w-0 flex-1 truncate text-secondary text-text-secondary">
      {nombreAlumnoPublicado(participante.nombre)}{" "}
      <span className="text-caption" style={{ color: estado.color }}>
        · {estado.texto}
      </span>
    </p>
  );

  if (metrica !== "manual" || participante.estado !== "aceptado") {
    return <div className="flex items-center gap-2">{nombreYEstado}</div>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="torneo_id" value={torneoId} />
      <input type="hidden" name="alumno_id" value={participante.alumnoId} />
      {nombreYEstado}
      <Input
        name="valor"
        type="number"
        step="any"
        defaultValue={participante.resultadoManual ?? ""}
        placeholder="Resultado"
        className="w-28 py-2"
      />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Guardar
      </Button>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
    </form>
  );
}

function CerrarTorneoBoton({ torneoId, listo }: { torneoId: string; listo: boolean }) {
  const [state, formAction, pending] = useActionState(cerrarTorneo, initialState);

  return (
    <form action={formAction} className="pt-1">
      <input type="hidden" name="torneo_id" value={torneoId} />
      <Button type="submit" variant="destructive" size="sm" disabled={!listo} loading={pending}>
        <Trophy size={16} /> Cerrar torneo y repartir puntos
      </Button>
      {!listo && (
        <p className="text-caption mt-1.5 flex items-center gap-1 text-text-tertiary">
          <Lock size={12} /> Faltan aceptaciones o algún resultado manual.
        </p>
      )}
      {state.error && <p className="text-caption mt-1.5 text-error">{state.error}</p>}
    </form>
  );
}
