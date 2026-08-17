"use client";

import { useMemo, useRef, useState } from "react";
import { X, Camera, Film, ChevronLeft, ChevronRight, Check, SkipForward, ListChecks } from "lucide-react";
import type { Ejercicio } from "@/lib/ejercicios/tipos";
import { normalizar } from "@/lib/alimentos/emparejar";
import { emparejarEjercicio } from "@/lib/ejercicios/emparejar";
import { crearIngesta, registrarItemIngesta } from "@/app/admin/ejercicios/ingestaActions";
import { guardarIngestaActual, guardarItem } from "@/lib/ejercicios/ingesta/indexedDb";

/**
 * Sesión de grabación (instructivo de galería multimedia §5, Fase 4): una
 * tarjeta a la vez para caminar el gimnasio y capturar sin pensar en
 * clasificación ni en subir ahí mismo. Cada captura se guarda en la MISMA
 * cola persistente que "Subir y organizar" (IndexedDB + ejercicio_ingesta_items,
 * Fase 2) — este componente solo llena esa cola con `ejercicioId` ya
 * resuelto (viene de la lista armada al principio, no de emparejar un
 * nombre de archivo). Subir y aplicar sigue siendo trabajo de
 * `CargaMasivaFotos`: al volver a "Carga masiva" aparece todo lo capturado,
 * listo para revisar.
 */

type FuenteLista = "sinFoto" | "sinVideo" | "conReclamo";
type Orden = "alfabetico" | "zona" | "equipo" | "prioridad";

const ETIQUETAS_ZONA: Record<string, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

type EstadoCaptura = { portada: boolean; demostracion: boolean; noDisponible: boolean };

