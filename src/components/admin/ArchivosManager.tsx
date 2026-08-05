"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { FolderUp, Wand2, FileText, Trash2, ClipboardPaste } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import {
  subirRutinaAVariosAlumnos,
  subirAlimentacionAVariosAlumnos,
  analizarRutinaPdf,
  analizarAlimentacionPdf,
  eliminarDocumento,
  guardarMacrosVariosAlumnos,
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

/**
 * Antes quedaba deshabilitado sin más cuando no había destinatarios elegidos:
 * un botón amarillo bien visible que no hacía nada. Ahora sigue siendo
 * `type="button"` siempre —para poder decidir en el click qué hacer— y en vez
 * de deshabilitar cuando falta elegir a quién, abre el selector de alumnos
 * ahí mismo con `alIrASeleccion` (ver `selectorAbierto` en ArchivosManager).
 * `useFormStatus` sigue funcionando igual: lee el estado del `<form>`
 * ancestro sin importar si el envío lo disparó un submit nativo o
 * `formRef.current.requestSubmit()`.
 */
function BotonSubir({
  cantidad,
  formRef,
  alIrASeleccion,
}: {
  cantidad: number;
  formRef: React.RefObject<HTMLFormElement | null>;
  alIrASeleccion: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="button"
      loading={pending}
      onClick={() => {
        if (cantidad === 0) {
          alIrASeleccion();
          return;
        }
        formRef.current?.requestSubmit();
      }}
    >
      {pending
        ? "Subiendo…"
        : cantidad === 0
          ? "Elige a quiénes"
          : `Subir a ${cantidad} ${cantidad === 1 ? "alumno" : "alumnos"}`}
    </Button>
  );
}

/**
 * El selector de alumnos, abierto adentro de la sección que lo pidió en vez
 * de vivir fijo arriba de la pantalla. "Listo" lo cierra sin más — elegir
 * queda guardado en `destinatarios` igual, que es estado del padre.
 */
