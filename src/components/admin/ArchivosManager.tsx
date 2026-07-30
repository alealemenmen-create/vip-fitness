"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { FolderUp, Wand2, FileText, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import {
  subirRutinaPdf,
  subirGuiaCompleta,
  analizarRutinaPdf,
  subirDocumentoAlimentacion,
  analizarAlimentacionPdf,
  eliminarDocumento,
  type SubirPdfState,
  type SubirDocumentoState,
  type AnalizarPlanState,
} from "@/app/admin/archivos/actions";
import { RutinaDraftEditor } from "@/components/admin/RutinaDraftEditor";
import { PlanAlimentacionEditor } from "@/components/admin/PlanAlimentacionEditor";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";

const initialUploadState: SubirPdfState = { error: null, storagePath: null };
const initialAlimentacionState: SubirDocumentoState = {
  error: null,
  ok: false,
  storagePath: null,
  documentoId: null,
};

type Documento = {
  id: string;
  alumno_id: string;
  tipo: "rutina" | "alimentacion";
  nombre_archivo: string;
  fecha_carga: string;
};

function ListaDocumentosExistentes({ documentos }: { documentos: Documento[] }) {
  const router = useRouter();
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (documentos.length === 0) return null;

  const eliminar = (id: string) => {
    setPendienteId(id);
    startTransition(async () => {
      await eliminarDocumento(id);
      setPendienteId(null);
      router.refresh();
    });
  };

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      {documentos.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-secondary truncate text-text">{d.nombre_archivo}</p>
            <p className="text-caption text-text-tertiary">
              {new Date(d.fecha_carga).toLocaleDateString("es-CL")}
            </p>
          </div>
          <IconButton
            ariaLabel="Eliminar documento"
            onClick={() => eliminar(d.id)}
            disabled={pendienteId === d.id}
          >
            <Trash2 size={16} className="text-error" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

function BotonSubir() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? "Subiendo…" : "Subir PDF"}
    </Button>
  );
}

