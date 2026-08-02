"use client";

import { useActionState, useState } from "react";
import { Swords } from "lucide-react";
import { crearTorneo, type FormState } from "@/app/admin/torneos/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

const initialState: FormState = { error: null, ok: false };

function ListaLado({
  titulo,
  name,
  alumnos,
  seleccionado,
}: {
  titulo: string;
  name: string;
  alumnos: { id: string; nombre: string }[];
  seleccionado?: string;
}) {
  return (
    <div>
      <p className="text-caption mb-1 font-semibold text-vip">{titulo}</p>
      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl bg-surface-2 p-1.5">
        {alumnos.length === 0 ? (
          <p className="text-caption p-2 text-text-tertiary">Sin alumnos.</p>
        ) : (
          alumnos.map((a) => (
            <label key={a.id} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-caption text-text">
              <input type="checkbox" name={name} value={a.id} defaultChecked={a.id === seleccionado} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.nombre}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export type BorradorRetoIA = {
  nombre: string;
  descripcion: string;
  regla: string;
  modalidad: string;
  metrica: string;
  puntos: number;
  ladoA: string;
  ladoB: string;
  fechaInicio: string;
  fechaFin: string;
};

export function CrearTorneoForm({
  alumnos,
  borradorIA,
}: {
  alumnos: { id: string; nombre: string }[];
  borradorIA?: BorradorRetoIA | null;
}) {
  const [abierto, setAbierto] = useState(Boolean(borradorIA));
  const [modalidad, setModalidad] = useState(borradorIA?.modalidad ?? "duelo");
  const [metrica, setMetrica] = useState(borradorIA?.metrica ?? "asistencia");
  const [state, formAction, pending] = useActionState(crearTorneo, initialState);

  return (
    <div className="space-y-3">
      <Button onClick={() => setAbierto((v) => !v)}>
        <Swords size={18} /> {abierto ? "Cancelar" : "Crear competencia en Arena VIP"}
      </Button>

      {abierto && (
        <Card>
          {borradorIA && !state.ok && (
            <div className="mb-4 rounded-xl border border-vip/30 bg-vip/10 p-3">
              <p className="text-caption font-semibold text-vip">BORRADOR DEL ASISTENTE VIP</p>
              <p className="text-caption mt-1 text-text-secondary">
                Revisa participantes, fechas, regla y premio. La IA no puede publicarlo por ti.
              </p>
            </div>
          )}
          {state.ok ? (
            <div className="space-y-2 text-center">
              <p className="text-body text-text">
                Competencia publicada en Arena VIP. Los invitados ya pueden aceptar
                o rechazar desde su Inicio.
              </p>
              <button onClick={() => setAbierto(false)} className="text-secondary font-medium text-vip">
                Cerrar
              </button>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">MODALIDAD</label>
                <Select
                  name="modalidad"
                  value={modalidad}
                  onChange={(evento) => {
                    const nueva = evento.target.value;
                    setModalidad(nueva);
                    if (nueva === "copa_constancia") setMetrica("progreso_vip");
                  }}
                >
                  <option value="duelo">Duelo VIP · exactamente 2 alumnos</option>
                  <option value="reto_coach">Reto del Coach · ejercicio o meta oficial</option>
                  <option value="copa_constancia">Copa de Constancia · varios alumnos</option>
                </Select>
              </div>
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE DE LA COMPETENCIA</label>
                <Input name="nombre" required defaultValue={borradorIA?.nombre} placeholder="Ej: Reto de sentadillas de agosto" />
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">DESCRIPCIÓN (opcional)</label>
                <Textarea name="descripcion" rows={2} defaultValue={borradorIA?.descripcion} placeholder="Reglas, premio, contexto…" />
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">REGLA OFICIAL PARA GANAR</label>
                <Textarea
                  name="regla_publica"
                  rows={3}
                  required
                  defaultValue={borradorIA?.regla}
                  placeholder="Ej: Gana quien complete el mayor porcentaje de su rutina entre el lunes y el domingo."
                />
                <p className="text-caption mt-1 text-text-tertiary">
                  Todos la verán antes de aceptar y no podrá cambiarse después de comenzar.
                </p>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">MÉTRICA</label>
                <Select name="metrica" value={metrica} onChange={(e) => setMetrica(e.target.value)}>
                  <option value="progreso_vip">Más Puntos VIP obtenidos en el periodo</option>
                  <option value="asistencia">Más asistencia al gimnasio</option>
                  <option value="peso_baja">Mayor bajada de peso corporal</option>
                  <option value="peso_sube">Mayor subida de peso corporal</option>
                  <option value="manual">
                    Otra (repeticiones, peso levantado…) — la cargas tú al final
                  </option>
                </Select>
              </div>

              {metrica === "manual" && (
                <div className="space-y-3 rounded-xl bg-surface-2 p-3">
                  <div>
                    <label className="text-caption mb-1.5 block text-text-tertiary">
                      UNIDAD (opcional, para mostrar)
                    </label>
                    <Input name="unidad_manual" placeholder="Ej: repeticiones, kg, minutos…" />
                  </div>
                  <label className="flex items-center gap-2 text-secondary text-text">
                    <input type="checkbox" name="menor_es_mejor" className="h-4 w-4" />
                    Gana el número más bajo (ej. tiempo)
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">DESDE</label>
                  <Input name="fecha_inicio" type="date" defaultValue={borradorIA?.fechaInicio} required />
                </div>
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HORA (opcional)</label>
                  <Input name="hora_inicio" type="time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HASTA</label>
                  <Input name="fecha_fin" type="date" defaultValue={borradorIA?.fechaFin} required />
                </div>
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HORA (opcional)</label>
                  <Input name="hora_fin" type="time" />
                </div>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">BOLSA DE PREMIO VIP</label>
                <Input
                  key={modalidad}
                  name="puntos_en_juego"
                  type="number"
                  min={modalidad === "duelo" ? 300 : modalidad === "reto_coach" ? 500 : 1000}
                  max={modalidad === "duelo" ? 1000 : modalidad === "reto_coach" ? 3000 : 5000}
                  defaultValue={borradorIA?.puntos ?? (modalidad === "duelo" ? 500 : modalidad === "reto_coach" ? 1000 : 2500)}
                  required
                />
                <p className="text-caption mt-1 text-text-tertiary">
                  VIP Fitness aporta la bolsa. Nadie arriesga ni pierde puntos ya ganados.
                </p>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">
                  QUIÉN COMPITE — de un lado y del otro (contrincante)
                </label>
                <p className="text-caption mb-2 text-text-tertiary">
                  Cada alumno elegido recibe la invitación en su Inicio y tiene que aceptarla para
                  competir de verdad.{modalidad === "duelo" ? " Elige exactamente una persona en cada lado." : ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ListaLado titulo="LADO A" name="lado_a" alumnos={alumnos} seleccionado={borradorIA?.ladoA} />
                  <ListaLado titulo="CONTRINCANTE" name="lado_b" alumnos={alumnos} seleccionado={borradorIA?.ladoB} />
                </div>
              </div>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" variant="success" loading={pending}>
                {pending ? "Creando…" : "Publicar en Arena VIP"}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
