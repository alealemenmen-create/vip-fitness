"use client";

import { useRef, useState } from "react";
import { UploadCloud, Check, X, ImageIcon, Loader2 } from "lucide-react";
import { subirFotoEjercicio } from "@/app/admin/ejercicios/actions";
import type { Ejercicio } from "@/lib/ejercicios/tipos";
import { normalizar } from "@/lib/alimentos/emparejar";
import { emparejarEjercicio } from "@/lib/ejercicios/emparejar";

type Confianza = "alta" | "revisar" | "sin_match";
type EstadoFila = "pendiente" | "subiendo" | "ok" | "error";

type FilaCarga = {
  id: string;
  archivo: File;
  previa: string;
  nombreCandidato: string;
  confianza: Confianza;
  ejercicioId: string | null;
  sugerencias: Ejercicio[];
  estado: EstadoFila;
  error: string | null;
};

/** Recorta lo que sobra del nombre de archivo antes de emparejar: extensión,
 * numeración de prefijo ("025-press-militar.jpg") y separadores. */
function candidatoDeArchivo(nombreArchivo: string): string {
  return nombreArchivo
    .replace(/\.(jpg|jpeg|png|webp|heic|heif)$/i, "")
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

export function CargaMasivaFotos({ ejercicios }: { ejercicios: Ejercicio[] }) {
  const [filas, setFilas] = useState<FilaCarga[]>([]);
  const [subiendoLote, setSubiendoLote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const agregarArchivos = (lista: FileList | null) => {
    if (!lista) return;
    const nuevas: FilaCarga[] = Array.from(lista).map((archivo) => {
      const { candidato, ejercicioId, confianza, sugerencias } = emparejarPorNombreArchivo(archivo.name, ejercicios);
      return {
        // El mismo archivo soltado dos veces (fácil arrastrando por tandas)
        // generaba la misma key de React con nombre+tamaño+fecha — las dos
        // filas quedaban indistinguibles y "quitar" borraba ambas de un tirón.
        id: crypto.randomUUID(),
        archivo,
        previa: URL.createObjectURL(archivo),
        nombreCandidato: candidato,
        confianza,
        ejercicioId,
        sugerencias,
        estado: "pendiente",
        error: null,
      };
    });
    setFilas((actuales) => [...actuales, ...nuevas]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const asignarEjercicio = (filaId: string, ejercicioId: string) => {
    setFilas((actuales) => actuales.map((f) => (f.id === filaId ? { ...f, ejercicioId, confianza: "alta" } : f)));
  };

  const quitarFila = (filaId: string) => {
    setFilas((actuales) => actuales.filter((f) => f.id !== filaId));
  };

  const subirUna = async (fila: FilaCarga) => {
    if (!fila.ejercicioId) return;
    setFilas((actuales) => actuales.map((f) => (f.id === fila.id ? { ...f, estado: "subiendo", error: null } : f)));
    const datos = new FormData();
    datos.set("ejercicio_id", fila.ejercicioId);
    datos.set("foto", fila.archivo);
    const resultado = await subirFotoEjercicio({ error: null, ok: false }, datos);
    setFilas((actuales) =>
      actuales.map((f) =>
        f.id === fila.id
          ? { ...f, estado: resultado.ok ? "ok" : "error", error: resultado.error }
          : f
      )
    );
  };

  const subirTodasLasSeguras = async () => {
    setSubiendoLote(true);
    const listas = filas.filter((f) => f.confianza === "alta" && f.ejercicioId && f.estado === "pendiente");
    // Secuencial, no en paralelo: cada una ya sube su miniatura + completa a
    // la vez adentro de subirFotoEjercicio — en paralelo entre sí satura la
    // conexión del entrenador sin ganar nada, y esto no es una carrera.
    for (const fila of listas) {
      await subirUna(fila);
    }
    setSubiendoLote(false);
  };

  const pendientesAltaConfianza = filas.filter((f) => f.confianza === "alta" && f.estado === "pendiente").length;
  const terminadas = filas.filter((f) => f.estado === "ok").length;

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          agregarArchivos(e.dataTransfer.files);
        }}
        className="radius-control flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-vip/40 bg-surface p-4 text-center"
      >
        <UploadCloud size={24} className="text-vip" />
        <p className="text-caption font-semibold text-text">Arrastrá varias fotos acá, o tocá para elegir</p>
        <p className="text-micro text-text-tertiary">
          JPG, PNG, WebP o HEIC · el nombre del archivo se compara con el nombre y los alias de cada ejercicio
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          onChange={(e) => agregarArchivos(e.target.files)}
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
                onClick={subirTodasLasSeguras}
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
}: {
  fila: FilaCarga;
  ejercicios: Ejercicio[];
  onAsignar: (ejercicioId: string) => void;
  onSubir: () => void;
  onQuitar: () => void;
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
        {/* eslint-disable-next-line @next/next/no-img-element -- preview local del archivo elegido, nunca pasa por Storage */}
        <img src={fila.previa} alt="" className="h-full w-full object-cover" />
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
            {fila.estado === "subiendo" ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
            Subir
          </button>
        )}
        <button type="button" onClick={onQuitar} aria-label="Quitar de la cola" className="text-text-tertiary">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
