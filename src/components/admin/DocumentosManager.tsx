"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { FolderUp, FileText, Trash2, Users, Check, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import {
  subirYAsignarDocumento,
  asignarDocumento,
  quitarAsignacion,
  eliminarDocumentoBiblioteca,
  reemplazarArchivo,
  type SubirYAsignarState,
  type AccionState,
} from "@/app/admin/documentos/actions";
import { analizarRutinaPdf } from "@/app/admin/archivos/actions";
import { RutinaDraftEditor } from "@/components/admin/RutinaDraftEditor";
import {
  ETIQUETA_TIPO,
  type DocumentoBiblioteca,
  type AlumnoParaAsignar,
} from "@/lib/documentos/tipos";
import type { TipoDocumento } from "@/lib/supabase/types";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";

const estadoInicial: SubirYAsignarState = {
  error: null,
  storagePath: null,
  documentoId: null,
  asignados: 0,
  tipo: null,
  alumnoIds: [],
};

const estadoAccion: AccionState = { error: null, ok: false };

const TIPOS: TipoDocumento[] = ["rutina", "alimentacion", "otro"];

function BotonSubir({ cantidad }: { cantidad: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending
        ? "Subiendo…"
        : cantidad === 0
          ? "Subir a la biblioteca"
          : `Subir y asignar a ${cantidad} ${cantidad === 1 ? "alumno" : "alumnos"}`}
    </Button>
  );
}

/** Casillas de alumnos con atajo para marcar o desmarcar a todos. */
function SelectorAlumnos({
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
              {nombreCampo && marcado && (
                <input type="hidden" name={nombreCampo} value={a.id} />
              )}
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

export function DocumentosManager({
  documentos,
  alumnos,
}: {
  documentos: DocumentoBiblioteca[];
  alumnos: AlumnoParaAsignar[];
}) {
  const router = useRouter();
  const [subida, accionSubir] = useActionState(subirYAsignarDocumento, estadoInicial);
  const [tipo, setTipo] = useState<TipoDocumento>("rutina");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);

  // Análisis con IA del PDF recién subido. Se hace UNA vez y el resultado se
  // publica a todos los alumnos a los que se asignó el archivo, en vez de
  // repetir subida y análisis alumno por alumno.
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const [draft, setDraft] = useState<RutinaExtraida | null>(null);

  const analizar = async () => {
    if (!subida.storagePath) return;
    setAnalizando(true);
    setErrorAnalisis(null);
    const resultado = await analizarRutinaPdf(subida.storagePath);
    setAnalizando(false);
    if (!resultado.datos) {
      setErrorAnalisis(resultado.error);
      return;
    }
    setDraft(resultado.datos);
  };

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">SUBIR Y ASIGNAR</p>

        <form action={accionSubir} className="space-y-4">
          <div>
            <p className="text-caption mb-1.5 text-text-secondary">¿Qué tipo de documento es?</p>
            <div className="flex gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`radius-control flex-1 border px-3 py-2 text-secondary ${
                    tipo === t
                      ? "border-vip bg-surface-2 font-semibold text-text"
                      : "border-border text-text-secondary"
                  }`}
                >
                  {ETIQUETA_TIPO[t]}
                </button>
              ))}
            </div>
            <input type="hidden" name="tipo" value={tipo} />
          </div>

          <label
            htmlFor="pdf-biblioteca"
            className="radius-card flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border py-8"
          >
            <FolderUp size={22} className="text-text-secondary" />
            <span className="text-secondary text-center text-text-tertiary">
              Elige el archivo PDF
            </span>
            <input
              id="pdf-biblioteca"
              name="archivo"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setArchivoNombre(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          {archivoNombre && (
            <p className="text-secondary text-center text-text">{archivoNombre}</p>
          )}

          <SelectorAlumnos
            alumnos={alumnos}
            seleccionados={seleccionados}
            onCambiar={setSeleccionados}
            nombreCampo="alumno_ids"
          />

          {subida.error && <p className="text-caption text-error">{subida.error}</p>}
          {!subida.error && subida.documentoId && (
            <p className="text-caption text-success">
              Documento guardado
              {subida.asignados > 0
                ? ` y asignado a ${subida.asignados} ${subida.asignados === 1 ? "alumno" : "alumnos"}.`
                : ". Queda en la biblioteca para asignarlo cuando quieras."}
            </p>
          )}

          <BotonSubir cantidad={seleccionados.size} />
        </form>

        {/* Analizar la rutina con IA: solo si lo subido ES una rutina y quedó
            asignada a alguien. Sin alumnos no hay a quién publicársela. */}
        {subida.tipo === "rutina" && subida.storagePath && !draft && (
          <div className="mt-4 border-t border-border pt-4">
            {subida.alumnoIds.length === 0 ? (
              <p className="text-caption text-text-secondary">
                El PDF quedó en la biblioteca. Para generar la rutina con IA, vuelve a subirlo
                marcando a los alumnos, o asígnalo desde la biblioteca y créala desde su perfil.
              </p>
            ) : (
              <>
                <p className="text-caption mb-2 text-text-secondary">
                  La IA lee el PDF una sola vez y la rutina se publica a los{" "}
                  {subida.alumnoIds.length}{" "}
                  {subida.alumnoIds.length === 1 ? "alumno" : "alumnos"} que asignaste. Podrás
                  revisarla antes de confirmar.
                </p>
                <Button variant="outline" onClick={analizar} disabled={analizando}>
                  <Wand2 size={16} />
                  {analizando ? "Leyendo PDF…" : "Analizar la rutina con IA"}
                </Button>
              </>
            )}
            {errorAnalisis && <p className="text-caption mt-2 text-error">{errorAnalisis}</p>}
          </div>
        )}
      </Card>

      {draft && (
        <RutinaDraftEditor
          alumnoIds={subida.alumnoIds}
          draftInicial={draft}
          onDescartar={() => setDraft(null)}
        />
      )}

      <div>
        <p className="text-caption mb-2 text-text-tertiary">
          BIBLIOTECA · {documentos.length} {documentos.length === 1 ? "documento" : "documentos"}
        </p>
        {documentos.length === 0 ? (
          <Card>
            <p className="text-body text-text-secondary">
              Todavía no has subido ningún documento.
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
