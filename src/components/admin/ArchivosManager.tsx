"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { FolderUp, Wand2, FileText, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import {
  subirRutinaAVariosAlumnos,
  subirAlimentacionAVariosAlumnos,
  analizarRutinaPdf,
  analizarAlimentacionPdf,
  eliminarDocumento,
  type SubirAVariosState,
  type AnalizarPlanState,
} from "@/app/admin/archivos/actions";
import { RutinaDraftEditor } from "@/components/admin/RutinaDraftEditor";
import { PlanAlimentacionEditor } from "@/components/admin/PlanAlimentacionEditor";
import { SelectorAlumnos } from "@/components/admin/SelectorAlumnos";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";
import type { AlumnoParaAsignar } from "@/lib/documentos/tipos";

/** El estado inicial vive acá, NO en el archivo de acciones: ese lleva
 * "use server" y solo puede exportar funciones asíncronas. Un objeto exportado
 * desde allí llega como `undefined` al cliente y revienta al renderizar, sin
 * que tsc ni el build lo detecten. */
const estadoVariosVacio: SubirAVariosState = {
  error: null,
  storagePath: null,
  documentoId: null,
  alumnoIds: [],
  fallidos: [],
};

type Documento = {
  id: string;
  /** Null desde la migración 0027 para los archivos de la biblioteca: la
   * asignación pasó a `documento_asignaciones`. */
  alumno_id: string | null;
  tipo: "rutina" | "alimentacion" | "otro";
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

function BotonSubir({ cantidad }: { cantidad: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={cantidad === 0}>
      {pending
        ? "Subiendo…"
        : cantidad === 0
          ? "Elige abajo a quiénes"
          : `Subir a ${cantidad} ${cantidad === 1 ? "alumno" : "alumnos"}`}
    </Button>
  );
}

/** Resultado de una subida: a cuántos llegó y a quiénes no. */
function ResumenSubida({ estado }: { estado: SubirAVariosState }) {
  if (estado.error) return <p className="text-caption text-error">{estado.error}</p>;
  if (estado.alumnoIds.length === 0) return null;

  return (
    <div>
      <p className="text-caption text-success">
        Subido a {estado.alumnoIds.length}{" "}
        {estado.alumnoIds.length === 1 ? "alumno" : "alumnos"}.
      </p>
      {estado.fallidos.map((f) => (
        <p key={f.nombre} className="text-caption text-error">
          {f.nombre} — {f.error}
        </p>
      ))}
    </div>
  );
}

/**
 * Subida de archivos desde la ficha del alumno.
 *
 * Dos formularios independientes — rutina y alimentación — y un único selector
 * de alumnos abajo, compartido por los dos. Cada PDF se analiza por separado:
 * el de rutina arma la lista de ejercicios, el de alimentación saca la meta
 * calórica. La guía unificada (un solo PDF con las dos cosas) se quitó por
 * pedido de Alejandro: con hojas densas la IA lee peor la rutina, y ese camino
 * no analizaba la dieta, así que la meta calórica se perdía.
 *
 * El selector vive FUERA de los formularios, así que sus valores no viajan
 * solos: cada envío los agrega al FormData antes de llamar a la acción.
 */
export function ArchivosManager({
  alumnoId,
  documentos,
  alumnos,
}: {
  alumnoId: string;
  documentos: Documento[];
  alumnos: AlumnoParaAsignar[];
}) {
  const documentosRutina = documentos.filter((d) => d.tipo === "rutina");
  const documentosAlimentacion = documentos.filter((d) => d.tipo === "alimentacion");

  // El alumno de la ficha viene marcado, que es el caso normal.
  const [destinatarios, setDestinatarios] = useState<Set<string>>(new Set([alumnoId]));

  const [rutina, accionRutina] = useActionState(subirRutinaAVariosAlumnos, estadoVariosVacio);
  const [nombreRutina, setNombreRutina] = useState<string | null>(null);
  const [analizandoRutina, setAnalizandoRutina] = useState(false);
  const [errorRutina, setErrorRutina] = useState<string | null>(null);
  const [draft, setDraft] = useState<RutinaExtraida | null>(null);

  const [alimentacion, accionAlimentacion] = useActionState(
    subirAlimentacionAVariosAlumnos,
    estadoVariosVacio
  );
  const [nombreAlimentacion, setNombreAlimentacion] = useState<string | null>(null);
  const [analizandoPlan, setAnalizandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [analisisPlan, setAnalisisPlan] = useState<AnalizarPlanState | null>(null);

  /** Mete los alumnos elegidos en el formulario antes de enviarlo. */
  const conDestinatarios =
    (accion: (fd: FormData) => void) =>
    (formData: FormData) => {
      for (const id of destinatarios) formData.append("alumno_ids", id);
      accion(formData);
    };

  const analizarRutina = async () => {
    if (!rutina.storagePath) return;
    setAnalizandoRutina(true);
    setErrorRutina(null);
    // Sin el try/finally, un fallo del servidor dejaba el botón girando para
    // siempre y sin mensaje.
    try {
      const resultado = await analizarRutinaPdf(rutina.storagePath);
      if (!resultado.datos) {
        setErrorRutina(resultado.error);
        return;
      }
      setDraft(resultado.datos);
    } catch (e) {
      setErrorRutina(
        `No se pudo leer el PDF: ${e instanceof Error ? e.message : "error inesperado"}.`
      );
    } finally {
      setAnalizandoRutina(false);
    }
  };

  const analizarPlan = async () => {
    if (!alimentacion.storagePath) return;
    setAnalizandoPlan(true);
    setErrorPlan(null);
    try {
      const resultado = await analizarAlimentacionPdf(alimentacion.storagePath);
      if (!resultado.plan) {
        setErrorPlan(resultado.error);
        return;
      }
      setAnalisisPlan(resultado);
    } catch (e) {
      setErrorPlan(
        `No se pudo leer el PDF: ${e instanceof Error ? e.message : "error inesperado"}.`
      );
    } finally {
      setAnalizandoPlan(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. RUTINA */}
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">RUTINA DE ENTRENAMIENTO (PDF)</p>

        {rutina.storagePath ? (
          <div className="radius-control flex items-center gap-3 border border-border p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={20} className="text-vip" />
            </div>
            <p className="text-body truncate text-text">{nombreRutina ?? "Archivo subido"}</p>
          </div>
        ) : (
          <form action={conDestinatarios(accionRutina)} className="space-y-3">
            <label
              htmlFor="pdf-rutina"
              className="radius-card flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border py-8"
            >
              <FolderUp size={22} className="text-text-secondary" />
              <span className="text-secondary text-center text-text-tertiary">
                Elige el archivo de la rutina (PDF o TXT)
              </span>
              <input
                id="pdf-rutina"
                name="archivo"
                type="file"
                accept="application/pdf,text/plain,.pdf,.txt"
                className="hidden"
                onChange={(e) => setNombreRutina(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            {nombreRutina && <p className="text-secondary text-center text-text">{nombreRutina}</p>}
            <ResumenSubida estado={rutina} />
            <BotonSubir cantidad={destinatarios.size} />
          </form>
        )}

        {rutina.storagePath && (
          <>
            <ResumenSubida estado={rutina} />
            {!draft && (
              <Button
                variant="outline"
                onClick={analizarRutina}
                disabled={analizandoRutina}
                className="mt-3"
              >
                <Wand2 size={16} />
                {analizandoRutina ? "Leyendo PDF…" : "Analizar la rutina con IA"}
              </Button>
            )}
          </>
        )}

        {errorRutina && <p className="text-caption mt-2 text-error">{errorRutina}</p>}

        <ListaDocumentosExistentes documentos={documentosRutina} />
      </Card>

      {draft && (
        <RutinaDraftEditor
          // Se publica a los mismos a los que se subió el PDF.
          alumnoIds={rutina.alumnoIds.length > 0 ? rutina.alumnoIds : [alumnoId]}
          draftInicial={draft}
          onDescartar={() => setDraft(null)}
        />
      )}

      {/* 2. ALIMENTACIÓN */}
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">PLAN DE ALIMENTACIÓN (PDF)</p>

        {alimentacion.storagePath ? (
          <div className="radius-control flex items-center gap-3 border border-border p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={20} className="text-vip" />
            </div>
            <p className="text-body truncate text-text">
              {nombreAlimentacion ?? "Archivo subido"}
            </p>
          </div>
        ) : (
          <form action={conDestinatarios(accionAlimentacion)} className="space-y-3">
            <label
              htmlFor="pdf-alimentacion"
              className="radius-card flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border py-8"
            >
              <FolderUp size={22} className="text-text-secondary" />
              <span className="text-secondary text-center text-text-tertiary">
                Elige el archivo de alimentación (PDF o TXT)
              </span>
              <input
                id="pdf-alimentacion"
                name="archivo"
                type="file"
                accept="application/pdf,text/plain,.pdf,.txt"
                className="hidden"
                onChange={(e) => setNombreAlimentacion(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            {nombreAlimentacion && (
              <p className="text-secondary text-center text-text">{nombreAlimentacion}</p>
            )}
            <ResumenSubida estado={alimentacion} />
            <BotonSubir cantidad={destinatarios.size} />
          </form>
        )}

        {alimentacion.storagePath && (
          <>
            <ResumenSubida estado={alimentacion} />
            {!analisisPlan && (
              <Button
                variant="outline"
                onClick={analizarPlan}
                disabled={analizandoPlan}
                className="mt-3"
              >
                <Wand2 size={16} />
                {analizandoPlan ? "Leyendo PDF…" : "Analizar con IA y extraer la meta calórica"}
              </Button>
            )}
          </>
        )}

        {errorPlan && <p className="text-caption mt-2 text-error">{errorPlan}</p>}

        <ListaDocumentosExistentes documentos={documentosAlimentacion} />
      </Card>

      {analisisPlan?.plan && (
        <PlanAlimentacionEditor
          alumnoId={alumnoId}
          documentoId={alimentacion.documentoId}
          analisis={analisisPlan}
          onDescartar={() => setAnalisisPlan(null)}
        />
      )}

      {/* 3. A QUIÉNES */}
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">¿A QUIÉNES LES SUBO ESTO?</p>
        <SelectorAlumnos
          alumnos={alumnos}
          seleccionados={destinatarios}
          onCambiar={setDestinatarios}
        />
      </Card>
    </div>
  );
}
