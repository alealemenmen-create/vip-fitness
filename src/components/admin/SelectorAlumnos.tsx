"use client";

import { Users, Check } from "lucide-react";
import type { AlumnoParaAsignar } from "@/lib/documentos/tipos";

/** Casillas de alumnos con atajo para marcar o desmarcar a todos.
 *
 * Vivía dentro de DocumentosManager; se sacó a su propio archivo para poder
 * usarlo también al subir la guía desde el perfil de un alumno. El componente
 * no cambió. */
export function SelectorAlumnos({
  alumnos,
  seleccionados,
  onCambiar,
  nombreCampo,
}: {
  alumnos: AlumnoParaAsignar[];
  seleccionados: Set<string>;
  onCambiar: (ids: Set<string>) => void;
  nombreCampo?: string;
}) {
  const todos = seleccionados.size === alumnos.length && alumnos.length > 0;

  const alternar = (id: string) => {
    const copia = new Set(seleccionados);
    if (copia.has(id)) copia.delete(id);
    else copia.add(id);
    onCambiar(copia);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-caption text-text-tertiary">
          <Users size={13} className="mr-1 inline" />
          {seleccionados.size} de {alumnos.length} seleccionados
        </p>
        <button
          type="button"
          onClick={() => onCambiar(todos ? new Set() : new Set(alumnos.map((a) => a.id)))}
          className="text-caption font-medium text-vip underline"
        >
          {todos ? "Ninguno" : "Todos"}
        </button>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {alumnos.map((a) => {
          const marcado = seleccionados.has(a.id);
          return (
            <label
              key={a.id}
              className={`radius-control flex cursor-pointer items-center gap-2 border px-3 py-2 ${
                marcado ? "border-vip bg-surface-2" : "border-border"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                  marcado ? "bg-vip" : "border border-border"
                }`}
              >
                {marcado && <Check size={12} strokeWidth={3} className="text-black" />}
              </span>
              <span className="text-secondary min-w-0 truncate text-text">{a.nombre}</span>
              {/* El formulario nativo necesita los valores en el DOM. */}
              {nombreCampo && marcado && <input type="hidden" name={nombreCampo} value={a.id} />}
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => alternar(a.id)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
