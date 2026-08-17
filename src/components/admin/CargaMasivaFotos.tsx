"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud, Check, X, ImageIcon, Film, Loader2, Plus, RotateCcw } from "lucide-react";
import { subirFotoEjercicio, iniciarSubidaVideoCloudflare, confirmarSubidaVideoCloudflare } from "@/app/admin/ejercicios/actions";
import {
  crearIngesta,
  registrarItemIngesta,
  actualizarEstadoItemIngesta,
  marcarItemAplicado,
  obtenerItemsServidorDeIngesta,
  actualizarResumenIngesta,
} from "@/app/admin/ejercicios/ingestaActions";
import type { Ejercicio } from "@/lib/ejercicios/tipos";
import { normalizar } from "@/lib/alimentos/emparejar";
import { emparejarEjercicio } from "@/lib/ejercicios/emparejar";
import { duracionVideo, subirDirectoCloudflare, tipoDeArchivoMultimedia } from "@/lib/ejercicios/videoCliente";
import { ejecutarConLimite } from "@/lib/ejercicios/ingesta/concurrencia";
import {
  indexedDbDisponible,
  obtenerIngestaActual,
  guardarIngestaActual,
  obtenerItemsDeIngesta,
  guardarItem,
  actualizarItem,
  eliminarItem,
  limpiarIngesta,
  type ItemIngestaLocal,
} from "@/lib/ejercicios/ingesta/indexedDb";

type Confianza = "alta" | "revisar" | "sin_match";
type EstadoFila = "pendiente" | "subiendo" | "ok" | "error";
type TipoMultimedia = "imagen" | "video";

type FilaCarga = {
  id: string;
  archivo: File;
  tipo: TipoMultimedia;
  previa: string;
  nombreCandidato: string;
  confianza: Confianza;
  ejercicioId: string | null;
  sugerencias: Ejercicio[];
  estado: EstadoFila;
  progreso: number;
  error: string | null;
};

/** Recorta lo que sobra del nombre de archivo antes de emparejar: extensión
 * (de imagen o de video), numeración de prefijo ("025-press-militar.jpg") y
 * separadores. */
function candidatoDeArchivo(nombreArchivo: string): string {
  return nombreArchivo
    .replace(/\.(jpg|jpeg|png|webp|heic|heif|mp4|mov|webm)$/i, "")
    .replace(/^\d+[-_]/, "")
    .replace(/[_-]/g, " ")
    .trim();
}

/**
 * Empareja el nombre del archivo con `emparejarEjercicio` — el mismo
 * comparador que usa el resto de la galería (Mesa, reportes) y el importador
 * de rutinas, en vez de un segundo matcher propio y más débil.
 *
 * Por qué importa reusarlo: `emparejarEjercicio` trae el veto de zona
 * muscular y equipo (ver `lib/ejercicios/emparejar.ts`) que ya corrigió
 * colisiones reales en producción — "extensión unilateral" (cuádriceps vs.
 * tríceps) o "Press inclinado manc." cayendo en la barra. El comparador
 * anterior de este archivo solo miraba coincidencia de texto exacta y no
 * tenía ninguno de esos dos vetos: una foto de carga masiva SÍ podía
 * terminar en el ejercicio equivocado por el mismo motivo que ya se había
 * arreglado en todos los demás lugares de la app.
 *
 * `exacta`/`alta` de `emparejarEjercicio` (coincidencia única, sin ambigüedad)
 * se preselecciona para "Aplicar todos los seguros"; `media` (coincidencia
 * por palabras, bajo el umbral de certeza) pide confirmación con una sola
 * sugerencia. Sin ningún emparejado, cae a `sugerirPorPalabras` — el último
 * recurso semántico que pide el instructivo, que nunca se autoaplica.
 */
