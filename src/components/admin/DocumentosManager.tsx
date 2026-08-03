"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import {
  asignarDocumento,
  quitarAsignacion,
  eliminarDocumentoBiblioteca,
  reemplazarArchivo,
  obtenerUrlDescarga,
  type AccionState,
} from "@/app/admin/documentos/actions";
import type { DocumentoBiblioteca, AlumnoParaAsignar } from "@/lib/documentos/tipos";
import { SelectorAlumnos } from "@/components/admin/SelectorAlumnos";

const estadoAccion: AccionState = { error: null, ok: false };


/**
 * Historial en dos columnas, rutinas a la izquierda y dietas a la derecha:
 * separarlas por tipo evita tener que leer la etiqueta de cada fila para
 * saber qué es qué, que es lo único que distinguía antes a una lista mixta.
 */
export function DocumentosManager({
  documentos,
  alumnos,
}: {
  documentos: DocumentoBiblioteca[];
  alumnos: AlumnoParaAsignar[];
}) {
  const router = useRouter();
  const rutinas = documentos.filter((d) => d.tipo === "rutina");
  const dietas = documentos.filter((d) => d.tipo === "alimentacion");

  if (documentos.length === 0) {
    return (
      <div>
        <p className="text-caption mb-2 text-text-tertiary">HISTORIAL</p>
        <Card>
          <p className="text-body text-text-secondary">
            Todavía no hay documentos. Los archivos que subas arriba aparecen aquí.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <p className="text-caption mb-2 text-text-tertiary">HISTORIAL</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-caption text-text-tertiary">RUTINAS</p>
          {rutinas.length === 0 ? (
            <p className="text-caption text-text-tertiary">Sin rutinas todavía.</p>
          ) : (
            rutinas.map((d) => (
              <FilaDocumento
                key={d.id}
                documento={d}
                alumnos={alumnos}
                onCambio={() => router.refresh()}
              />
            ))
          )}
        </div>
        <div className="space-y-2">
          <p className="text-caption text-text-tertiary">DIETAS</p>
          {dietas.length === 0 ? (
            <p className="text-caption text-text-tertiary">Sin dietas todavía.</p>
          ) : (
            dietas.map((d) => (
              <FilaDocumento
                key={d.id}
                documento={d}
                alumnos={alumnos}
                onCambio={() => router.refresh()}
              />
            ))
          )}
        </div>
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
  const [descargando, setDescargando] = useState(false);
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

  /** El bucket es privado: no hay URL fija para poner en un `href`, hay que
   * pedir una firmada al tocar el nombre. Se abre en pestaña nueva para no
   * perder esta pantalla. */
  const descargar = async () => {
    setDescargando(true);
    try {
      const url = await obtenerUrlDescarga(documento.storagePath);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("No se pudo generar el link de descarga.");
    } finally {
      setDescargando(false);
    }
  };

  return (
    <Card className="p-2.5">
      <div className="flex items-start gap-2">
        <FileText size={16} className="mt-0.5 shrink-0 text-vip" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={descargar}
            disabled={descargando}
            aria-label={`Descargar ${documento.nombreArchivo}`}
            className="text-caption block w-full truncate text-left font-semibold text-text underline decoration-text-tertiary underline-offset-2"
          >
            {descargando ? "Abriendo…" : documento.nombreArchivo}
          </button>
          <span className="text-micro text-text-tertiary">
            {documento.asignaciones.length === 0
              ? "Sin asignar"
              : `${documento.asignaciones.length} ${
                  documento.asignaciones.length === 1 ? "alumno" : "alumnos"
                }`}
          </span>
        </div>
        <IconButton ariaLabel="Eliminar documento" onClick={eliminar} disabled={pendiente}>
          <Trash2 size={14} className="text-error" />
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
