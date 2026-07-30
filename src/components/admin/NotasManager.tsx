"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { guardarNota, eliminarNota, type FormState } from "@/app/admin/alumnos/actions";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type Nota = {
  id: string;
  texto: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  importante: boolean;
  marcar_nueva: boolean;
  leida_en: string | null;
  generado_con_ia: boolean;
  autor: "entrenador" | "alumno";
};

const initialState: FormState = { error: null, ok: false };

function NotaForm({
  alumnoId,
  nota,
  onGuardada,
  onCancelar,
}: {
  alumnoId: string;
  nota: Nota | null;
  onGuardada: () => void;
  onCancelar: () => void;
}) {
  const [state, formAction, pending] = useActionState(guardarNota, initialState);

  useEffect(() => {
    if (state.ok) onGuardada();
  }, [state.ok, onGuardada]);

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="alumno_id" value={alumnoId} />
        {nota && <input type="hidden" name="nota_id" value={nota.id} />}

        <Textarea
          name="texto"
          required
          rows={3}
          placeholder="Escribe la nota para el alumno…"
          defaultValue={nota?.texto ?? ""}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-caption mb-1.5 block text-text-tertiary">DESDE</label>
            <Input type="date" name="fecha_inicio" required defaultValue={nota?.fecha_inicio ?? hoy} />
          </div>
          <div>
            <label className="text-caption mb-1.5 block text-text-tertiary">HASTA (opcional)</label>
            <Input type="date" name="fecha_fin" defaultValue={nota?.fecha_fin ?? ""} />
          </div>
        </div>

        <label className="text-secondary flex items-center gap-2 text-text-secondary">
          <input type="checkbox" name="importante" value="true" defaultChecked={nota?.importante ?? false} />
          Marcar como importante
        </label>
        <label className="text-secondary flex items-center gap-2 text-text-secondary">
          <input
            type="checkbox"
            name="marcar_nueva"
            value="true"
            defaultChecked={nota?.marcar_nueva ?? true}
          />
          Mostrar etiqueta &quot;Nuevo&quot; al alumno
        </label>

        {state.error && <p className="text-caption text-error">{state.error}</p>}

        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="success" size="sm" loading={pending} className="flex-1">
            {pending ? "Guardando…" : "Guardar nota"}
          </Button>
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TarjetaNota({
  nota,
  alumnoId,
  onEditar,
}: {
  nota: Nota;
  alumnoId: string;
  onEditar: () => void;
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-body text-text">{nota.texto}</p>
        {nota.importante && <Pill tone="error">Importante</Pill>}
      </div>
      <p className="text-caption text-text-tertiary">
        {nota.fecha_inicio}
        {nota.fecha_fin ? ` → ${nota.fecha_fin}` : " → sin fecha final"}
        {nota.leida_en ? " · Leída" : " · No leída aún"}
      </p>
      <div className="flex gap-3">
        <button onClick={onEditar} className="text-secondary flex items-center gap-1 text-vip">
          <Pencil size={14} /> Editar
        </button>
        <form action={eliminarNota}>
          <input type="hidden" name="nota_id" value={nota.id} />
          <input type="hidden" name="alumno_id" value={alumnoId} />
          <button className="text-secondary flex items-center gap-1 text-error">
            <Trash2 size={14} /> Eliminar
          </button>
        </form>
      </div>
    </Card>
  );
}

export function NotasManager({ alumnoId, notasIniciales }: { alumnoId: string; notasIniciales: Nota[] }) {
  const [editando, setEditando] = useState<"nueva" | Nota | null>(null);

  const notasManuales = notasIniciales.filter((n) => !n.generado_con_ia);
  const notasIA = notasIniciales.filter((n) => n.generado_con_ia);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-caption text-text-tertiary">NOTAS DEL ENTRENADOR</p>
        {!editando && (
          <button
            onClick={() => setEditando("nueva")}
            className="text-secondary flex items-center gap-1 font-medium text-vip"
          >
            <Plus size={16} /> Nueva nota
          </button>
        )}
      </div>

      {editando && (
        <NotaForm
          alumnoId={alumnoId}
          nota={editando === "nueva" ? null : editando}
          onGuardada={() => setEditando(null)}
          onCancelar={() => setEditando(null)}
        />
      )}

      {notasManuales.length === 0 && !editando && (
        <p className="text-secondary text-text-tertiary">Este alumno todavía no tiene notas.</p>
      )}

      {!editando &&
        notasManuales.map((n) => (
          <TarjetaNota key={n.id} nota={n} alumnoId={alumnoId} onEditar={() => setEditando(n)} />
        ))}

      {notasIA.length > 0 && (
        <div className="space-y-3 pt-2">
          <p className="flex items-center gap-1.5 text-caption text-text-tertiary">
            <Sparkles size={13} className="text-vip" /> MENSAJES DE MOTIVACIÓN (IA)
          </p>
          {notasIA.map((n) => (
            <TarjetaNota key={n.id} nota={n} alumnoId={alumnoId} onEditar={() => setEditando(n)} />
          ))}
        </div>
      )}
    </div>
  );
}