function emparejarPorNombreArchivo(
  nombreArchivo: string,
  ejercicios: Ejercicio[]
): { candidato: string; ejercicioId: string | null; confianza: Confianza; sugerencias: Ejercicio[] } {
  const candidato = candidatoDeArchivo(nombreArchivo);
  const resultado = emparejarEjercicio(candidato, ejercicios);

  if (resultado && resultado.confianza !== "media") {
    return { candidato, ejercicioId: resultado.ejercicio.id, confianza: "alta", sugerencias: [] };
  }
  if (resultado) {
    return { candidato, ejercicioId: null, confianza: "revisar", sugerencias: [resultado.ejercicio] };
  }
  const sugerencias = sugerirPorPalabras(nombreArchivo, ejercicios);
  return {
    candidato,
    ejercicioId: null,
    confianza: sugerencias.length > 0 ? "revisar" : "sin_match",
    sugerencias,
  };
}

/** Último recurso semántico (instructivo §8.4, paso 6): solo para SUGERIR
 * opciones cuando `emparejarEjercicio` no encontró nada — nunca se
 * autoaplica, el entrenador elige a mano. */
function sugerirPorPalabras(nombreArchivo: string, ejercicios: Ejercicio[]): Ejercicio[] {
  const tokens = normalizar(nombreArchivo).split(" ").filter((t) => t.length > 3);
  if (tokens.length === 0) return [];
  return ejercicios
    .map((e) => {
      const texto = normalizar([e.nombre, ...e.aliases].join(" "));
      const puntos = tokens.filter((t) => texto.includes(t)).length;
      return { e, puntos };
    })
    .filter((s) => s.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 4)
    .map((s) => s.e);
}

function estadoFilaDesde(estadoItem: ItemIngestaLocal["estado"]): EstadoFila {
  if (estadoItem === "aplicado") return "ok";
  if (estadoItem === "error") return "error";
  if (estadoItem === "subiendo" || estadoItem === "procesando") return "pendiente"; // se cortó a mitad de subida — se reintenta a mano
  return "pendiente";
}