export function ArchivosManager({
  alumnoId,
  documentos,
}: {
  alumnoId: string;
  documentos: Documento[];
}) {
  const documentosRutina = documentos.filter((d) => d.tipo === "rutina");
  const documentosAlimentacion = documentos.filter((d) => d.tipo === "alimentacion");
  const [uploadState, uploadAction] = useActionState(subirRutinaPdf, initialUploadState);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);

  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState<string | null>(null);
  const [draft, setDraft] = useState<RutinaExtraida | null>(null);

  // Guía completa: un solo PDF con rutina y dieta juntas.
  const [guiaState, guiaAction] = useActionState(subirGuiaCompleta, initialUploadState);
  const [guiaNombre, setGuiaNombre] = useState<string | null>(null);
  const [mostrarSeparado, setMostrarSeparado] = useState(false);

  const [alimentacionState, alimentacionAction] = useActionState(
    subirDocumentoAlimentacion,
    initialAlimentacionState
  );
  const [archivoAlimentacionNombre, setArchivoAlimentacionNombre] = useState<string | null>(null);
  const [analizandoPlan, setAnalizandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [analisisPlan, setAnalisisPlan] = useState<AnalizarPlanState | null>(null);

  const enviarAlimentacion = (formData: FormData) => {
    alimentacionAction(formData);
    setArchivoAlimentacionNombre(null);
  };

  const analizarPlan = async () => {
    if (!alimentacionState.storagePath) return;
    setAnalizandoPlan(true);
    setErrorPlan(null);
    const resultado = await analizarAlimentacionPdf(alimentacionState.storagePath);
    setAnalizandoPlan(false);
    if (!resultado.plan) {
      setErrorPlan(resultado.error);
      return;
    }
    setAnalisisPlan(resultado);
  };

  /** Lee la rutina del PDF con IA. Sirve igual para la guía completa y para el
   * PDF de rutina suelto: en los dos casos se extrae SOLO la rutina. */
  const analizar = async (storagePath: string | null) => {
    if (!storagePath) return;
    setAnalizando(true);
    setErrorAnalisis(null);
    const resultado = await analizarRutinaPdf(storagePath);
    setAnalizando(false);
    if (!resultado.datos) {
      setErrorAnalisis(resultado.error);
      return;
    }
    setDraft(resultado.datos);
  };

  return (
    <div className="space-y-4">
      {/* Camino principal: la guía tal como la arma el entrenador, con la
          rutina y la dieta en un mismo PDF. */}
      <Card>
        <p className="text-caption mb-1 text-text-tertiary">GUÍA DEL ALUMNO (UN SOLO PDF)</p>
        <p className="text-caption mb-3 text-text-secondary">
          Sube el PDF completo, con la rutina y la dieta juntas. Queda disponible para el alumno en
          Entrenar y en Comer. La IA lee solo la rutina para armar la lista de ejercicios; la dieta
          se adjunta tal cual, sin analizar.
        </p>

        {guiaState.storagePath ? (
          <div className="radius-control flex items-center gap-3 border border-border p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={20} className="text-vip" />
            </div>
            <div className="min-w-0">
              <p className="text-body truncate text-text">{guiaNombre ?? "Guía subida"}</p>
              <p className="text-caption text-success">Ya visible para el alumno</p>
            </div>
          </div>
        ) : (
          <form action={guiaAction} className="space-y-3">
            <input type="hidden" name="alumno_id" value={alumnoId} />
            <label
              htmlFor="pdf-guia"
              className="radius-card flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border py-8"
            >
              <FolderUp size={22} className="text-text-secondary" />
              <span className="text-secondary text-center text-text-tertiary">
                Elige el PDF de la guía
              </span>
              <input
                id="pdf-guia"
                name="archivo"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setGuiaNombre(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            {guiaNombre && <p className="text-secondary text-center text-text">{guiaNombre}</p>}
            {guiaState.error && <p className="text-caption text-error">{guiaState.error}</p>}
            <BotonSubir />
          </form>
        )}

        {guiaState.storagePath && !draft && (
          <Button
            variant="outline"
            onClick={() => analizar(guiaState.storagePath)}
            disabled={analizando}
            className="mt-3"
          >
            <Wand2 size={16} />
            {analizando ? "Leyendo PDF…" : "Analizar la rutina con IA"}
          </Button>
        )}

        {errorAnalisis && <p className="text-caption mt-2 text-error">{errorAnalisis}</p>}
      </Card>

      {draft && (
        <RutinaDraftEditor alumnoId={alumnoId} draftInicial={draft} onDescartar={() => setDraft(null)} />
      )}

      {/* Los dos formularios de siempre quedan como respaldo, para PDFs que
          traen solo una de las dos cosas o si la IA no logra leer la guía. */}
      {!mostrarSeparado ? (
        <button
          type="button"
          onClick={() => setMostrarSeparado(true)}
          className="text-caption w-full py-2 text-center text-text-tertiary underline"
        >
          Subir rutina y alimentación por separado
        </button>
      ) : (
        <SubidaPorSeparado
          alumnoId={alumnoId}
          documentosRutina={documentosRutina}
          documentosAlimentacion={documentosAlimentacion}
          uploadState={uploadState}
          uploadAction={uploadAction}
          archivoNombre={archivoNombre}
          setArchivoNombre={setArchivoNombre}
          analizando={analizando}
          onAnalizarRutina={() => analizar(uploadState.storagePath)}
          alimentacionState={alimentacionState}
          enviarAlimentacion={enviarAlimentacion}
          archivoAlimentacionNombre={archivoAlimentacionNombre}
          setArchivoAlimentacionNombre={setArchivoAlimentacionNombre}
          analizandoPlan={analizandoPlan}
          analizarPlan={analizarPlan}
          errorPlan={errorPlan}
        />
      )}

      {analisisPlan?.plan && (
        <PlanAlimentacionEditor
          alumnoId={alumnoId}
          documentoId={alimentacionState.documentoId}
          analisis={analisisPlan}
          onDescartar={() => setAnalisisPlan(null)}
        />
      )}
    </div>
  );
}

/** Los dos formularios originales (rutina y alimentación por separado), tal
 * como estaban antes de la guía unificada. Se conservan como respaldo. */
function SubidaPorSeparado({
  alumnoId,
  documentosRutina,
  documentosAlimentacion,
  uploadState,
  uploadAction,
  archivoNombre,
  setArchivoNombre,
  analizando,
  onAnalizarRutina,
  alimentacionState,
  enviarAlimentacion,
  archivoAlimentacionNombre,
  setArchivoAlimentacionNombre,
  analizandoPlan,
  analizarPlan,
  errorPlan,
}: {
  alumnoId: string;
  documentosRutina: Documento[];
  documentosAlimentacion: Documento[];
  uploadState: SubirPdfState;
  uploadAction: (formData: FormData) => void;
  archivoNombre: string | null;
  setArchivoNombre: (n: string | null) => void;
  analizando: boolean;
  onAnalizarRutina: () => void;
  alimentacionState: SubirDocumentoState;
  enviarAlimentacion: (formData: FormData) => void;
  archivoAlimentacionNombre: string | null;
  setArchivoAlimentacionNombre: (n: string | null) => void;
  analizandoPlan: boolean;
  analizarPlan: () => void;
  errorPlan: string | null;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">RUTINA DE ENTRENAMIENTO (PDF)</p>

        {uploadState.storagePath ? (
          <div className="radius-control flex items-center gap-3 border border-border p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={20} className="text-vip" />
            </div>
            <p className="text-body truncate text-text">{archivoNombre ?? "Archivo subido"}</p>
          </div>
        ) : (
          <form action={uploadAction} className="space-y-3">
            <input type="hidden" name="alumno_id" value={alumnoId} />
            <label
              htmlFor="pdf-rutina"
              className="radius-card flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border py-8"
            >
              <FolderUp size={22} className="text-text-secondary" />
              <span className="text-secondary text-center text-text-tertiary">
                Elige el PDF de la rutina
              </span>
              <input
                id="pdf-rutina"
                name="archivo"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setArchivoNombre(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            {archivoNombre && <p className="text-secondary text-center text-text">{archivoNombre}</p>}
            {uploadState.error && <p className="text-caption text-error">{uploadState.error}</p>}
            <BotonSubir />
          </form>
        )}

        {uploadState.storagePath && (
          <Button variant="outline" onClick={onAnalizarRutina} disabled={analizando} className="mt-3">
            <Wand2 size={16} />
            {analizando ? "Leyendo PDF…" : "Analizar PDF con IA y generar lista de ejercicios"}
          </Button>
        )}

        {/* El error del análisis y el editor de la rutina los muestra el
            componente padre, que es el dueño de ese estado. */}

        <ListaDocumentosExistentes documentos={documentosRutina} />
      </Card>

      <Card>
        <p className="text-caption mb-3 text-text-tertiary">PLAN DE ALIMENTACIÓN (PDF)</p>
        <form action={enviarAlimentacion} className="space-y-3">
          <input type="hidden" name="alumno_id" value={alumnoId} />
          <label
            htmlFor="pdf-alimentacion"
            className="radius-card flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border py-8"
          >
            <FolderUp size={22} className="text-text-secondary" />
            <span className="text-secondary text-center text-text-tertiary">
              Elige el PDF de alimentación
            </span>
            <input
              id="pdf-alimentacion"
              name="archivo"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setArchivoAlimentacionNombre(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          {archivoAlimentacionNombre && (
            <p className="text-secondary text-center text-text">{archivoAlimentacionNombre}</p>
          )}
          {alimentacionState.error && <p className="text-caption text-error">{alimentacionState.error}</p>}
          {alimentacionState.ok && !alimentacionState.error && (
            <p className="text-caption text-success">PDF subido correctamente.</p>
          )}
          <BotonSubir />
        </form>

        {alimentacionState.storagePath && (
          <Button variant="outline" onClick={analizarPlan} disabled={analizandoPlan} className="mt-3">
            <Wand2 size={16} />
            {analizandoPlan ? "Leyendo PDF…" : "Analizar PDF con IA y extraer la meta calórica"}
          </Button>
        )}

        {errorPlan && <p className="text-caption mt-2 text-error">{errorPlan}</p>}

        <ListaDocumentosExistentes documentos={documentosAlimentacion} />
      </Card>
    </div>
  );
}
