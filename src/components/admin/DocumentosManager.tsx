"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import {
  asignarDocumento,
  quitarAsignacion,
  eliminarDocumentoBiblioteca,
  reemplazarArchivo,
  type AccionState,
} from "@/app/admin/documentos/actions";
import {
  ETIQUETA_TIPO,
  type DocumentoBiblioteca,
  type AlumnoParaAsignar,
} from "@/lib/documentos/tipos";
import { SelectorAlumnos } from "@/components/admin/SelectorAlumnos";

const estadoAccion: AccionState = { error: null, ok: false };


export function DocumentosManager({
  documentos,
  alumnos,
}: {
  documentos: DocumentoBiblioteca[];
  alumnos: AlumnoParaAsignar[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-caption mb-2 text-text-tertiary">
          {documentos.length} {documentos.length === 1 ? "DOCUMENTO" : "DOCUMENTOS"}
        </p>
        {documentos.length === 0 ? (
          <Card>
            <p className="text-body text-text-secondary">
              Todavía no hay documentos. Los archivos que subas desde el perfil de un alumno
              aparecen aquí, y desde aquí puedes reenviarlos a quien quieras.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {documentos.map((d) => (
              <FilaDocumento
                key={d.id}
                documento={d}
                alumnos={alumnos}
                onCambio={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilaDocumento({
  documento,
  alumnos,
  onCambio,
}: {
  documento: DocumentoBiblioteca;
  alumnos: AlumnoParaAsignar[];
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reemplazo, accionReemplazar] = useActionState(reemplazarArchivo, estadoAccion);

  const asignadosIds = new Set(documento.asignaciones.map((a) => a.alumnoId));
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const correr = (fn: () => Promise<AccionState>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        setSeleccion(new Set());
        onCambio();
      }
    });
  };

  const eliminar = () => {
    // Borra el archivo para todos: conviene confirmarlo, no es reversible.
    if (!confirm(`¿Eliminar "${documento.nombreArchivo}" y quitarlo a todos sus alumnos?`)) return;
    correr(() => eliminarDocumentoBiblioteca(documento.id));
  };

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-2.5">
        <FileText size={20} className="mt-0.5 shrink-0 text-vip" />
        <div className="min-w-0 flex-1">
          <p className="text-secondary truncate font-semibold text-text">
            {documento.nombreArchivo}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill tone="vip">{ETIQUETA_TIPO[documento.tipo]}</Pill>
            <span className="text-caption text-text-tertiary">
              {documento.asignaciones.length === 0
                ? "Sin asignar"
                : `${documento.asignaciones.length} ${
                    documento.asignaciones.length === 1 ? "alumno" : "alumnos"
                  }`}
            </span>
          </div>
        </div>
        <IconButton ariaLabel="Eliminar documento" onClick={eliminar} disabled={pendiente}>
          <Trash2 size={16} className="text-error" />
        </IconButton>
      </div>

      {documento.asignaciones.length > 0 && (
        <p className="text-caption mt-2 text-text-secondary">
          {documento.asignaciones.map((a) => a.nombre).join(" · ")}
        </p>
      )}

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="text-caption mt-2 font-medium text-vip underline"
      >
        {abierto ? "Cerrar" : "Gestionar"}
      </button>

      {abierto && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <SelectorAlumnos
            alumnos={alumnos}
            seleccionados={seleccion}
            onCambiar={setSeleccion}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pendiente || seleccion.size === 0}
              onClick={() => correr(() => asignarDocumento(documento.id, [...seleccion]))}
            >
              Asignar
            </Button>
            <Button
              variant="outline"
              disabled={pendiente || seleccion.size === 0}
              onClick={() =>
                correr(() =>
                  quitarAsignacion(
                    documento.id,
                    // Quitar solo tiene sentido sobre quien lo tiene asignado.
                    [...seleccion].filter((id) => asignadosIds.has(id))
                  )
                )
              }
            >
              Quitar
            </Button>
          </div>

          <form action={accionReemplazar} className="space-y-2 border-t border-border pt-3">
            <input type="hidden" name="documento_id" value={documento.id} />
            <p className="text-caption text-text-secondary">
              Reemplazar el archivo (mantiene las asignaciones)
            </p>
            <input
              name="archivo"
              type="file"
              accept="application/pdf"
              className="text-caption w-full text-text-secondary"
            />
            {reemplazo.error && <p className="text-caption text-error">{reemplazo.error}</p>}
            <Button type="submit" variant="outline">
              Reemplazar archivo
            </Button>
          </form>

          {error && <p className="text-caption text-error">{error}</p>}
        </div>
      )}
    </Card>
  );
}
