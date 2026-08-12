"use client";

import { useActionState, useState } from "react";
import { Trophy, Lock, Check, Trash2, Coins } from "lucide-react";
import {
  cargarResultadoManual,
  cerrarTorneo,
  eliminarTorneo,
  type FormState,
} from "@/app/admin/torneos/actions";
import { NOMBRE_METRICA, NOMBRE_MODALIDAD, type TorneoAdmin } from "@/lib/torneos/types";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
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
          <p className="text-caption font-semibold text-vip">{NOMBRE_MODALIDAD[torneo.modalidad]}</p>
          <p className="text-caption text-text-tertiary">{NOMBRE_METRICA[torneo.metrica]}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p className="text-caption text-text-tertiary">
            {torneo.fechaInicio} → {torneo.fechaFin}
          </p>
          <EliminarTorneoBoton torneoId={torneo.id} nombre={torneo.nombre} />
        </div>
      </div>

      {torneo.descripcion && <p className="text-secondary text-text-secondary">{torneo.descripcion}</p>}
      {torneo.reglaPublica && (
        <div className="radius-control bg-surface-2 px-3 py-2">
          <p className="text-micro font-semibold text-vip">REGLA PUBLICADA</p>
          <p className="text-caption mt-0.5 text-text-secondary">{torneo.reglaPublica}</p>
        </div>
      )}

      <p className="text-caption text-text-tertiary">
        Bolsa VIP: {torneo.puntosEnJuego.toLocaleString("es-CL")} puntos · {aceptados.length}/
        {torneo.participantes.length} aceptaron
      </p>

      <ApuestasDelPublico torneo={torneo} />

      {torneo.resultados ? (
        <div className="space-y-1 border-t border-border pt-3">
          {[...torneo.resultados]
            .sort((a, b) => a.puesto - b.puesto)
            .map((r) => (
              <div key={r.alumnoId} className="flex items-center justify-between gap-2">
                <p className="text-secondary text-text">
                  {r.puesto === 1 && "👑 "}
                  {nombreAlumnoPublicado(r.nombre)}
                  <span className="text-caption text-text-tertiary">
                    {r.valido === false
                      ? " · sin resultado"
                      : ` · ${r.valor}${torneo.unidadManual ? ` ${torneo.unidadManual}` : ""}`}
                  </span>
                </p>
                <p className="text-secondary shrink-0 font-semibold text-success">
                  +{r.puntosDelta.toLocaleString("es-CL")}
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

/**
 * Qué apostó el público y qué pagaría cada resultado.
 *
 * El entrenador tiene que poder ver esto ANTES de cerrar: son puntos que
 * salieron del saldo de los alumnos, no de la bolsa de VIP Fitness, y cuando
 * alguien pregunte "por qué me pagaron tanto" la respuesta tiene que estar a
 * la vista y no en la cabeza de nadie.
 *
 * El multiplicador es el del reparto pari-mutuel: el que acierta recupera lo
 * suyo y se lleva una parte de lo que pusieron los que fallaron, en proporción
 * a lo que arriesgó. Por eso "paga bolsa/apostado-a-ese": si todos apostaron
 * al mismo, paga 1,00× (se devuelve lo puesto y nadie gana nada).
 */
function ApuestasDelPublico({ torneo }: { torneo: TorneoAdmin }) {
  const { apuestas } = torneo;
  if (apuestas.cantidad === 0) {
    return (
      <p className="text-micro text-text-tertiary">
        El público todavía no apuesta en esta competencia.
      </p>
    );
  }

  const nombreDe = (alumnoId: string) =>
    nombreAlumnoPublicado(
      torneo.participantes.find((p) => p.alumnoId === alumnoId)?.nombre ?? "Alumno"
    );

  return (
    <div className="radius-control bg-surface-2 px-3 py-2">
      <p className="text-micro flex items-center gap-1.5 font-semibold text-vip">
        <Coins size={12} />
        APUESTAS DEL PÚBLICO · {apuestas.total.toLocaleString("es-CL")} pts entre{" "}
        {apuestas.cantidad}
        {apuestas.resueltas && " · YA REPARTIDAS"}
      </p>
      <div className="mt-1.5 space-y-0.5">
        {apuestas.porParticipante.map((p) => (
          <p key={p.alumnoId} className="text-caption text-text-secondary">
            {nombreDe(p.alumnoId)}: {p.total.toLocaleString("es-CL")} pts ({p.cantidad}){" "}
            <span className="text-text-tertiary">
              — si gana, paga {(apuestas.total / p.total).toFixed(2)}×
            </span>
          </p>
        ))}
      </div>
      {!apuestas.resueltas && (
        <p className="text-[9px] mt-1.5 leading-relaxed text-text-tertiary">
          Al cerrar se reparte solo. Si nadie acierta, si aciertan todos o si hay empate en el
          primer puesto, se devuelve todo lo apostado.
        </p>
      )}
    </div>
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
  const [valor, setValor] = useState(String(participante.resultadoManual ?? ""));

  /**
   * "Guardar" corría bien —la Server Action devolvía `{ ok: true }` y el
   * número quedaba guardado— pero no había NINGÚN aviso en pantalla, ni con
   * un flash de "Guardado" basado en `state.ok`: la action llama
   * `revalidatePath("/admin/torneos")`, y ese refresco reconstruye la fila
   * con los datos frescos del servidor apenas la action resuelve, así que
   * cualquier estado LOCAL (un flag que se prende con la respuesta) se perdía
   * casi al instante, antes de que se alcanzara a ver.
   *
   * En vez de pelear contra eso, la confirmación sale de `participante.
   * resultadoManual` — el mismo prop que ya se refresca solo con el
   * `revalidatePath` — comparado contra lo que hay tipeado en el campo. Sin
   * relojes ni banderas: si coinciden, es justamente porque el valor que se
   * ve en pantalla es el que quedó guardado en la base.
   */
  const guardado =
    participante.resultadoManual !== null &&
    valor.trim() !== "" &&
    Number(valor) === participante.resultadoManual;

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
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Resultado"
        className="w-28 py-2"
      />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Guardar
      </Button>
      {guardado && (
        <span className="flex shrink-0 items-center gap-1 text-caption text-success">
          <Check size={14} /> Guardado
        </span>
      )}
      {state.error && <p className="text-caption text-error">{state.error}</p>}
    </form>
  );
}

function CerrarTorneoBoton({ torneoId, listo }: { torneoId: string; listo: boolean }) {
  const [state, formAction, pending] = useActionState(cerrarTorneo, initialState);

  return (
    <form action={formAction} className="pt-1">
      <input type="hidden" name="torneo_id" value={torneoId} />
      <Button type="submit" variant="success" size="sm" disabled={!listo} loading={pending}>
        <Trophy size={16} /> Cerrar competencia y repartir la bolsa
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

/**
 * Para pruebas de error, no para deshacer una competencia jugada de verdad.
 * `confirm()` nativo como advertencia: mismo patrón que ya usa
 * `DocumentosManager` para borrar un archivo — aceptar sigue adelante,
 * cancelar no manda nada al servidor.
 */
function EliminarTorneoBoton({ torneoId, nombre }: { torneoId: string; nombre: string }) {
  const [state, formAction, pending] = useActionState(eliminarTorneo, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="torneo_id" value={torneoId} />
      <IconButton ariaLabel={`Eliminar ${nombre}`} type="submit" disabled={pending}>
        <Trash2 size={15} className="text-error" />
      </IconButton>
      {state.error && <p className="text-caption max-w-[120px] text-right text-error">{state.error}</p>}
    </form>
  );
}