export function CargaMasivaFotos({
  ejercicios,
  onCrearEjercicio,
}: {
  ejercicios: Ejercicio[];
  /** Abre el alta rápida con el nombre candidato y el archivo de esta fila
   * ya precargados — instructivo §4/§6, "Crear ejercicio con este material":
   * una fila sin coincidencia no debe bloquear el lote ni obligar a salir a
   * buscar otro modal. */
  onCrearEjercicio?: (nombreSugerido: string, archivo: File, tipo: TipoMultimedia) => void;
}) {
  const [filas, setFilas] = useState<FilaCarga[]>([]);
  const [subiendoLote, setSubiendoLote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Cada objectURL creado con URL.createObjectURL debe revocarse quitando la
  // fila o al desmontar — si no, un lote de 100 archivos deja 100 blobs
  // vivos en memoria (instructivo §4.2/§20, "revocar objectURL").
  const previasCreadas = useRef<Set<string>>(new Set());

  // Persistencia (instructivo Fase 2, §12): la ingesta actual sobrevive a un
  // refresh porque el archivo vive en IndexedDB y el progreso en el
  // servidor. `ingestaId` es un ref, no un estado — se lee y escribe desde
  // callbacks async que no deben disparar un re-render por sí solas.
  const ingestaIdRef = useRef<string | null>(null);
  const [recuperacion, setRecuperacion] = useState<{ ingestaId: string; items: ItemIngestaLocal[] } | null>(null);

  useEffect(() => {
    const registro = previasCreadas.current;
    return () => {
      for (const url of registro) URL.revokeObjectURL(url);
      registro.clear();
    };
  }, []);

  // Al montar, busca una ingesta sin terminar de una sesión anterior. Si el
  // navegador no tiene IndexedDB (o está vacía), no hay nada que ofrecer.
  useEffect(() => {
    if (!indexedDbDisponible()) return;
    (async () => {
      const idGuardado = await obtenerIngestaActual();
      if (!idGuardado) return;
      const items = await obtenerItemsDeIngesta(idGuardado);
      if (items.length === 0) {
        await limpiarIngesta(idGuardado);
        return;
      }
      setRecuperacion({ ingestaId: idGuardado, items });
    })();
  }, []);

  function crearPrevia(archivo: File): string {
    const url = URL.createObjectURL(archivo);
    previasCreadas.current.add(url);
    return url;
  }

  function revocarPrevia(url: string) {
    URL.revokeObjectURL(url);
    previasCreadas.current.delete(url);
  }

  async function sincronizarResumen(actuales: FilaCarga[]) {
    if (!ingestaIdRef.current) return;
    const listos = actuales.filter((f) => f.estado === "ok").length;
    const errores = actuales.filter((f) => f.estado === "error").length;
    const pendientes = actuales.length - listos - errores;
    await actualizarResumenIngesta(ingestaIdRef.current, {
      totalArchivos: actuales.length,
      archivosListos: listos,
      archivosError: errores,
      estado: pendientes > 0 ? "cargando" : errores > 0 ? "parcial" : actuales.length > 0 ? "completada" : "cancelada",
    });
  }

  /** Crea la ingesta la primera vez que hace falta (primer archivo elegido
   * en la sesión) — no una por cada archivo. */
  async function asegurarIngesta(): Promise<string | null> {
    if (ingestaIdRef.current) return ingestaIdRef.current;
    if (!indexedDbDisponible()) return null;
    const resultado = await crearIngesta("carga");
    if (!resultado.ok) return null;
    ingestaIdRef.current = resultado.id;
    await guardarIngestaActual(resultado.id);
    return resultado.id;
  }

  const agregarArchivos = async (lista: FileList | null) => {
    if (!lista) return;
    const archivos = Array.from(lista);
    if (inputRef.current) inputRef.current.value = "";

    const ingestaId = await asegurarIngesta();

    const nuevas: FilaCarga[] = archivos
      .map((archivo): FilaCarga | null => {
        const tipo = tipoDeArchivoMultimedia(archivo);
        if (!tipo) return null; // ni el MIME ni la extensión dicen qué es — se ignora en vez de romper el lote.
        const { candidato, ejercicioId, confianza, sugerencias } = emparejarPorNombreArchivo(archivo.name, ejercicios);
        return {
          // El mismo archivo soltado dos veces (fácil arrastrando por tandas)
          // generaba la misma key de React con nombre+tamaño+fecha — las dos
          // filas quedaban indistinguibles y "quitar" borraba ambas de un
          // tirón. Es también la clave idempotente que ve el servidor.
          id: crypto.randomUUID(),
          archivo,
          tipo,
          previa: crearPrevia(archivo),
          nombreCandidato: candidato,
          confianza,
          ejercicioId,
          sugerencias,
          estado: "pendiente" as EstadoFila,
          progreso: 0,
          error: null,
        };
      })
      .filter((fila): fila is FilaCarga => fila !== null);

    setFilas((actuales) => [...actuales, ...nuevas]);

    if (ingestaId) {
      await Promise.all(
        nuevas.map(async (fila) => {
          await guardarItem({
            id: fila.id,
            ingestaId,
            archivo: fila.archivo,
            tipo: fila.tipo,
            nombreCandidato: fila.nombreCandidato,
            ejercicioId: fila.ejercicioId,
            confianza: fila.confianza,
            estado: "local",
            progreso: 0,
            error: null,
            creadoEn: Date.now(),
          });
          await registrarItemIngesta({
            id: fila.id,
            ingestaId,
            nombreArchivo: fila.archivo.name,
            mime: fila.archivo.type,
            tamanoBytes: fila.archivo.size,
            tipo: fila.tipo,
            nombreCandidato: fila.nombreCandidato,
            confianza: fila.confianza,
            ejercicioId: fila.ejercicioId,
          });
        })
      );
    }
  };

  const asignarEjercicio = (filaId: string, ejercicioId: string) => {
    setFilas((actuales) => actuales.map((f) => (f.id === filaId ? { ...f, ejercicioId, confianza: "alta" } : f)));
    void actualizarItem(filaId, { ejercicioId, confianza: "alta" });
  };

  const quitarFila = (filaId: string) => {
    setFilas((actuales) => {
      const fila = actuales.find((f) => f.id === filaId);
      if (fila) revocarPrevia(fila.previa);
      return actuales.filter((f) => f.id !== filaId);
    });
    void eliminarItem(filaId);
  };

  const subirFoto = async (fila: FilaCarga) => {
    const datos = new FormData();
    datos.set("ejercicio_id", fila.ejercicioId!);
    datos.set("foto", fila.archivo);
    const resultado = await subirFotoEjercicio({ error: null, ok: false }, datos);
    return resultado.ok ? null : resultado.error ?? "No se pudo subir la foto.";
  };

  const subirVideo = async (fila: FilaCarga) => {
    const inicio = await iniciarSubidaVideoCloudflare(fila.ejercicioId!, fila.archivo.size, fila.archivo.type);
    if (!inicio.ok) return inicio.error;
    if (fila.archivo.size > 100 * 1024 * 1024) return "El video supera el máximo de 100 MB.";
    const duracion = await duracionVideo(fila.archivo);
    if (duracion !== null && duracion > 30.5) return "El clip debe durar 30 segundos o menos.";
    try {
      await subirDirectoCloudflare(inicio.endpoint, fila.archivo, (progreso) => {
        setFilas((actuales) => actuales.map((f) => (f.id === fila.id ? { ...f, progreso } : f)));
      });
      await confirmarSubidaVideoCloudflare(fila.ejercicioId!);
      return null;
    } catch {
      return "La subida se interrumpió. Intenta nuevamente.";
    }
  };

  const subirUna = async (fila: FilaCarga) => {
    if (!fila.ejercicioId) return;
    setFilas((actuales) => actuales.map((f) => (f.id === fila.id ? { ...f, estado: "subiendo", error: null, progreso: 0 } : f)));
    await actualizarEstadoItemIngesta(fila.id, { estado: "subiendo" });
    await actualizarItem(fila.id, { estado: "subiendo" });

    const error = fila.tipo === "imagen" ? await subirFoto(fila) : await subirVideo(fila);

    if (error) {
      await actualizarEstadoItemIngesta(fila.id, { estado: "error", errorDetalle: error });
      await actualizarItem(fila.id, { estado: "error", error });
    } else {
      // Recién ahora, con el medio de verdad vinculado, se marca aplicado
      // (idempotente: reintentar esta llamada para un item ya aplicado no
      // hace nada) y se limpia de IndexedDB — el archivo ya cumplió su
      // función, no hace falta seguir cargando esos bytes en el navegador.
      await marcarItemAplicado(fila.id, fila.ejercicioId);
      await eliminarItem(fila.id);
    }

    let siguiente: FilaCarga[] = [];
    setFilas((actuales) => {
      siguiente = actuales.map((f) => (f.id === fila.id ? { ...f, estado: error ? "error" : "ok", error } : f));
      return siguiente;
    });
    await sincronizarResumen(siguiente);
  };

  const subirTodasLasSeguras = async () => {
    setSubiendoLote(true);
    const listas = filas.filter((f) => f.confianza === "alta" && f.ejercicioId && f.estado === "pendiente");
    // Concurrencia limitada y separada por tipo (instructivo §12.4): 3
    // imágenes a la vez, 1 video a la vez — un clip de 100 MB no debe
    // competir por ancho de banda con las fotos que sí pueden ir en paralelo.
    const imagenes = listas.filter((f) => f.tipo === "imagen").map((f) => () => subirUna(f));
    const videos = listas.filter((f) => f.tipo === "video").map((f) => () => subirUna(f));
    await Promise.all([ejecutarConLimite(imagenes, 3), ejecutarConLimite(videos, 1)]);
    setSubiendoLote(false);
  };

  // --- Recuperación de una carga sin terminar (instructivo §12.3) ---

  async function continuarRecuperacion() {
    if (!recuperacion) return;
    const { ingestaId, items } = recuperacion;
    // El servidor manda: si ya marca un item 'aplicado' (se alcanzó a
    // confirmar antes del corte), no se vuelve a subir aunque localmente no
    // se haya llegado a limpiar de IndexedDB.
    const servidor = await obtenerItemsServidorDeIngesta(ingestaId);
    const aplicadosEnServidor = new Set(servidor.filter((i) => i.estado === "aplicado").map((i) => i.id));

    const restantes: ItemIngestaLocal[] = [];
    for (const item of items) {
      if (aplicadosEnServidor.has(item.id)) {
        await eliminarItem(item.id);
      } else {
        restantes.push(item);
      }
    }

    ingestaIdRef.current = ingestaId;
    setFilas(
      restantes.map((item) => ({
        id: item.id,
        archivo: item.archivo,
        tipo: item.tipo,
        previa: crearPrevia(item.archivo),
        nombreCandidato: item.nombreCandidato,
        confianza: item.confianza,
        ejercicioId: item.ejercicioId,
        sugerencias: [],
        estado: estadoFilaDesde(item.estado),
        progreso: 0,
        error: item.error,
      }))
    );
    setRecuperacion(null);
  }

  async function descartarRecuperacion() {
    if (!recuperacion) return;
    await limpiarIngesta(recuperacion.ingestaId);
    setRecuperacion(null);
  }

  const pendientesAltaConfianza = filas.filter((f) => f.confianza === "alta" && f.estado === "pendiente").length;
  const terminadas = filas.filter((f) => f.estado === "ok").length;

  return (
    <div className="space-y-3">
      {recuperacion && (
        <div className="radius-control space-y-2 border border-vip/40 bg-vip/5 p-3">
          <p className="text-caption font-bold text-text">Tienes una carga sin terminar</p>
          <p className="text-micro text-text-tertiary">
            {recuperacion.items.length} archivo{recuperacion.items.length === 1 ? "" : "s"} quedaron de la última vez
            — podés seguir donde quedaste o empezar de nuevo.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void continuarRecuperacion()}
              className="btn-accion radius-control flex h-9 flex-1 items-center justify-center gap-1.5 text-caption font-bold"
            >
              <RotateCcw size={14} /> Continuar
            </button>
            <button
              type="button"
              onClick={() => void descartarRecuperacion()}
              className="radius-control h-9 flex-1 border border-border text-caption font-semibold text-text-secondary"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void agregarArchivos(e.dataTransfer.files);
        }}
        className="radius-control flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-vip/40 bg-surface p-4 text-center"
      >
        <UploadCloud size={24} className="text-vip" />
        <p className="text-caption font-semibold text-text">Arrastrá fotos y videos acá, o tocá para elegir</p>
        <p className="text-micro text-text-tertiary">
          JPG, PNG, WebP, HEIC, MP4, MOV o WebM · el nombre del archivo se compara con el nombre y los alias de cada ejercicio
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
          multiple
          onChange={(e) => void agregarArchivos(e.target.files)}
          className="hidden"
        />
      </div>

      {filas.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-text-tertiary">
              {terminadas > 0 && <span className="text-success">{terminadas} subida{terminadas === 1 ? "" : "s"} · </span>}
              {filas.length} en la cola
            </p>
            {pendientesAltaConfianza > 0 && (
              <button
                type="button"
                onClick={() => void subirTodasLasSeguras()}
                disabled={subiendoLote}
                className="btn-accion radius-control flex h-9 items-center gap-1.5 px-3 text-caption font-bold disabled:opacity-60"
              >
                {subiendoLote ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Aplicar {pendientesAltaConfianza} seguras
              </button>
            )}
          </div>

          <div className="space-y-2">
            {filas.map((fila) => (
              <FilaCargaMasiva
                key={fila.id}
                fila={fila}
                ejercicios={ejercicios}
                onAsignar={(id) => asignarEjercicio(fila.id, id)}
                onSubir={() => subirUna(fila)}
                onQuitar={() => quitarFila(fila.id)}
                onCrearEjercicio={
                  onCrearEjercicio ? () => onCrearEjercicio(fila.nombreCandidato, fila.archivo, fila.tipo) : undefined
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const CONFIANZA_VISUAL: Record<Confianza, { etiqueta: string; clase: string }> = {
  alta: { etiqueta: "Coincidencia exacta", clase: "border-success/30 bg-success/10 text-success" },
  revisar: { etiqueta: "Confirmá cuál es", clase: "border-warning/30 bg-warning/10 text-warning" },
  sin_match: { etiqueta: "Sin sugerencia", clase: "border-border bg-surface-2 text-text-tertiary" },
};

function FilaCargaMasiva({
  fila,
  ejercicios,
  onAsignar,
  onSubir,
  onQuitar,
  onCrearEjercicio,
}: {
  fila: FilaCarga;
  ejercicios: Ejercicio[];
  onAsignar: (ejercicioId: string) => void;
  onSubir: () => void;
  onQuitar: () => void;
  onCrearEjercicio?: () => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const visual = CONFIANZA_VISUAL[fila.confianza];
  const ejercicioElegido = fila.ejercicioId ? ejercicios.find((e) => e.id === fila.ejercicioId) : null;
  const opcionesBusqueda = busqueda.trim()
    ? ejercicios.filter((e) => normalizar(e.nombre).includes(normalizar(busqueda))).slice(0, 8)
    : [];

  return (
    <div className="radius-control flex items-start gap-2.5 border border-border bg-surface p-2.5">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
        {fila.tipo === "video" ? (
          <video src={fila.previa} className="h-full w-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- preview local del archivo elegido, nunca pasa por Storage
          <img src={fila.previa} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute bottom-0.5 right-0.5 grid size-4 place-items-center rounded-full bg-black/60 text-white">
          {fila.tipo === "video" ? <Film size={10} /> : <ImageIcon size={10} />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-caption truncate font-semibold text-text">{fila.archivo.name}</p>
        <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${visual.clase}`}>
          {visual.etiqueta}
        </span>

        {fila.estado === "ok" ? (
          <p className="text-micro mt-1.5 flex items-center gap-1 font-semibold text-success">
            <Check size={12} /> Subida a {ejercicioElegido?.nombre}
          </p>
        ) : (
          <>
            {ejercicioElegido ? (
              <p className="text-micro mt-1.5 text-text-secondary">
                → <strong className="text-text">{ejercicioElegido.nombre}</strong>{" "}
                <button type="button" onClick={() => setBuscando(true)} className="text-vip underline">cambiar</button>
              </p>
            ) : buscando || fila.confianza !== "alta" ? (
              <div className="mt-1.5 space-y-1">
                {fila.sugerencias.length > 0 && !buscando && (
                  <div className="flex flex-wrap gap-1">
                    {fila.sugerencias.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onAsignar(s.id)}
                        className="radius-control border border-border bg-surface-2 px-2 py-1 text-[10px] font-medium text-text-secondary"
                      >
                        {s.nombre}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar ejercicio…"
                  className="radius-control w-full border border-border bg-surface-2 px-2 py-1 text-[11px] text-text"
                />
                {opcionesBusqueda.length > 0 && (
                  <div className="max-h-28 space-y-0.5 overflow-y-auto">
                    {opcionesBusqueda.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          onAsignar(e.id);
                          setBuscando(false);
                          setBusqueda("");
                        }}
                        className="block w-full truncate rounded-lg px-2 py-1 text-left text-[11px] text-text hover:bg-surface-2"
                      >
                        {e.nombre}
                      </button>
                    ))}
                  </div>
                )}
                {!busqueda.trim() && onCrearEjercicio && (
                  <button
                    type="button"
                    onClick={onCrearEjercicio}
                    className="radius-control flex w-full items-center justify-center gap-1 border border-dashed border-vip/50 py-1.5 text-[11px] font-semibold text-vip"
                  >
                    <Plus size={12} /> Crear ejercicio con este archivo
                  </button>
                )}
              </div>
            ) : null}
            {fila.error && <p className="text-micro mt-1 text-error">{fila.error}</p>}
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {fila.estado !== "ok" && (
          <button
            type="button"
            onClick={onSubir}
            disabled={!fila.ejercicioId || fila.estado === "subiendo"}
            className="radius-control flex h-8 items-center gap-1 border border-vip/40 px-2 text-[10px] font-bold text-vip disabled:opacity-40"
          >
            {fila.estado === "subiendo" ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {fila.tipo === "video" && fila.progreso > 0 ? `${fila.progreso}%` : ""}
              </>
            ) : fila.tipo === "video" ? (
              <Film size={12} />
            ) : (
              <ImageIcon size={12} />
            )}
            {fila.estado !== "subiendo" && (fila.estado === "error" ? "Reintentar" : "Subir")}
          </button>
        )}
        <button type="button" onClick={onQuitar} aria-label="Quitar de la cola" className="text-text-tertiary">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
