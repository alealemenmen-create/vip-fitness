"use client";

import { useActionState, useState } from "react";
import { Trophy } from "lucide-react";
import { crearTorneo, type FormState } from "@/app/admin/torneos/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";

const initialState: FormState = { error: null, ok: false };

function ListaLado({
  titulo,
  name,
  alumnos,
}: {
  titulo: string;
  name: string;
  alumnos: { id: string; nombre: string }[];
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
              <input type="checkbox" name={name} value={a.id} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.nombre}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export function CrearTorneoForm({ alumnos }: { alumnos: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [metrica, setMetrica] = useState("asistencia");
  const [state, formAction, pending] = useActionState(crearTorneo, initialState);

  return (
    <div className="space-y-3">
      <Button onClick={() => setAbierto((v) => !v)}>
        <Trophy size={18} /> {abierto ? "Cancelar" : "Crear torneo nuevo"}
      </Button>

      {abierto && (
        <Card>
          {state.ok ? (
            <div className="space-y-2 text-center">
              <p className="text-body text-text">
                Torneo creado y publicado para todos los alumnos. Los invitados ya pueden aceptar
                o rechazar desde su Inicio.
              </p>
              <button onClick={() => setAbierto(false)} className="text-secondary font-medium text-vip">
                Cerrar
              </button>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE DEL TORNEO</label>
                <Input name="nombre" required placeholder="Ej: Reto de sentadillas de agosto" />
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">DESCRIPCIÓN (opcional)</label>
                <Textarea name="descripcion" rows={2} placeholder="Reglas, premio, contexto…" />
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">MÉTRICA</label>
                <Select name="metrica" value={metrica} onChange={(e) => setMetrica(e.target.value)}>
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
                  <Input name="fecha_inicio" type="date" required />
                </div>
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HORA (opcional)</label>
                  <Input name="hora_inicio" type="time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HASTA</label>
                  <Input name="fecha_fin" type="date" required />
                </div>
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HORA (opcional)</label>
                  <Input name="hora_fin" type="time" />
                </div>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">PUNTOS EN JUEGO</label>
                <Input name="puntos_en_juego" type="number" min="1" defaultValue={1000} required />
                <p className="text-caption mt-1 text-text-tertiary">
                  El que gana se los quita al que pierde (se descuentan de su ranking acumulado).
                </p>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">
                  QUIÉN COMPITE — de un lado y del otro (contrincante)
                </label>
                <p className="text-caption mb-2 text-text-tertiary">
                  Cada alumno elegido recibe la invitación en su Inicio y tiene que aceptarla para
                  competir de verdad.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ListaLado titulo="LADO A" name="lado_a" alumnos={alumnos} />
                  <ListaLado titulo="CONTRINCANTE" name="lado_b" alumnos={alumnos} />
                </div>
              </div>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" variant="success" loading={pending}>
                {pending ? "Creando…" : "Crear torneo"}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