export function ModoGimnasio({
  ejercicios,
  reportesPorEjercicio,
  onCerrar,
  onIrACargaMasiva,
}: {
  ejercicios: Ejercicio[];
  reportesPorEjercicio: Record<string, number>;
  onCerrar: () => void;
  /** Cambia a la pestaña "Carga masiva" — ahí es donde se revisa y sube todo
   * lo que se va capturando acá. */
  onIrACargaMasiva: () => void;
}) {
  const [paso, setPaso] = useState<"preparar" | "capturando">("preparar");
  const [fuentes, setFuentes] = useState<Set<FuenteLista>>(new Set(["sinFoto", "sinVideo", "conReclamo"]));
  const [orden, setOrden] = useState<Orden>("prioridad");
  const [busqueda, setBusqueda] = useState("");
  const [manualesElegidos, setManualesElegidos] = useState<Set<string>>(new Set());
  const [textoPegado, setTextoPegado] = useState("");

  const listaBase = useMemo(() => {
    const ids = new Set<string>();
    if (fuentes.has("sinFoto")) {
      for (const e of ejercicios) if (!e.fotoMiniaturaUrl && !e.fotoCompletaUrl) ids.add(e.id);
    }
    if (fuentes.has("sinVideo")) {
      for (const e of ejercicios) if (!e.videoCloudflareUid) ids.add(e.id);
    }
    if (fuentes.has("conReclamo")) {
      for (const e of ejercicios) if ((reportesPorEjercicio[e.id] ?? 0) > 0) ids.add(e.id);
    }
    for (const id of manualesElegidos) ids.add(id);
    if (textoPegado.trim()) {
      for (const linea of textoPegado.split(/\r?\n/)) {
        const texto = linea.trim();
        if (!texto) continue;
        const resultado = emparejarEjercicio(texto, ejercicios);
        if (resultado) ids.add(resultado.ejercicio.id);
      }
    }
    return ejercicios.filter((e) => ids.has(e.id));
  }, [ejercicios, fuentes, manualesElegidos, textoPegado, reportesPorEjercicio]);

  const listaOrdenada = useMemo(() => {
    const copia = [...listaBase];
    if (orden === "alfabetico") {
      copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
    } else if (orden === "zona") {
      copia.sort((a, b) => a.grupoMuscular.localeCompare(b.grupoMuscular) || a.nombre.localeCompare(b.nombre, "es"));
    } else if (orden === "equipo") {
      copia.sort((a, b) => a.equipo.localeCompare(b.equipo) || a.nombre.localeCompare(b.nombre, "es"));
    } else {
      copia.sort((a, b) => (reportesPorEjercicio[b.id] ?? 0) - (reportesPorEjercicio[a.id] ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
    }
    return copia;
  }, [listaBase, orden, reportesPorEjercicio]);

  const opcionesBusqueda = busqueda.trim()
    ? ejercicios.filter((e) => normalizar(e.nombre).includes(normalizar(busqueda))).slice(0, 8)
    : [];

  if (paso === "preparar") {
    return (
      <Overlay onCerrar={onCerrar} titulo="Modo gimnasio">
        <div className="space-y-4">
          <div>
            <p className="text-caption mb-1.5 font-semibold text-text">Armar la lista</p>
            <div className="space-y-1.5">
              {([
                ["sinFoto", "Ejercicios sin foto"],
                ["sinVideo", "Ejercicios sin video"],
                ["conReclamo", "Con reclamo de un alumno"],
              ] as [FuenteLista, string][]).map(([valor, etiqueta]) => (
                <label key={valor} className="flex items-center gap-2 text-caption text-text">
                  <input
                    type="checkbox"
                    checked={fuentes.has(valor)}
                    onChange={(e) => {
                      setFuentes((actuales) => {
                        const nuevas = new Set(actuales);
                        if (e.target.checked) nuevas.add(valor);
                        else nuevas.delete(valor);
                        return nuevas;
                      });
                    }}
                  />
                  {etiqueta}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-caption mb-1 font-semibold text-text">Sumar ejercicios puntuales</p>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre…"
              className="radius-control w-full border border-border bg-surface-2 px-3 py-2 text-caption text-text"
            />
            {opcionesBusqueda.length > 0 && (
              <div className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                {opcionesBusqueda.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setManualesElegidos((actuales) => new Set(actuales).add(e.id));
                      setBusqueda("");
                    }}
                    className="block w-full truncate rounded-lg px-2 py-1 text-left text-caption text-text hover:bg-surface-2"
                  >
                    {e.nombre} {manualesElegidos.has(e.id) && "✓"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <details className="rounded-xl border border-border bg-surface-2 p-2.5">
            <summary className="cursor-pointer text-caption font-semibold text-text">
              Pegar una lista de texto (un ejercicio por línea)
            </summary>
            <textarea
              value={textoPegado}
              onChange={(e) => setTextoPegado(e.target.value)}
              rows={4}
              placeholder={"Press de banca\nCurl con barra\n…"}
              className="radius-control mt-2 w-full border border-border bg-surface px-2 py-1.5 text-caption text-text"
            />
            <p className="text-micro mt-1 text-text-tertiary">
              Solo se agregan las líneas que coinciden con un ejercicio existente de la biblioteca.
            </p>
          </details>

          <label className="block">
            <span className="text-caption mb-1 block font-semibold text-text">Orden</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="radius-control w-full border border-border bg-surface-2 px-3 py-2 text-caption text-text"
            >
              <option value="prioridad">Prioridad (reclamos primero)</option>
              <option value="zona">Zona muscular</option>
              <option value="equipo">Equipo/máquina</option>
              <option value="alfabetico">Alfabético</option>
            </select>
          </label>

          <div className="radius-control border border-vip/30 bg-vip/5 p-2.5 text-center">
            <p className="text-caption font-semibold text-text">{listaOrdenada.length} ejercicios en la lista</p>
          </div>

          <button
            type="button"
            disabled={listaOrdenada.length === 0}
            onClick={() => setPaso("capturando")}
            className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-50"
          >
            Empezar
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <TarjetaCaptura
      lista={listaOrdenada}
      onCerrar={onCerrar}
      onTerminar={onIrACargaMasiva}
    />
  );
}

function TarjetaCaptura({
  lista,
  onCerrar,
  onTerminar,
}: {
  lista: Ejercicio[];
  onCerrar: () => void;
  onTerminar: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [avanceAutomatico, setAvanceAutomatico] = useState(true);
  const [capturas, setCapturas] = useState<Record<string, EstadoCaptura>>({});
  const [guardando, setGuardando] = useState<"portada" | "demostracion" | "toma" | null>(null);
  const ingestaIdRef = useRef<string | null>(null);
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const inputVideoRef = useRef<HTMLInputElement>(null);

  const ejercicio = lista[indice];
  const estado = capturas[ejercicio.id] ?? { portada: false, demostracion: false, noDisponible: false };

  async function asegurarIngesta(): Promise<string | null> {
    if (ingestaIdRef.current) return ingestaIdRef.current;
    const resultado = await crearIngesta("modo_gimnasio");
    if (!resultado.ok) return null;
    ingestaIdRef.current = resultado.id;
    await guardarIngestaActual(resultado.id);
    return resultado.id;
  }

  async function capturar(archivo: File, tipo: "imagen" | "video", slot: "portada" | "demostracion" | "toma") {
    setGuardando(slot);
    const ingestaId = await asegurarIngesta();
    if (ingestaId) {
      const id = crypto.randomUUID();
      await guardarItem({
        id,
        ingestaId,
        archivo,
        tipo,
        nombreCandidato: ejercicio.nombre,
        ejercicioId: ejercicio.id,
        confianza: "alta",
        estado: "local",
        progreso: 0,
        error: null,
        creadoEn: Date.now(),
      });
      await registrarItemIngesta({
        id,
        ingestaId,
        nombreArchivo: archivo.name,
        mime: archivo.type,
        tamanoBytes: archivo.size,
        tipo,
        nombreCandidato: ejercicio.nombre,
        confianza: "alta",
        ejercicioId: ejercicio.id,
      });
    }
    setCapturas((actuales) => ({
      ...actuales,
      [ejercicio.id]: {
        ...(actuales[ejercicio.id] ?? { portada: false, demostracion: false, noDisponible: false }),
        portada: slot === "portada" ? true : (actuales[ejercicio.id]?.portada ?? false),
        demostracion: slot === "demostracion" ? true : (actuales[ejercicio.id]?.demostracion ?? false),
      },
    }));
    setGuardando(null);
    if (avanceAutomatico && slot !== "toma" && indice < lista.length - 1) {
      setTimeout(() => setIndice((i) => Math.min(i + 1, lista.length - 1)), 500);
    }
  }

  function marcarNoDisponible() {
    setCapturas((actuales) => ({
      ...actuales,
      [ejercicio.id]: { ...(actuales[ejercicio.id] ?? { portada: false, demostracion: false, noDisponible: false }), noDisponible: true },
    }));
    if (indice < lista.length - 1) setIndice((i) => i + 1);
  }

  const totalCapturados = Object.values(capturas).filter((c) => c.portada || c.demostracion).length;

  return (
    <Overlay onCerrar={onCerrar} titulo="Modo gimnasio">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-caption text-text-tertiary">
          <span>{indice + 1} de {lista.length}</span>
          <span>{totalCapturados} capturados</span>
        </div>

        <div className="radius-card border border-border bg-surface p-4 text-center">
          <p className="text-card-title font-bold uppercase text-text">{ejercicio.nombre}</p>
          <p className="text-caption text-text-tertiary">
            {ejercicio.equipo} · {ETIQUETAS_ZONA[ejercicio.grupoMuscular] ?? ejercicio.grupoMuscular}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className={`radius-control flex h-12 cursor-pointer items-center justify-center gap-1.5 border text-caption font-bold ${estado.portada ? "border-success/40 bg-success/10 text-success" : "border-vip/40 text-vip"}`}>
              {estado.portada ? <Check size={16} /> : <Camera size={16} />}
              {guardando === "portada" ? "Guardando…" : estado.portada ? "Portada guardada" : "Tomar portada"}
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void capturar(f, "imagen", "portada");
                  e.target.value = "";
                }}
              />
            </label>
            <label className={`radius-control flex h-12 cursor-pointer items-center justify-center gap-1.5 border text-caption font-bold ${estado.demostracion ? "border-success/40 bg-success/10 text-success" : "border-vip/40 text-vip"}`}>
              {estado.demostracion ? <Check size={16} /> : <Film size={16} />}
              {guardando === "demostracion" ? "Guardando…" : estado.demostracion ? "Video guardado" : "Grabar demostración"}
              <input
                ref={inputVideoRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void capturar(f, "video", "demostracion");
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          <label className="radius-control mt-2 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 border border-dashed border-border text-caption font-semibold text-text-secondary">
            <Camera size={13} /> Agregar otra toma
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void capturar(f, "imagen", "toma");
                e.target.value = "";
              }}
            />
          </label>

          <button
            type="button"
            onClick={marcarNoDisponible}
            className="mt-2 flex w-full items-center justify-center gap-1.5 py-1 text-caption font-medium text-text-tertiary"
          >
            <SkipForward size={13} /> No disponible hoy
          </button>
        </div>

        <label className="flex items-center gap-2 text-caption text-text-tertiary">
          <input type="checkbox" checked={avanceAutomatico} onChange={(e) => setAvanceAutomatico(e.target.checked)} />
          Avance automático después de capturar
        </label>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            className="radius-control flex h-10 flex-1 items-center justify-center gap-1 border border-border text-caption font-semibold text-text disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <button
            type="button"
            disabled={indice >= lista.length - 1}
            onClick={() => setIndice((i) => Math.min(lista.length - 1, i + 1))}
            className="radius-control flex h-10 flex-1 items-center justify-center gap-1 border border-border text-caption font-semibold text-text disabled:opacity-40"
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={onTerminar}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold"
        >
          <ListChecks size={16} /> Terminar y revisar en Carga masiva
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onCerrar, titulo }: { children: React.ReactNode; onCerrar: () => void; titulo: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" onClick={onCerrar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-4 sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-card-title text-text">{titulo}</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-text-tertiary">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