function PanelSelector({
  alumnos,
  destinatarios,
  onCambiar,
  onCerrar,
}: {
  alumnos: AlumnoParaAsignar[];
  destinatarios: Set<string>;
  onCambiar: (s: Set<string>) => void;
  onCerrar: () => void;
}) {
  return (
    <div className="radius-control mb-3 space-y-3 border border-vip/40 bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text-tertiary">¿A QUIÉNES LE ENVÍO ESTO?</p>
        <button type="button" onClick={onCerrar} className="text-caption font-medium text-vip">
          Listo
        </button>
      </div>
      <SelectorAlumnos alumnos={alumnos} seleccionados={destinatarios} onCambiar={onCambiar} />
    </div>
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

function CampoMacro({
  etiqueta,
  sufijo,
  valor,
  onCambiar,
}: {
  etiqueta: string;
  sufijo: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  return (
    <label className="radius-control block border border-border bg-surface-2 px-3 py-2">
      <span className="text-caption text-text-tertiary">{etiqueta}</span>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          placeholder="0"
          className="text-body w-full min-w-0 bg-transparent text-text outline-none"
        />
        <span className="text-caption shrink-0 text-text-tertiary">{sufijo}</span>
      </div>
    </label>
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
 *
 * `alumnoId` es opcional: cuando este cuadro vive en la ficha de un alumno,
 * ese alumno viene preseleccionado. En la biblioteca de Documentos (no hay
 * "un" alumno) arranca sin nadie marcado y el entrenador elige a mano.
 */
export function ArchivosManager({
  alumnoId,
  documentos,
  alumnos,
}: {
  alumnoId?: string;
  documentos: Documento[];
  alumnos: AlumnoParaAsignar[];
}) {
  const router = useRouter();
  const documentosRutina = documentos.filter((d) => d.tipo === "rutina");
  const documentosAlimentacion = documentos.filter((d) => d.tipo === "alimentacion");

  // El alumno de la ficha viene marcado, que es el caso normal.
  const [destinatarios, setDestinatarios] = useState<Set<string>>(
    new Set(alumnoId ? [alumnoId] : [])
  );

  const [rutina, accionRutina, subiendoRutina] = useActionState(
    subirRutinaAVariosAlumnos,
    estadoVariosVacio
  );
  const [nombreRutina, setNombreRutina] = useState<string | null>(null);
  const [analizandoRutina, setAnalizandoRutina] = useState(false);
  const [errorRutina, setErrorRutina] = useState<string | null>(null);
  const [draft, setDraft] = useState<RutinaExtraida | null>(null);
  // "archivo": el flujo de siempre (elegir un PDF/TXT del disco). "texto":
  // pegar la rutina directo, sin tener que armar un archivo antes — se manda
  // igual que un .txt: mismo análisis de IA, mismo registro en `documentos`.
  const [modoRutina, setModoRutina] = useState<"archivo" | "texto">("archivo");
  const [textoRutina, setTextoRutina] = useState("");
  const formRutinaRef = useRef<HTMLFormElement>(null);
  // `rutina.storagePath` viene de `useActionState`: no hay forma de "vaciarlo"
  // a mano, solo de disparar la acción de nuevo. Esta bandera es la que
  // decide si se sigue mostrando la tarjeta de "archivo subido" — se prende
  // al terminar de publicar (ver `reiniciarFlujoRutina`) para volver a
  // mostrar el cuadro de carga, y se apaga apenas arranca una subida nueva.
  const [reiniciarRutina, setReiniciarRutina] = useState(false);

  const [alimentacion, accionAlimentacion, subiendoAlimentacion] = useActionState(
    subirAlimentacionAVariosAlumnos,
    estadoVariosVacio
  );
  const [nombreAlimentacion, setNombreAlimentacion] = useState<string | null>(null);
  const [analizandoPlan, setAnalizandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [analisisPlan, setAnalisisPlan] = useState<AnalizarPlanState | null>(null);
  // "macros": carga directa de los 4 números, sin PDF ni IA — el camino
  // por defecto ahora, pedido explícito para no tener que subir un plan
  // completo solo para dejar la meta calórica. "archivo"/"texto" siguen
  // disponibles para cuando sí hace falta el detalle de comidas.
  const [modoAlimentacion, setModoAlimentacion] = useState<"macros" | "archivo" | "texto">(
    "macros"
  );
  const [textoAlimentacion, setTextoAlimentacion] = useState("");
  const formAlimentacionRef = useRef<HTMLFormElement>(null);
  const [reiniciarAlimentacion, setReiniciarAlimentacion] = useState(false);

  const [macrosKcal, setMacrosKcal] = useState("");
  const [macrosProt, setMacrosProt] = useState("");
  const [macrosCarb, setMacrosCarb] = useState("");
  const [macrosGrasa, setMacrosGrasa] = useState("");
  const [guardandoMacros, setGuardandoMacros] = useState(false);
  const [errorMacros, setErrorMacros] = useState<string | null>(null);
  const [macrosGuardados, setMacrosGuardados] = useState(false);

  /** El selector de alumnos ya no vive fijo arriba de todo: aparece dentro de
   * la sección (Rutina o Alimentación) donde se lo pidió, al tocar el botón
   * amarillo sin haber elegido a nadie todavía. Solo uno a la vez — no tiene
   * sentido abrir los dos juntos, y comparten el mismo `destinatarios`. */
  const [selectorAbierto, setSelectorAbierto] = useState<"rutina" | "alimentacion" | null>(null);

  /**
   * El historial de abajo (`DocumentosManager`, en la página) lo llena el
   * servidor con los `documentos` que le pasa la página — un prop fijo desde
   * el primer render, no algo que este componente pueda re-pedir solo.
   * `revalidatePath` en la Server Action marca esa consulta como vieja, pero
   * "Pegar texto" dispara la acción a mano (`accionRutina(formData)` dentro
   * de un `startTransition`, no un `<form>` nativo), y ese camino no dispara
   * el refresco automático que sí trae un submit real. Sin esto, el
   * documento quedaba subido pero el historial seguía mostrando "Todavía no
   * hay documentos" hasta que el entrenador recargaba la página a mano. */
  useEffect(() => {
    if (rutina.storagePath) router.refresh();
  }, [rutina.storagePath, router]);
  useEffect(() => {
    if (alimentacion.storagePath) router.refresh();
  }, [alimentacion.storagePath, router]);

  /** Mete los alumnos elegidos en el formulario antes de enviarlo. */
  const conDestinatarios =
    (accion: (fd: FormData) => void) =>
    (formData: FormData) => {
      for (const id of destinatarios) formData.append("alumno_ids", id);
      accion(formData);
    };

  /**
   * Pegar texto en vez de elegir un archivo.
   *
   * No hay una acción de servidor nueva: se arma un `File` de tipo texto
   * plano a partir de lo que se pegó y se manda por la MISMA acción que ya
   * usa el flujo de "elegir archivo" (`subirRutinaAVariosAlumnos` /
   * `subirAlimentacionAVariosAlumnos`). Es exactamente el mismo camino que
   * subir un .txt a mano — Storage, el registro en `documentos`, el análisis
   * con IA — sin duplicar nada de esa lógica ni tener que mantenerla dos
   * veces.
   */
  const usarTextoRutina = () => {
    if (!textoRutina.trim()) return;
    if (destinatarios.size === 0) {
      setSelectorAbierto("rutina");
      return;
    }
    const archivo = new File([textoRutina], `rutina-pegada-${Date.now()}.txt`, {
      type: "text/plain",
    });
    const formData = new FormData();
    formData.append("archivo", archivo);
    setNombreRutina("Rutina pegada como texto");
    setReiniciarRutina(false);
    // Sin `startTransition`, React avisa que llamar la acción de
    // `useActionState` a mano (no como `action` de un `<form>`) fuera de una
    // transición deja `isPending` sin actualizarse — el botón se quedaría sin
    // mostrar "Subiendo…".
    startTransition(() => {
      conDestinatarios(accionRutina)(formData);
    });
  };

  const usarTextoAlimentacion = () => {
    if (!textoAlimentacion.trim()) return;
    if (destinatarios.size === 0) {
      setSelectorAbierto("alimentacion");
      return;
    }
    const archivo = new File([textoAlimentacion], `alimentacion-pegada-${Date.now()}.txt`, {
      type: "text/plain",
    });
    const formData = new FormData();
    formData.append("archivo", archivo);
    setNombreAlimentacion("Plan pegado como texto");
    setReiniciarAlimentacion(false);
    startTransition(() => {
      conDestinatarios(accionAlimentacion)(formData);
    });
  };

  /** A diferencia de rutina/alimentación por archivo, esto no pasa por
   * `useActionState`: son 4 números, no hay upload ni análisis de IA que
   * requiera ese manejo de estado — una llamada directa alcanza. */
  const guardarMacros = async () => {
    if (destinatarios.size === 0) {
      setSelectorAbierto("alimentacion");
      return;
    }
    const numero = (texto: string) => (texto.trim() === "" ? null : Math.max(0, Number(texto)));
    setGuardandoMacros(true);
    setErrorMacros(null);
    const resultado = await guardarMacrosVariosAlumnos(Array.from(destinatarios), {
      kcalObjetivo: numero(macrosKcal),
      protObjetivo: numero(macrosProt),
      carbObjetivo: numero(macrosCarb),
      grasaObjetivo: numero(macrosGrasa),
    });
    setGuardandoMacros(false);
    if (!resultado.ok) {
      setErrorMacros(resultado.error);
      return;
    }
    setMacrosGuardados(true);
    setMacrosKcal("");
    setMacrosProt("");
    setMacrosCarb("");
    setMacrosGrasa("");
    router.refresh();
    window.setTimeout(() => setMacrosGuardados(false), 2500);
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

  /** Se llama al terminar de publicar (con éxito o al descartar el borrador):
   * vuelve a mostrar el cuadro de carga en vez de dejar la tarjeta de "archivo
   * subido" pegada en pantalla sin salida. */
  const reiniciarFlujoRutina = () => {
    setDraft(null);
    setNombreRutina(null);
    setTextoRutina("");
    setModoRutina("archivo");
    setReiniciarRutina(true);
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

  const reiniciarFlujoAlimentacion = () => {
    setAnalisisPlan(null);
    setNombreAlimentacion(null);
    setTextoAlimentacion("");
    setModoAlimentacion("archivo");
    setReiniciarAlimentacion(true);
  };

  return (
    <div className="space-y-4">
      {/* RUTINA — ya no hay un cuadro fijo de "a quiénes" arriba de todo: el
          selector aparece adentro de la sección que lo pidió, tocando el
          botón amarillo sin haber elegido a nadie (ver `selectorAbierto` y
          `PanelSelector`). */}
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">RUTINA DE ENTRENAMIENTO (PDF)</p>

        {selectorAbierto === "rutina" && (
          <PanelSelector
            alumnos={alumnos}
            destinatarios={destinatarios}
            onCambiar={setDestinatarios}
            onCerrar={() => setSelectorAbierto(null)}
          />
        )}

        {rutina.storagePath && !reiniciarRutina ? (
          <div className="radius-control flex items-center gap-3 border border-border p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={20} className="text-vip" />
            </div>
            <p className="text-body truncate text-text">{nombreRutina ?? "Archivo subido"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Elegir modo antes que el destinatario importe: cambia toda la
                forma de cargar la rutina, así que va arriba de todo. */}
            <div className="radius-control flex border border-border p-1">
              <button
                type="button"
                onClick={() => setModoRutina("archivo")}
                className={`text-caption flex-1 rounded-[10px] py-1.5 text-center font-medium transition-colors ${
                  modoRutina === "archivo" ? "bg-surface-2 text-text" : "text-text-tertiary"
                }`}
              >
                Subir archivo
              </button>
              <button
                type="button"
                onClick={() => setModoRutina("texto")}
                className={`text-caption flex-1 rounded-[10px] py-1.5 text-center font-medium transition-colors ${
                  modoRutina === "texto" ? "bg-surface-2 text-text" : "text-text-tertiary"
                }`}
              >
                Pegar texto
              </button>
            </div>

            {modoRutina === "archivo" ? (
              <form
                ref={formRutinaRef}
                action={conDestinatarios(accionRutina)}
                onSubmit={() => setReiniciarRutina(false)}
                className="space-y-3"
              >
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
                {nombreRutina && (
                  <p className="text-secondary text-center text-text">{nombreRutina}</p>
                )}
                {/* `!reiniciarRutina`: sin esto, el resultado de la subida
                    ANTERIOR (`rutina` no se puede "vaciar", solo se vuelve a
                    disparar la acción) quedaba pegado bajo el cuadro recién
                    reiniciado — parecía que la nueva rutina ya estaba subida
                    antes incluso de elegir el archivo. */}
                {!reiniciarRutina && <ResumenSubida estado={rutina} />}
                <BotonSubir
                  cantidad={destinatarios.size}
                  formRef={formRutinaRef}
                  alIrASeleccion={() => setSelectorAbierto("rutina")}
                />
              </form>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={textoRutina}
                  onChange={(e) => setTextoRutina(e.target.value)}
                  placeholder={
                    "Pega aquí la rutina completa: días, ejercicios, series, repeticiones...\n\nEj:\nDía 1 · Pecho y tríceps\n1. Press banca 4x8-10\n2. Aperturas con mancuerna 3x12"
                  }
                  rows={10}
                  className="radius-control w-full resize-y border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text placeholder:text-text-tertiary"
                />
                {!reiniciarRutina && <ResumenSubida estado={rutina} />}
                <Button
                  type="button"
                  loading={subiendoRutina}
                  onClick={usarTextoRutina}
                  disabled={!textoRutina.trim()}
                >
                  <ClipboardPaste size={16} />
                  {subiendoRutina
                    ? "Subiendo…"
                    : destinatarios.size === 0
                      ? "Elige a quiénes"
                      : `Usar este texto para ${destinatarios.size} ${destinatarios.size === 1 ? "alumno" : "alumnos"}`}
                </Button>
              </div>
            )}
          </div>
        )}

        {rutina.storagePath && !reiniciarRutina && (
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
          alumnoIds={rutina.alumnoIds.length > 0 ? rutina.alumnoIds : alumnoId ? [alumnoId] : []}
          draftInicial={draft}
          // Mismo callback para "Descartar" y para "listo" tras publicar: en
          // los dos casos el trabajo con ESTA rutina terminó, así que el
          // cuadro de carga vuelve a aparecer para la siguiente.
          onDescartar={reiniciarFlujoRutina}
        />
      )}

      {/* ALIMENTACIÓN */}
      <Card>
        <p className="text-caption mb-3 text-text-tertiary">META NUTRICIONAL</p>

        {selectorAbierto === "alimentacion" && (
          <PanelSelector
            alumnos={alumnos}
            destinatarios={destinatarios}
            onCambiar={setDestinatarios}
            onCerrar={() => setSelectorAbierto(null)}
          />
        )}

        {alimentacion.storagePath && !reiniciarAlimentacion && modoAlimentacion !== "macros" ? (
          <div className="radius-control flex items-center gap-3 border border-border p-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2">
              <FileText size={20} className="text-vip" />
            </div>
            <p className="text-body truncate text-text">
              {nombreAlimentacion ?? "Archivo subido"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="radius-control flex border border-border p-1">
              <button
                type="button"
                onClick={() => setModoAlimentacion("macros")}
                className={`text-caption flex-1 rounded-[10px] py-1.5 text-center font-medium transition-colors ${
                  modoAlimentacion === "macros" ? "bg-surface-2 text-text" : "text-text-tertiary"
                }`}
              >
                Macros
              </button>
              <button
                type="button"
                onClick={() => setModoAlimentacion("archivo")}
                className={`text-caption flex-1 rounded-[10px] py-1.5 text-center font-medium transition-colors ${
                  modoAlimentacion === "archivo" ? "bg-surface-2 text-text" : "text-text-tertiary"
                }`}
              >
                Subir archivo
              </button>
              <button
                type="button"
                onClick={() => setModoAlimentacion("texto")}
                className={`text-caption flex-1 rounded-[10px] py-1.5 text-center font-medium transition-colors ${
                  modoAlimentacion === "texto" ? "bg-surface-2 text-text" : "text-text-tertiary"
                }`}
              >
                Pegar texto
              </button>
            </div>

            {modoAlimentacion === "macros" ? (
              <div className="space-y-3">
                <p className="text-caption text-text-tertiary">
                  Carga directa, sin PDF: se publica como la meta activa del alumno, igual que el
                  plan completo.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <CampoMacro etiqueta="Calorías" sufijo="kcal" valor={macrosKcal} onCambiar={setMacrosKcal} />
                  <CampoMacro etiqueta="Proteína" sufijo="g" valor={macrosProt} onCambiar={setMacrosProt} />
                  <CampoMacro etiqueta="Carbohidratos" sufijo="g" valor={macrosCarb} onCambiar={setMacrosCarb} />
                  <CampoMacro etiqueta="Grasas" sufijo="g" valor={macrosGrasa} onCambiar={setMacrosGrasa} />
                </div>
                {errorMacros && <p className="text-caption text-error">{errorMacros}</p>}
                <Button
                  loading={guardandoMacros}
                  disabled={!macrosKcal.trim()}
                  onClick={guardarMacros}
                  className="w-full"
                >
                  {guardandoMacros
                    ? "Guardando…"
                    : macrosGuardados
                      ? "Guardado ✓"
                      : destinatarios.size === 0
                        ? "Elige a quiénes"
                        : `Publicar meta para ${destinatarios.size} ${destinatarios.size === 1 ? "alumno" : "alumnos"}`}
                </Button>
              </div>
            ) : modoAlimentacion === "archivo" ? (
              <form
                ref={formAlimentacionRef}
                action={conDestinatarios(accionAlimentacion)}
                onSubmit={() => setReiniciarAlimentacion(false)}
                className="space-y-3"
              >
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
                {!reiniciarAlimentacion && <ResumenSubida estado={alimentacion} />}
                <BotonSubir
                  cantidad={destinatarios.size}
                  formRef={formAlimentacionRef}
                  alIrASeleccion={() => setSelectorAbierto("alimentacion")}
                />
              </form>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={textoAlimentacion}
                  onChange={(e) => setTextoAlimentacion(e.target.value)}
                  placeholder={
                    "Pega aquí el plan completo: comidas, horas, alimentos y cantidades...\n\nEj:\nDesayuno · 8:00 AM\n- 2 huevos + 1 pan integral\n- 1 taza de avena con leche"
                  }
                  rows={10}
                  className="radius-control w-full resize-y border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text placeholder:text-text-tertiary"
                />
                {!reiniciarAlimentacion && <ResumenSubida estado={alimentacion} />}
                <Button
                  type="button"
                  loading={subiendoAlimentacion}
                  onClick={usarTextoAlimentacion}
                  disabled={!textoAlimentacion.trim()}
                >
                  <ClipboardPaste size={16} />
                  {subiendoAlimentacion
                    ? "Subiendo…"
                    : destinatarios.size === 0
                      ? "Elige a quiénes"
                      : `Usar este texto para ${destinatarios.size} ${destinatarios.size === 1 ? "alumno" : "alumnos"}`}
                </Button>
              </div>
            )}
          </div>
        )}

        {alimentacion.storagePath && !reiniciarAlimentacion && (
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
          // La meta calórica se guarda para uno solo: el primero a quien se
          // le subió este plan (sin ficha de alumno de referencia, ya no hay
          // "el alumno de esta página").
          alumnoId={alimentacion.alumnoIds[0] ?? alumnoId ?? ""}
          documentoId={alimentacion.documentoId}
          analisis={analisisPlan}
          onDescartar={reiniciarFlujoAlimentacion}
        />
      )}
    </div>
  );
}
