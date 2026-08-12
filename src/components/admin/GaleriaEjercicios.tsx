"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Camera, Plus, X, Check, ImageIcon, Play, TriangleAlert, Film, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import {
  subirFotoEjercicio,
  crearEjercicioNuevo,
  actualizarNombreEjercicio,
  actualizarPatronMovimiento,
  desactivarEjercicio,
  quitarVideoEjercicio,
  obtenerUsosRutina,
  reasignarEntradaRutina,
  resolverReporteFoto,
  iniciarSubidaVideoCloudflare,
  confirmarSubidaVideoCloudflare,
  sincronizarVideoCloudflare,
  quitarVideoCloudflare,
  type UsoRutina,
  vincularNombreRutinaSinEjercicio,
  type VincularNombreRutinaState,
} from "@/app/admin/ejercicios/actions";
import { normalizar } from "@/lib/alimentos/emparejar";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { Ejercicio } from "@/lib/ejercicios/tipos";
import type { PatronMovimiento } from "@/lib/rutinas/patrones";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { IlustracionEjercicio } from "@/components/student/IlustracionEjercicio";
import { ModalVideo } from "@/components/student/ModalVideo";
import { CuadroFotoReferencia } from "@/components/student/SesionEjercicioCard";
import type { UsoEjercicioInventario } from "@/lib/ejercicios/inventario";

const ETIQUETAS_GRUPO: Record<string, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

/** Mismo vocabulario que usa el generador para clasificar por nombre (ver
 * `patronMovimiento()` en lib/rutinas/patrones.ts), agrupado por zona para que
 * elegir entre 28 opciones no sea una lista plana interminable. */
const GRUPOS_PATRON: { etiqueta: string; opciones: { valor: PatronMovimiento; etiqueta: string }[] }[] = [
  {
    etiqueta: "Pecho",
    opciones: [
      { valor: "pecho_press_horizontal", etiqueta: "Press horizontal" },
      { valor: "pecho_press_inclinado", etiqueta: "Press inclinado" },
      { valor: "pecho_aislamiento", etiqueta: "Aislamiento (aperturas/cruces)" },
    ],
  },
  {
    etiqueta: "Espalda",
    opciones: [
      { valor: "espalda_traccion_vertical", etiqueta: "Tracción vertical (jalón/dominada)" },
      { valor: "espalda_remo_horizontal", etiqueta: "Remo horizontal" },
      { valor: "espalda_pullover", etiqueta: "Pullover" },
      { valor: "espalda_bisagra", etiqueta: "Bisagra (peso muerto/hiperextensión)" },
      { valor: "espalda_trapecio", etiqueta: "Trapecio (encogimientos)" },
    ],
  },
  {
    etiqueta: "Hombros",
    opciones: [
      { valor: "hombro_press_vertical", etiqueta: "Press vertical" },
      { valor: "hombro_lateral", etiqueta: "Elevación lateral" },
      { valor: "hombro_posterior", etiqueta: "Deltoide posterior" },
      { valor: "hombro_anterior", etiqueta: "Deltoide anterior (frontal)" },
    ],
  },
  {
    etiqueta: "Bíceps",
    opciones: [
      { valor: "biceps_supinado", etiqueta: "Supinado (curl clásico)" },
      { valor: "biceps_neutro", etiqueta: "Neutro (martillo)" },
      { valor: "biceps_hombro_flexionado", etiqueta: "Hombro flexionado (predicador/Scott)" },
    ],
  },
  {
    etiqueta: "Tríceps",
    opciones: [
      { valor: "triceps_polea_abajo", etiqueta: "Hacia abajo (polea)" },
      { valor: "triceps_sobre_cabeza", etiqueta: "Sobre la cabeza (overhead)" },
      { valor: "triceps_compuesto", etiqueta: "Compuesto (fondos/press cerrado)" },
    ],
  },
  {
    etiqueta: "Pierna",
    opciones: [
      { valor: "pierna_dominante_rodilla", etiqueta: "Dominante de rodilla (sentadilla/prensa)" },
      { valor: "pierna_bisagra_cadera", etiqueta: "Bisagra de cadera (peso muerto rumano)" },
      { valor: "pierna_empuje_cadera", etiqueta: "Empuje de cadera (hip thrust)" },
      { valor: "pierna_flexion_rodilla", etiqueta: "Flexión de rodilla (curl femoral)" },
      { valor: "pierna_extension_rodilla", etiqueta: "Extensión de rodilla (cuádriceps)" },
      { valor: "pierna_abduccion", etiqueta: "Abducción" },
      { valor: "pierna_aduccion", etiqueta: "Aducción" },
      { valor: "pierna_pantorrilla", etiqueta: "Pantorrilla" },
    ],
  },
  {
    etiqueta: "Otros",
    opciones: [
      { valor: "core", etiqueta: "Core" },
      { valor: "cardio", etiqueta: "Cardio" },
      { valor: "otro", etiqueta: "Otro / sin encajar" },
    ],
  },
];

const ESTADO_INICIAL_PATRON = { error: null, ok: false };

/**
 * Clasificación biomecánica estructurada de UN ejercicio (columna
 * `patron_movimiento`, migración 0051). Mientras esta columna esté vacía, el
 * motor sigue adivinando el patrón por el nombre — cargarla acá es el primer
 * paso para reemplazar esa heurística por dato real, ejercicio por ejercicio.
 */
function EditorPatronMovimiento({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(actualizarPatronMovimiento, ESTADO_INICIAL_PATRON);

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <span className="text-caption block text-text-tertiary">
        Patrón de movimiento — lo que hoy adivina el generador por el nombre
      </span>
      <select
        name="patron_movimiento"
        defaultValue={ejercicio.patronMovimiento ?? ""}
        className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
      >
        <option value="">Sin clasificar (usar heurística por nombre)</option>
        {GRUPOS_PATRON.map((grupo) => (
          <optgroup key={grupo.etiqueta} label={grupo.etiqueta}>
            {grupo.opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-caption flex items-center gap-1 text-success">
          <Check size={12} /> Patrón guardado.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar patrón"}
      </button>
    </form>
  );
}

export type ReporteFotoPendiente = {
  id: string;
  ejercicioId: string | null;
  nombreEjercicio: string;
  fotoUrl: string | null;
  creadoEn: string;
  alumnoNombre: string;
};

const ESTADO_INICIAL_VINCULO: VincularNombreRutinaState = { error: null, ok: false };

function puntajeParecido(nombreRutina: string, ejercicio: Ejercicio): number {
  const origen = normalizar(nombreRutina);
  const candidatos = [ejercicio.nombre, ...ejercicio.aliases].map(normalizar);
  const tokens = new Set(origen.split(" ").filter((token) => token.length > 2));
  return Math.max(...candidatos.map((candidato) => {
    if (candidato === origen) return 1000;
    let puntos = candidato.includes(origen) || origen.includes(candidato) ? 80 : 0;
    for (const token of tokens) if (candidato.includes(token)) puntos += 12;
    return puntos;
  }));
}

/** Corrector manual para los nombres libres que todavía no apuntan a la
 * biblioteca. La búsqueda filtra los 121 ejercicios y, antes de escribir,
 * muestra candidatos por palabras coincidentes para acelerar variantes. */
function VincularNombreRutina({ item, ejercicios }: { item: { nombre: string; cantidad: number }; ejercicios: Ejercicio[] }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Ejercicio | null>(null);
  const [state, formAction, pending] = useActionState(vincularNombreRutinaSinEjercicio, ESTADO_INICIAL_VINCULO);
  const opciones = useMemo(() => {
    const q = normalizar(busqueda);
    if (q) return ejercicios.filter((ejercicio) => normalizar(`${ejercicio.nombre} ${ejercicio.aliases.join(" ")}`).includes(q)).slice(0, 12);
    return [...ejercicios].sort((a, b) => puntajeParecido(item.nombre, b) - puntajeParecido(item.nombre, a) || a.nombre.localeCompare(b.nombre, "es")).slice(0, 8);
  }, [busqueda, ejercicios, item.nombre]);

  return (
    <div className="border-b border-warning/20 py-2 last:border-0">
      <button type="button" onClick={() => setAbierto((valor) => !valor)} className="flex w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1"><span className="text-caption block font-semibold text-text">{item.nombre}</span><span className="text-micro text-text-tertiary">{item.cantidad} {item.cantidad === 1 ? "aparición" : "apariciones"}</span></span>
        <span className="rounded-full bg-warning/15 px-2 py-1 text-[9px] font-bold text-warning">{abierto ? "CERRAR" : "VINCULAR"}</span>
      </button>
      {abierto && (
        <form action={formAction} className="mt-2 space-y-2 rounded-xl border border-border bg-surface p-2.5">
          <input type="hidden" name="nombre_rutina" value={item.nombre} />
          <input type="hidden" name="ejercicio_id" value={seleccionado?.id ?? ""} />
          <Input value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Buscar ejercicio base…" className="!py-2 text-caption" />
          <div className="scrollbar-fina max-h-48 space-y-1 overflow-y-auto">
            {opciones.map((ejercicio) => (
              <button key={ejercicio.id} type="button" onClick={() => setSeleccionado(ejercicio)} className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${seleccionado?.id === ejercicio.id ? "border-vip bg-vip/10" : "border-border bg-surface-2"}`}>
                <span className="min-w-0 flex-1"><span className="text-caption block font-semibold text-text">{ejercicio.nombre}</span>{ejercicio.aliases.length > 0 && <span className="text-micro block truncate text-text-tertiary">{ejercicio.aliases.join(" · ")}</span>}</span>
                {seleccionado?.id === ejercicio.id && <Check size={15} className="shrink-0 text-vip" />}
              </button>
            ))}
            {opciones.length === 0 && <p className="text-caption px-2 py-3 text-text-tertiary">No hay coincidencias. Prueba otra palabra.</p>}
          </div>
          {seleccionado && <p className="text-caption text-text-secondary">Se unirá <strong className="text-text">{item.nombre}</strong> con <strong className="text-vip">{seleccionado.nombre}</strong> y se guardará como alias.</p>}
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          {state.ok && <p className="text-caption text-success">{state.mensaje}</p>}
          <Button type="submit" size="xs" loading={pending} disabled={!seleccionado}>Vincular todas las apariciones</Button>
        </form>
      )}
    </div>
  );
}

/** La miniatura a mostrar: la foto subida desde acá si existe, si no la
 * ilustración estática de siempre (public/ejercicios/<slug>). Mismo criterio
 * que usa la app del alumno (ver SesionEjercicioCard). */
function fotoDe(ej: Ejercicio): string | null {
  if (ej.fotoMiniaturaUrl) return ej.fotoMiniaturaUrl;
  const { src, origen } = resolverIlustracion(ej.ilustracionSlug, null);
  return origen === "ilustracion" ? src : null;
}

/** El reintento con query string es solo para Storage/CDN. Next 16 bloquea
 * query strings en imágenes locales de /public salvo que se abra un patrón
 * explícito; además esas imágenes locales ya usan `must-revalidate` y no
 * necesitan cache-buster. */
function fotoConReintento(foto: string | null, buster?: number): string | null {
  if (!foto || !buster || foto.startsWith("/")) return foto;
  return `${foto}${foto.includes("?") ? "&" : "?"}r=${buster}`;
}

export function GaleriaEjercicios({
  ejercicios,
  reportes = [],
  usosPorEjercicio = {},
  nombresRutinaSinVincular = [],
}: {
  ejercicios: Ejercicio[];
  reportes?: ReporteFotoPendiente[];
  usosPorEjercicio?: Record<string, UsoEjercicioInventario>;
  nombresRutinaSinVincular?: { nombre: string; cantidad: number }[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Ejercicio | null>(null);
  const [probandoVideo, setProbandoVideo] = useState<Ejercicio | null>(null);
  const [creando, setCreando] = useState<string | null>(null);
  // Justo después de subir una foto nueva, a veces el CDN de Storage todavía
  // no terminó de propagarla y la primera carga falla (el archivo ya está
  // subido de verdad, es solo una demora de segundos). Antes, ese primer
  // fallo quedaba marcado para siempre y solo se arreglaba recargando la
  // página a mano — confuso justo después de ver "Foto actualizada". Ahora
  // se reintenta una vez, con una pequeña demora, antes de darse por
  // vencido y caer al placeholder neutro.
  //
  // El "cache-buster" del reintento tiene que ser realmente único
  // (Date.now(), no un contador chico tipo 1, 2, 3...): Safari puede guardar
  // en caché esa primera respuesta fallida, y una recarga de página nueva
  // vuelve a pedir exactamente la misma URL sin el "?r=" (el estado del
  // reintento se resetea) — con un contador chico, el reintento de ESA
  // sesión nueva puede terminar pidiendo un "?r=1" que ya se había intentado
  // y fallado en una sesión anterior, chocando con esa misma caché vieja.
  // Un timestamp nunca se repite entre sesiones.
  const [erroresFoto, setErroresFoto] = useState<ReadonlySet<string>>(new Set());
  // Solo se lee dentro de su propio updater funcional (más abajo) — no hace
  // falta la variable de lectura acá afuera.
  const [, setYaReintentado] = useState<ReadonlySet<string>>(new Set());
  const [cacheBuster, setCacheBuster] = useState<Readonly<Record<string, number>>>({});

  function onErrorFoto(id: string) {
    setYaReintentado((prev) => {
      if (prev.has(id)) {
        setErroresFoto((s) => new Set(s).add(id));
        return prev;
      }
      setTimeout(() => setCacheBuster((c) => ({ ...c, [id]: Date.now() })), 1500);
      return new Set(prev).add(id);
    });
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ejercicios;
    return ejercicios.filter((e) => e.nombre.toLowerCase().includes(q));
  }, [ejercicios, busqueda]);

  const sinFoto = ejercicios.filter((e) => !e.fotoMiniaturaUrl && !e.fotoCompletaUrl).length;
  const ejerciciosAlfabeticos = useMemo(
    () => [...ejercicios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })),
    [ejercicios],
  );
  const reportesAgrupados = useMemo(() => {
    const grupos = new Map<string, {
      ids: string[];
      ejercicioId: string | null;
      nombre: string;
      nombresReportados: Set<string>;
      alumnos: Set<string>;
      fotoUrl: string | null;
    }>();
    for (const reporte of reportes) {
      // Con ejercicio_id, todos apuntan al mismo problema global aunque la
      // rutina lo haya escrito con otra variante. Sin id, se agrupa por el
      // nombre normalizado para evitar duplicados por mayúsculas o tildes.
      const clave = reporte.ejercicioId
        ? `id:${reporte.ejercicioId}`
        : `nombre:${normalizar(reporte.nombreEjercicio)}`;
      const ejercicio = reporte.ejercicioId ? ejercicios.find((item) => item.id === reporte.ejercicioId) : null;
      const grupo = grupos.get(clave) ?? {
        ids: [],
        ejercicioId: reporte.ejercicioId,
        nombre: ejercicio?.nombre ?? reporte.nombreEjercicio,
        nombresReportados: new Set<string>(),
        alumnos: new Set<string>(),
        fotoUrl: null,
      };
      grupo.ids.push(reporte.id);
      grupo.nombresReportados.add(reporte.nombreEjercicio);
      grupo.alumnos.add(reporte.alumnoNombre);
      grupo.fotoUrl ??= reporte.fotoUrl;
      grupos.set(clave, grupo);
    }
    return Array.from(grupos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  }, [reportes, ejercicios]);

  return (
    <div className="space-y-3">
      {reportes.length > 0 && (
        <section className="space-y-2 rounded-[20px] border border-error/35 bg-error/5 p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-error/15 text-error">
              <TriangleAlert size={17} />
            </span>
            <div>
              <p className="text-caption font-bold text-text">Solicitudes de fotos</p>
              <p className="text-micro text-text-tertiary">Corrige la foto aquí y se actualizará para todos.</p>
            </div>
          </div>
          {reportesAgrupados.map((grupo) => {
            const ejercicio = ejercicios.find((item) => item.id === grupo.ejercicioId);
            const alumnos = Array.from(grupo.alumnos).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
            const nombresReportados = Array.from(grupo.nombresReportados);
            return (
              <Card key={grupo.ejercicioId ?? `nombre:${normalizar(grupo.nombre)}`} padding="p-2.5" className="border-error/25">
                <div className="flex items-center gap-2.5">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {grupo.fotoUrl ? (
                      <Image src={grupo.fotoUrl} alt="Foto reportada" fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-text-tertiary"><ImageIcon size={18} /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-caption font-bold text-text">{grupo.nombre}</p>
                      <span className="rounded-full bg-error/15 px-2 py-0.5 text-[9px] font-bold text-error">
                        {grupo.ids.length} {grupo.ids.length === 1 ? "REPORTE" : "REPORTES"}
                      </span>
                    </div>
                    <p className={`text-micro font-semibold ${grupo.fotoUrl ? "text-error" : "text-vip"}`}>
                      {grupo.fotoUrl ? "La foto no corresponde" : "Falta la foto"}
                    </p>
                    <p className="text-micro text-text-tertiary">
                      Reportaron: {alumnos.join(", ")}
                    </p>
                    {nombresReportados.some((nombre) => nombre !== grupo.nombre) && (
                      <p className="text-micro mt-0.5 text-text-tertiary">En rutinas figura como: {nombresReportados.join(" · ")}</p>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => ejercicio ? setEditando(ejercicio) : setCreando(grupo.nombre)}
                    className="btn-accion radius-control h-9 text-caption font-bold"
                  >
                    {grupo.fotoUrl ? "Corregir ahora" : "Agregar foto"}
                  </button>
                  <form action={resolverReporteFoto}>
                    {grupo.ids.map((id) => <input key={id} type="hidden" name="reporte_id" value={id} />)}
                    <button type="submit" className="radius-control h-9 w-full border border-border text-caption font-semibold text-text-secondary">
                      Resolver todos
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {sinFoto > 0 && (
        <Card padding="p-2.5" className="flex items-center gap-2">
          <ImageIcon size={16} className="shrink-0 text-text-tertiary" />
          <p className="text-caption text-text-secondary">
            {sinFoto} ejercicio{sinFoto === 1 ? "" : "s"} todavía sin foto propia.
          </p>
        </Card>
      )}

      <details id="inventario-ejercicios" className="scroll-mt-28 rounded-[20px] border border-border bg-surface p-3" open>
        <summary className="flex cursor-pointer list-none items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-vip/15 text-vip"><ListChecks size={17} /></span>
          <span className="min-w-0 flex-1"><span className="text-caption block font-bold text-text">Lista completa de ejercicios</span><span className="text-micro block text-text-tertiary">Alfabética · foto real · presencia en rutinas</span></span>
          <span className="rounded-full bg-surface-2 px-2 py-1 text-micro font-bold text-text-secondary">{ejercicios.length}</span>
        </summary>
        <div className="scrollbar-fina mt-3 max-h-[560px] overflow-y-auto rounded-xl border border-border">
          {ejerciciosAlfabeticos.map((ejercicio) => {
            const conFotoPropia = Boolean(ejercicio.fotoMiniaturaUrl || ejercicio.fotoCompletaUrl);
            const uso = usosPorEjercicio[ejercicio.id];
            return (
              <button key={ejercicio.id} type="button" onClick={() => setEditando(ejercicio)} className="flex w-full items-start gap-2 border-b border-border/70 px-3 py-2.5 text-left last:border-0 hover:bg-surface-2">
                <span className={`mt-1 size-2 shrink-0 rounded-full ${conFotoPropia ? "bg-success" : "bg-error"}`} />
                <span className="min-w-0 flex-1">
                  <span className="text-caption block font-semibold text-text">{ejercicio.nombre}</span>
                  <span className="text-micro block text-text-tertiary">
                    {uso?.cantidad
                      ? `En ${uso.cantidad} entrada${uso.cantidad === 1 ? "" : "s"} de rutina${uso.nombres.length ? ` · nombres: ${uso.nombres.map((item) => item.nombre === ejercicio.nombre ? item.nombre : `${item.nombre} (${item.cantidad})`).join(", ")}` : ""}`
                      : "No aparece vinculada en ninguna rutina"}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${conFotoPropia ? "bg-success/12 text-success" : "bg-error/12 text-error"}`}>{conFotoPropia ? "CON FOTO" : "SIN FOTO"}</span>
                <span className={`hidden shrink-0 rounded-full px-2 py-1 text-[9px] font-bold sm:block ${uso?.cantidad ? "bg-vip/12 text-vip" : "bg-surface-2 text-text-tertiary"}`}>{uso?.cantidad ? "EN RUTINAS" : "SIN USO"}</span>
              </button>
            );
          })}
        </div>
        {nombresRutinaSinVincular.length > 0 && (
          <details className="mt-3 rounded-xl border border-warning/35 bg-warning/5 p-3">
            <summary className="cursor-pointer text-caption font-semibold text-warning">{nombresRutinaSinVincular.length} nombres de rutinas todavía sin enlazar a la galería</summary>
            <p className="text-micro mt-1 text-text-tertiary">Abre un nombre, busca el ejercicio base y vincúlalo. Se corrigen todas sus apariciones y queda como alias para el futuro.</p>
            <div className="mt-2">{nombresRutinaSinVincular.map((item) => <VincularNombreRutina key={item.nombre} item={item} ejercicios={ejerciciosAlfabeticos} />)}</div>
          </details>
        )}
        <p className="text-micro mt-2 text-text-tertiary">Toca cualquier nombre para abrir su foto y sus datos. Los nombres de rutina se muestran tal como fueron escritos; el encabezado siempre usa el nombre oficial de la base.</p>
      </details>

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ejercicio..."
          className="radius-control text-caption w-full border border-border bg-surface py-2 pl-8 pr-3 text-text"
        />
      </div>

      <button
        type="button"
        onClick={() => setCreando("")}
        className="radius-control flex w-full items-center justify-center gap-2 border border-dashed border-vip/50 py-3 text-secondary font-semibold text-vip"
      >
        <Plus size={16} /> Ejercicio nuevo, con foto
      </button>

      <div className="space-y-3">
        {filtrados.map((ej) => {
          const fotoBase = erroresFoto.has(ej.id) ? null : fotoDe(ej);
          const buster = cacheBuster[ej.id];
          // El "?r=<timestamp>" fuerza a next/image a pedirla de nuevo en vez
          // de repetir el mismo fallo cacheado — solo se agrega a partir del
          // reintento, y con un valor que nunca choca con uno de antes.
          const foto = fotoConReintento(fotoBase, buster);
          return (
            <Card key={ej.id} padding="p-0" className="tarjeta-modelo-oscura overflow-hidden border-white/10 bg-black">
              <div className="flex items-center gap-2 px-3 pb-2 pt-3">
                <IlustracionEjercicio
                  ilustracionSlug={null}
                  grupoMuscular={ej.grupoMuscular}
                  nombre={ej.nombre}
                  tamano={30}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                    Vista del alumno · {ETIQUETAS_GRUPO[ej.grupoMuscular] ?? ej.grupoMuscular}
                  </p>
                  <p className="text-caption truncate font-bold text-vip">{ej.nombre}</p>
                </div>
                {ej.videoUrl && (
                  <span className="flex items-center gap-1 rounded-full bg-vip/10 px-2 py-1 text-[9px] font-bold text-vip">
                    <Play size={10} fill="currentColor" /> VIDEO
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => (ej.videoUrl ? setProbandoVideo(ej) : setEditando(ej))}
                aria-label={ej.videoUrl ? `Probar video de ${ej.nombre}` : `Editar foto de ${ej.nombre}`}
                className="relative mx-3 flex aspect-video h-auto w-[calc(100%_-_24px)] overflow-hidden rounded-[20px] border border-white/15 bg-black text-left"
              >
                  {foto ? (
                    <>
                      <Image
                        src={foto}
                        alt=""
                        aria-hidden
                        fill
                        sizes="(max-width: 640px) calc(100vw - 56px), 420px"
                        className="scale-110 object-cover opacity-45 blur-xl"
                        style={{ objectPosition: `${ej.fotoPanoramaX}% ${ej.fotoPanoramaY}%` }}
                      />
                      <Image
                        src={foto}
                        alt={ej.nombre}
                        fill
                        sizes="(max-width: 640px) calc(100vw - 56px), 420px"
                        className="z-[1] object-contain object-center"
                        onError={() => onErrorFoto(ej.id)}
                      />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <ImageIcon size={26} />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 z-[2] flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm">
                    {ej.videoUrl ? <Play size={12} fill="currentColor" /> : <Camera size={13} />}
                  </span>
              </button>

              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setEditando(ej)}
                  className="radius-control flex h-9 items-center justify-center gap-1.5 border border-border bg-surface-2 text-caption font-semibold text-text"
                >
                  <Camera size={13} /> Foto y datos
                </button>
                <button
                  type="button"
                  onClick={() => (ej.videoUrl ? setProbandoVideo(ej) : setEditando(ej))}
                  className="radius-control flex h-9 items-center justify-center gap-1.5 border border-border bg-surface-2 text-caption font-semibold text-vip"
                >
                  <Play size={13} fill="currentColor" /> {ej.videoUrl ? "Probar video" : "Agregar video"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <Card>
          <p className="text-body text-text-secondary">Ningún ejercicio coincide con la búsqueda.</p>
        </Card>
      )}

      {editando && (
        <ModalSubirFoto
          ejercicio={editando}
          fotoActual={fotoDe(editando)}
          todosLosEjercicios={ejercicios}
          onCerrar={() => setEditando(null)}
        />
      )}
      {probandoVideo?.videoUrl && (
        <ModalVideo
          videoUrl={probandoVideo.videoUrl}
          nombre={probandoVideo.nombre}
          onCerrar={() => setProbandoVideo(null)}
        />
      )}
      {creando !== null && <ModalEjercicioNuevo nombreInicial={creando} onCerrar={() => setCreando(null)} />}
    </div>
  );
}

const LADO_MAXIMO_FOTO = 1600;

/** Produce el único archivo que usa la app: suficientemente nítido al
 * ampliarlo y liviano para descargarlo como miniatura. Todo ocurre en el
 * teléfono; los bytes nunca pasan por Vercel. */
async function optimizarFotoEnNavegador(archivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, LADO_MAXIMO_FOTO / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen.");
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86)
    );
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
  } catch {
    // JPEG/PNG/WebP ya son mostrables por todos los navegadores de la app.
    // Si el canvas puntual del dispositivo falla, subir el archivo original
    // sigue siendo mejor que volver al servidor que corrompía sus bytes.
    if (["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return archivo;
    throw new Error("El teléfono no pudo convertir esa foto. Elige una imagen JPG o PNG.");
  }
}

type FotoSubidaCliente = { miniaturaUrl: string; completaUrl: string };

/**
 * Vista previa inmediata y subida directa navegador → Supabase. El servidor
 * recibe solamente la URL final, nunca el archivo binario.
 */
function useFotoInmediata() {
  const [archivoElegido, setArchivoElegido] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [previaRota, setPreviaRota] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoSubida, setFotoSubida] = useState<FotoSubidaCliente | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const urlPrevia = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    };
  }, []);

  function mostrarPrevia(blob: Blob) {
    if (urlPrevia.current) URL.revokeObjectURL(urlPrevia.current);
    urlPrevia.current = URL.createObjectURL(blob);
    setPrevia(urlPrevia.current);
    setPreviaRota(false);
  }

  async function subir(archivo: File) {
    setSubiendoFoto(true);
    setErrorFoto(null);
    setFotoSubida(null);
    try {
      const fotoLista = await optimizarFotoEnNavegador(archivo);
      mostrarPrevia(fotoLista);

      const supabase = createBrowserSupabaseClient();
      const ruta = `sueltas/${crypto.randomUUID()}/foto.jpg`;
      const { error } = await supabase.storage.from("ejercicios-fotos").upload(ruta, fotoLista, {
        contentType: fotoLista.type || "image/jpeg",
        cacheControl: "31536000",
      });
      if (error) throw error;

      const url = supabase.storage.from("ejercicios-fotos").getPublicUrl(ruta).data.publicUrl;
      setFotoSubida({ miniaturaUrl: url, completaUrl: url });
    } catch (error) {
      setErrorFoto(
        error instanceof Error
          ? error.message
          : "No se pudo subir la foto. Revisa tu conexión e intenta de nuevo."
      );
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function elegirArchivo(archivo: File) {
    setArchivoElegido(archivo);
    // Visible de inmediato, antes incluso de comprimir o tocar la red.
    mostrarPrevia(archivo);
    await subir(archivo);
  }

  function reintentar() {
    if (archivoElegido) void subir(archivoElegido);
  }

  return {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  };
}

function Overlay({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  // `createPortal` a `document.body`: es el único modal de esta pantalla que
  // NO lo hacía (todos los demás de la app sí, ver AbandonarSesionBoton,
  // ReiniciarRutinaBoton, etc.). Al quedar montado adentro del contenedor con
  // scroll de la página (`.pantalla-scroll`) en vez de directo en el body,
  // cuando el alumno... el entrenador volvía de elegir la foto (cámara o
  // galería), Safari intentaba llevarlo al elemento que había quedado
  // enfocado y terminaba scrolleando esa columna entera hasta arriba del
  // todo — el modal seguía viéndose bien (es `fixed`), pero por detrás la
  // página había saltado, y al cerrarlo aparecía arriba de todo en vez de
  // donde estaba.
  return createPortal(
    <div
      role="dialog"
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="radius-card max-h-[85vh] w-full max-w-md overflow-y-auto bg-surface p-4"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

const ESTADO_INICIAL_FOTO = { error: null, ok: false };
const ESTADO_INICIAL_NOMBRE = { error: null, ok: false };
const ESTADO_INICIAL_ELIMINAR = { error: null, ok: false };

/** Eliminar un ejercicio de la galería, con confirmación en dos pasos. En
 * realidad lo desactiva (`activo = false`, ver `desactivarEjercicio` en
 * actions.ts) — las rutinas que ya lo usan lo siguen mostrando igual, solo
 * deja de listarse y de ofrecerse para rutinas nuevas. */
function BotonEliminar({ ejercicio, onEliminado }: { ejercicio: Ejercicio; onEliminado: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [state, formAction, pending] = useActionState(desactivarEjercicio, ESTADO_INICIAL_ELIMINAR);

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onEliminado, 500);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-caption font-medium text-error"
      >
        Eliminar de la galería
      </button>
    );
  }

  return (
    <div className="radius-control space-y-1.5 border border-error/40 bg-error/5 p-2">
      <p className="text-caption text-text">
        Deja de aparecer en la galería y de ofrecerse para rutinas nuevas. Las rutinas que ya usan esta
        foto no se rompen — la siguen mostrando igual.
      </p>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      <form action={formAction} className="flex gap-2">
        <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
        <Button type="submit" variant="destructive" size="xsAuto" loading={pending}>
          Sí, eliminar
        </Button>
        <Button type="button" variant="ghost" size="xsAuto" onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
      </form>
    </div>
  );
}

/** Todas las formas conocidas de nombrar el ejercicio, en el formato que
 * escribe el entrenador: "Press de pecho / Bench press / Press banca". La
 * primera es el nombre que se ve en la galería; el resto son los alias que
 * usa `emparejarEjercicio` para reconocer el mismo movimiento en una rutina
 * nueva, sin importar cómo lo haya escrito. */
function nombresComoTexto(ejercicio: Ejercicio): string {
  return [ejercicio.nombre, ...ejercicio.aliases].join(" / ");
}

function EditorNombre({ ejercicio }: { ejercicio: Ejercicio }) {
  const [state, formAction, pending] = useActionState(actualizarNombreEjercicio, ESTADO_INICIAL_NOMBRE);

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
      <span className="text-caption block text-text-tertiary">
        Nombre — separá variantes con &quot;/&quot; para que cualquiera muestre esta misma foto
      </span>
      <Textarea
        name="nombres"
        required
        rows={2}
        defaultValue={nombresComoTexto(ejercicio)}
        placeholder="Ej: Press de pecho / Bench press / Press banca"
        className="!py-2 text-caption"
      />
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      {state.ok && (
        <p className="text-caption flex items-center gap-1 text-success">
          <Check size={12} /> Nombre guardado.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="radius-control flex h-9 w-full items-center justify-center gap-2 border border-border text-caption font-medium text-text disabled:opacity-60"
      >
        {pending ? "Guardando..." : "Guardar nombre"}
      </button>
    </form>
  );
}

const ESTADO_INICIAL_QUITAR_VIDEO = { error: null, ok: false };
const ESTADO_INICIAL_QUITAR_CLOUDFLARE = { error: null, ok: false };

function duracionVideo(archivo: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const video = document.createElement("video");
    const terminar = (valor: number | null) => {
      URL.revokeObjectURL(url);
      resolve(valor);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => terminar(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => terminar(null);
    video.src = url;
  });
}

function subirDirectoCloudflare(endpoint: string, archivo: File, onProgreso: (valor: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) onProgreso(Math.round((evento.loaded / evento.total) * 100));
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("upload"));
    xhr.onerror = () => reject(new Error("network"));
    const datos = new FormData();
    datos.append("file", archivo);
    xhr.send(datos);
  });
}

function EditorVideoCloudflare({ ejercicio }: { ejercicio: Ejercicio }) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [estadoQuitar, accionQuitar, quitando] = useActionState(
    quitarVideoCloudflare,
    ESTADO_INICIAL_QUITAR_CLOUDFLARE
  );

  useEffect(() => {
    if (ejercicio.videoCloudflareEstado !== "procesando") return;
    let cancelado = false;
    const comprobar = async () => {
      const estado = await sincronizarVideoCloudflare(ejercicio.id);
      if (!cancelado && (estado === "listo" || estado === "error")) router.refresh();
    };
    void comprobar();
    const intervalo = window.setInterval(() => void comprobar(), 8_000);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
    };
  }, [ejercicio.id, ejercicio.videoCloudflareEstado, router]);

  async function elegir(archivo: File) {
    setError(null);
    setMensaje(null);
    if (archivo.size > 100 * 1024 * 1024) {
      setError("El video supera el máximo de 100 MB.");
      return;
    }
    const duracion = await duracionVideo(archivo);
    if (duracion !== null && duracion > 30.5) {
      setError("El clip debe durar 30 segundos o menos.");
      return;
    }
    setSubiendo(true);
    setProgreso(0);
    try {
      const inicio = await iniciarSubidaVideoCloudflare(ejercicio.id, archivo.size, archivo.type);
      if (!inicio.ok) {
        setError(inicio.error);
        return;
      }
      await subirDirectoCloudflare(inicio.endpoint, archivo, setProgreso);
      await confirmarSubidaVideoCloudflare(ejercicio.id);
      setMensaje("Video recibido. Cloudflare está preparando la reproducción.");
    } catch {
      setError("La subida se interrumpió. Intenta nuevamente.");
    } finally {
      setSubiendo(false);
    }
  }

  const estado = ejercicio.videoCloudflareEstado;
  return (
    <div className="space-y-2">
      <div>
        <p className="text-caption font-semibold text-text">Clip automático del ejercicio</p>
        <p className="text-micro text-text-tertiary">MP4, MOV o WebM · máximo 30 segundos y 100 MB</p>
      </div>
      {estado && (
        <p className={`text-caption ${estado === "error" ? "text-error" : estado === "listo" ? "text-success" : "text-text-secondary"}`}>
          {estado === "subiendo" ? "Subiendo" : estado === "procesando" ? "Procesando en Cloudflare" : estado === "listo" ? "Listo para el alumno" : "Error al procesar"}
          {estado === "listo" && ejercicio.videoCloudflareDuracionSeg != null ? ` · ${Math.round(ejercicio.videoCloudflareDuracionSeg)} s` : ""}
          {estado === "error" && ejercicio.videoCloudflareError ? ` · ${ejercicio.videoCloudflareError}` : ""}
        </p>
      )}
      {subiendo && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`Subida ${progreso}%`}>
          <div className="h-full bg-vip transition-[width]" style={{ width: `${progreso}%` }} />
        </div>
      )}
      <label className={`radius-control flex h-10 w-full items-center justify-center gap-2 border border-vip/40 text-caption font-semibold text-vip ${subiendo ? "opacity-50" : "cursor-pointer"}`}>
        <Film size={16} /> {subiendo ? `Subiendo ${progreso}%` : ejercicio.videoCloudflareUid ? "Reemplazar clip" : "Subir clip"}
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          disabled={subiendo}
          className="sr-only"
          onChange={(evento) => {
            const archivo = evento.target.files?.[0];
            if (archivo) void elegir(archivo);
            evento.target.value = "";
          }}
        />
      </label>
      {mensaje && <p className="text-caption text-success">{mensaje}</p>}
      {error && <p className="text-caption text-error">{error}</p>}
      {estadoQuitar.error && <p className="text-caption text-error">{estadoQuitar.error}</p>}
      {ejercicio.videoCloudflareUid && (
        <form action={accionQuitar}>
          <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
          <button type="submit" disabled={quitando} className="text-caption font-medium text-text-tertiary disabled:opacity-50">
            {quitando ? "Quitando…" : "Quitar clip de Cloudflare"}
          </button>
        </form>
      )}
    </div>
  );
}

function EditorVideoAnterior({ ejercicio }: { ejercicio: Ejercicio }) {
  const [estadoQuitar, accionQuitar, pendingQuitar] = useActionState(
    quitarVideoEjercicio,
    ESTADO_INICIAL_QUITAR_VIDEO
  );

  if (!ejercicio.videoUrl) return null;

  return (
    <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="text-caption font-semibold text-text">Video anterior detectado</p>
      <p className="text-micro text-text-tertiary">
        Los enlaces de YouTube están desactivados. Puedes borrarlo ahora o subir un clip nuevo;
        al vincular Cloudflare Stream se quitará automáticamente.
      </p>
      <form action={accionQuitar}>
        <input type="hidden" name="ejercicio_id" value={ejercicio.id} />
        {estadoQuitar.error && <p className="text-caption mb-1 text-error">{estadoQuitar.error}</p>}
        {estadoQuitar.ok && <p className="text-caption mb-1 text-success">Video anterior eliminado.</p>}
        <button
          type="submit"
          disabled={pendingQuitar}
          className="radius-control flex h-9 w-full items-center justify-center border border-border text-caption font-semibold text-text disabled:opacity-60"
        >
          {pendingQuitar ? "Eliminando..." : "Eliminar video anterior"}
        </button>
      </form>
    </div>
  );
}

type PosicionFoto = { x: number; y: number };

function EncuadreArrastrable({
  src,
  nombre,
  formato,
  posicion,
  onChange,
  onError,
}: {
  src: string;
  nombre: string;
  formato: "panorama" | "cuadrado";
  posicion: PosicionFoto;
  onChange: (posicion: PosicionFoto) => void;
  onError: () => void;
}) {
  const inicio = useRef<{ clientX: number; clientY: number; posicion: PosicionFoto } | null>(null);

  const mover = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (!inicio.current) return;
    const rect = evento.currentTarget.getBoundingClientRect();
    const dx = ((evento.clientX - inicio.current.clientX) / rect.width) * 100;
    const dy = ((evento.clientY - inicio.current.clientY) / rect.height) * 100;
    const limitar = (valor: number) => Math.min(100, Math.max(0, valor));
    onChange({
      x: limitar(inicio.current.posicion.x - dx),
      y: limitar(inicio.current.posicion.y - dy),
    });
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-caption font-semibold text-text">{nombre}</p>
        <span className="text-micro text-text-tertiary">Arrastra para centrar</span>
      </div>
      <div
        className={`relative touch-none select-none overflow-hidden border border-vip/35 bg-surface-2 ${
          formato === "panorama" ? "h-[112px] w-full rounded-[20px]" : "mx-auto aspect-square w-[160px] rounded-[20px]"
        }`}
        onPointerDown={(evento) => {
          inicio.current = { clientX: evento.clientX, clientY: evento.clientY, posicion };
          evento.currentTarget.setPointerCapture(evento.pointerId);
        }}
        onPointerMove={mover}
        onPointerUp={() => { inicio.current = null; }}
        onPointerCancel={() => { inicio.current = null; }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={nombre}
          draggable={false}
          className="pointer-events-none h-full w-full object-cover"
          style={{ objectPosition: `${posicion.x}% ${posicion.y}%` }}
          onError={onError}
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="size-5 rounded-full border border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,.35)]" />
        </span>
      </div>
    </div>
  );
}

function ModalSubirFoto({
  ejercicio,
  fotoActual,
  todosLosEjercicios,
  onCerrar,
}: {
  ejercicio: Ejercicio;
  fotoActual: string | null;
  todosLosEjercicios: Ejercicio[];
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(subirFotoEjercicio, ESTADO_INICIAL_FOTO);
  const {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  } = useFotoInmediata();

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onCerrar, 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const imagenAMostrar = previa ?? fotoActual;
  const [panorama, setPanorama] = useState({ x: ejercicio.fotoPanoramaX, y: ejercicio.fotoPanoramaY });
  const [cuadrada, setCuadrada] = useState({ x: ejercicio.fotoCuadradaX, y: ejercicio.fotoCuadradaY });

  return (
    <Overlay onCerrar={onCerrar}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-card-title min-w-0 truncate text-text">{ejercicio.nombre}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      {imagenAMostrar && !previaRota ? (
        <div className="space-y-3">
          <p className="text-caption text-text-secondary">
            Mueve la foto con el dedo. Cada formato guarda su propio centro.
          </p>
          <EncuadreArrastrable src={imagenAMostrar} nombre="Vista rectangular del alumno" formato="panorama" posicion={panorama} onChange={setPanorama} onError={() => setPreviaRota(true)} />
          <EncuadreArrastrable src={imagenAMostrar} nombre="Vista cuadrada del alumno" formato="cuadrado" posicion={cuadrada} onChange={setCuadrada} onError={() => setPreviaRota(true)} />
          <label className="radius-control flex h-10 w-full cursor-pointer items-center justify-center gap-2 border border-border text-caption font-semibold text-text">
            <Camera size={15} /> Elegir o tomar otra foto
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void elegirArchivo(f);
            }} />
          </label>
        </div>
      ) : (
        <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
          <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
            <Camera size={26} />
            <span className="text-caption">
              {previaRota
                ? "No se pudo mostrar esta imagen. Elige una foto JPG o PNG."
                : "Toca para elegir una foto"}
            </span>
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="absolute inset-0 h-full w-full opacity-0" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void elegirArchivo(f);
          }} />
        </label>
      )}
      <div className="relative">
        {/* Estado de la preparación y subida directa a Storage. */}
        {(subiendoFoto || fotoSubida || errorFoto) && (
          <span
            className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
              errorFoto ? "bg-error/80 text-white" : "bg-black/60 text-white"
            }`}
          >
            {subiendoFoto ? "Preparando foto..." : errorFoto ? "No se pudo subir" : "✓ Lista para guardar"}
          </span>
        )}
      </div>
      {errorFoto && (
        <button
          type="button"
          onClick={reintentar}
          className="text-caption mt-1 font-medium text-vip"
        >
          Reintentar subir la foto
        </button>
      )}

      <form
        action={(fd) => {
          if (fotoSubida) {
            fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
            fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
          }
          fd.set("ejercicio_id", ejercicio.id);
          formAction(fd);
        }}
        className="mt-3 space-y-2"
      >
        <input type="hidden" name="foto_panorama_x" value={panorama.x} />
        <input type="hidden" name="foto_panorama_y" value={panorama.y} />
        <input type="hidden" name="foto_cuadrada_x" value={cuadrada.x} />
        <input type="hidden" name="foto_cuadrada_y" value={cuadrada.y} />
        {/* Alternativa para una imagen que ya está publicada en otro sitio. */}
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        {/* Corrección global explícita: esto reemplaza la foto para TODOS
            los alumnos que tengan este ejercicio bien vinculado, no solo
            para quien lo esté editando ahora — hay que dejarlo claro antes
            de guardar, no después. */}
        <p className="text-caption text-text-tertiary">
          Se va a actualizar la foto de{" "}
          <span className="font-semibold text-text">{ejercicio.nombre}</span> para todos los alumnos
          que lo tengan bien vinculado.
        </p>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Foto actualizada — ya la ven los alumnos.
          </p>
        )}
        <button
          type="submit"
          disabled={pending || subiendoFoto || (!!archivoElegido && !fotoSubida)}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Guardando..." : subiendoFoto ? "Preparando la foto..." : "Guardar foto y encuadres"}
        </button>
      </form>

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2">
          <p className="text-caption font-semibold text-text">Vista previa del alumno</p>
          <p className="text-micro text-text-tertiary">Mismo formato 16:9 del ejercicio activo</p>
        </div>
        <CuadroFotoReferencia
          ilustracionSlug={ejercicio.ilustracionSlug}
          fotoMiniaturaUrl={imagenAMostrar ?? ejercicio.fotoMiniaturaUrl}
          fotoCompletaUrl={imagenAMostrar ?? ejercicio.fotoCompletaUrl}
          videoUrl={ejercicio.videoUrl}
          videoCloudflareUid={ejercicio.videoCloudflareUid}
          videoCloudflareEstado={ejercicio.videoCloudflareEstado}
          videoCloudflareMiniaturaUrl={ejercicio.videoCloudflareMiniaturaUrl}
          nombre={ejercicio.nombre}
          ejercicioId={ejercicio.id}
          fotoPanoramaX={panorama.x}
          fotoPanoramaY={panorama.y}
          fotoCuadradaX={cuadrada.x}
          fotoCuadradaY={cuadrada.y}
          destacado
          reproducirAutomaticamente={ejercicio.videoCloudflareEstado === "listo"}
        />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorNombre ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorPatronMovimiento ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorVideoAnterior ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <EditorVideoCloudflare ejercicio={ejercicio} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <UsosRutinaEditor ejercicio={ejercicio} todosLosEjercicios={todosLosEjercicios} />
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <BotonEliminar ejercicio={ejercicio} onEliminado={onCerrar} />
      </div>
    </Overlay>
  );
}

type ElegidoReasignar = { id: string; nombre: string };

const ESTADO_INICIAL_REASIGNAR = { error: null, ok: false };

/**
 * Para ESTE ejercicio de la biblioteca: todas las variantes de texto que hoy
 * usan su enlace en rutinas de alumnos (ver `obtenerUsosRutina`) — y deja
 * corregir un enlace mal hecho SIN tocar la foto de nadie (ver
 * `reasignarEntradaRutina` en actions.ts).
 *
 * Caso real que resuelve: "Press de hombro" quedó vinculado por error al
 * registro de "Press de banca" — acá aparece listado bajo Press de banca, y
 * se puede reasignar hacia el ejercicio correcto sin arriesgar la foto de
 * los alumnos que sí tienen el press de banca bien vinculado.
 */
function UsosRutinaEditor({
  ejercicio,
  todosLosEjercicios,
}: {
  ejercicio: Ejercicio;
  todosLosEjercicios: Ejercicio[];
}) {
  const [usos, setUsos] = useState<UsoRutina[] | null>(null);

  useEffect(() => {
    let cancelado = false;
    obtenerUsosRutina(ejercicio.id).then((resultado) => {
      if (!cancelado) setUsos(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [ejercicio.id]);

  if (usos === null) {
    return <p className="text-caption text-text-tertiary">Revisando entradas de rutina...</p>;
  }
  if (usos.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-caption block text-text-tertiary">
        Entradas de rutina que usan esta ficha — si alguna en realidad es OTRO ejercicio, reasignala sin
        tocar esta foto
      </span>
      <div className="space-y-1.5">
        {usos.map((uso) => (
          <UsoRutinaFila
            key={uso.nombre}
            ejercicio={ejercicio}
            uso={uso}
            todosLosEjercicios={todosLosEjercicios}
            onReasignado={() => setUsos((prev) => (prev ? prev.filter((u) => u.nombre !== uso.nombre) : prev))}
          />
        ))}
      </div>
    </div>
  );
}

function UsoRutinaFila({
  ejercicio,
  uso,
  todosLosEjercicios,
  onReasignado,
}: {
  ejercicio: Ejercicio;
  uso: UsoRutina;
  todosLosEjercicios: Ejercicio[];
  onReasignado: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [elegido, setElegido] = useState<ElegidoReasignar | null>(null);
  const [state, formAction, pending] = useActionState(reasignarEntradaRutina, ESTADO_INICIAL_REASIGNAR);

  useEffect(() => {
    if (state.ok) onReasignado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return [];
    return todosLosEjercicios
      .filter((e) => e.id !== ejercicio.id)
      .filter((e) => normalizar(e.nombre).includes(q) || e.aliases.some((a) => normalizar(a).includes(q)))
      .slice(0, 6);
  }, [busqueda, todosLosEjercicios, ejercicio.id]);

  return (
    <div className="radius-control border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text">
          <span className="font-semibold">«{uso.nombre}»</span> — {uso.cantidad}{" "}
          {uso.cantidad === 1 ? "vez" : "veces"} en rutinas
        </p>
        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="shrink-0 text-[10px] font-medium text-vip"
          >
            ¿No es este?
          </button>
        )}
      </div>

      {abierto && !elegido && (
        <div className="mt-2 space-y-1.5">
          <input
            type="text"
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar el ejercicio correcto..."
            className="radius-control w-full border border-border bg-surface px-2 py-1.5 text-caption text-text"
          />
          {resultados.length > 0 && (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setElegido({ id: r.id, nombre: r.nombre })}
                  className="block w-full rounded px-2 py-1.5 text-left text-caption text-text hover:bg-surface-2"
                >
                  {r.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setElegido({ id: "", nombre: "sin vincular todavía" })}
              className="text-[10px] text-text-tertiary underline"
            >
              No existe todavía — desvincular sin foto por ahora
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setBusqueda("");
              }}
              className="text-[10px] text-text-tertiary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {elegido && (
        <form action={formAction} className="radius-control mt-2 space-y-1.5 border border-vip/40 bg-vip/5 p-2">
          <input type="hidden" name="ejercicio_id_actual" value={ejercicio.id} />
          <input type="hidden" name="nombre_exacto" value={uso.nombre} />
          <input type="hidden" name="ejercicio_id_nuevo" value={elegido.id} />
          <p className="text-caption text-text">
            Se van a mover las {uso.cantidad} entrada{uso.cantidad === 1 ? "" : "s"} «{uso.nombre}» de{" "}
            <span className="font-semibold">{ejercicio.nombre}</span> hacia{" "}
            <span className="font-semibold">{elegido.nombre}</span>. No se toca ninguna foto.
          </p>
          {state.error && <p className="text-caption text-error">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="xsAuto" loading={pending}>
              Confirmar
            </Button>
            <Button type="button" variant="ghost" size="xsAuto" onClick={() => setElegido(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

const ESTADO_INICIAL_CREAR = { error: null, ok: false };

const GRUPOS: { valor: string; etiqueta: string }[] = [
  { valor: "pecho", etiqueta: "Pecho" },
  { valor: "espalda", etiqueta: "Espalda" },
  { valor: "piernas", etiqueta: "Piernas" },
  { valor: "hombros", etiqueta: "Hombros" },
  { valor: "brazos", etiqueta: "Brazos" },
  { valor: "core", etiqueta: "Core" },
  { valor: "cardio", etiqueta: "Cardio" },
];
const CATEGORIAS: { valor: string; etiqueta: string }[] = [
  { valor: "empuje", etiqueta: "Empuje" },
  { valor: "traccion", etiqueta: "Tracción" },
  { valor: "pierna", etiqueta: "Pierna" },
  { valor: "core", etiqueta: "Core" },
  { valor: "cardio", etiqueta: "Cardio" },
  { valor: "aislamiento", etiqueta: "Aislamiento" },
  { valor: "full_body", etiqueta: "Full body" },
];
const EQUIPOS: { valor: string; etiqueta: string }[] = [
  { valor: "barra", etiqueta: "Barra" },
  { valor: "mancuerna", etiqueta: "Mancuerna" },
  { valor: "polea", etiqueta: "Polea" },
  { valor: "maquina", etiqueta: "Máquina" },
  { valor: "smith", etiqueta: "Smith" },
  { valor: "peso_corporal", etiqueta: "Peso corporal" },
  { valor: "kettlebell", etiqueta: "Kettlebell" },
  { valor: "banda", etiqueta: "Banda" },
  { valor: "banco", etiqueta: "Banco" },
  { valor: "otro", etiqueta: "Otro" },
];

function ModalEjercicioNuevo({ nombreInicial = "", onCerrar }: { nombreInicial?: string; onCerrar: () => void }) {
  const [state, formAction, pending] = useActionState(crearEjercicioNuevo, ESTADO_INICIAL_CREAR);
  const [grupoNuevo, setGrupoNuevo] = useState("");
  const patronesVisibles = useMemo(() => {
    const etiquetasPorGrupo: Record<string, string[]> = {
      pecho: ["Pecho"],
      espalda: ["Espalda"],
      piernas: ["Pierna"],
      hombros: ["Hombros"],
      brazos: ["Bíceps", "Tríceps"],
      core: ["Otros"],
      cardio: ["Otros"],
    };
    const etiquetas = etiquetasPorGrupo[grupoNuevo] ?? [];
    return GRUPOS_PATRON
      .filter((grupo) => etiquetas.includes(grupo.etiqueta))
      .map((grupo) => ({
        ...grupo,
        opciones: grupo.etiqueta === "Otros"
          ? grupo.opciones.filter((opcion) => opcion.valor === grupoNuevo || opcion.valor === "otro")
          : grupo.opciones,
      }));
  }, [grupoNuevo]);
  const {
    archivoElegido,
    previa,
    previaRota,
    setPreviaRota,
    subiendoFoto,
    fotoSubida,
    errorFoto,
    elegirArchivo,
    reintentar,
  } = useFotoInmediata();

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(onCerrar, 900);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <Overlay onCerrar={onCerrar}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-card-title text-text">Ejercicio nuevo</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      <form
        action={(fd) => {
          if (fotoSubida) {
            fd.set("foto_miniatura_url_subida", fotoSubida.miniaturaUrl);
            fd.set("foto_completa_url_subida", fotoSubida.completaUrl);
          }
          formAction(fd);
        }}
        className="space-y-3"
      >
        {/* La misma foto sirve como tarjeta cuadrada y vista ampliada. */}
      <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
          {previa && !previaRota ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPreviaRota(true)}
            />
          ) : (
            <span className="flex flex-col items-center gap-1 px-4 text-center text-text-tertiary">
              <Camera size={26} />
              <span className="text-caption">
                {previaRota
                  ? "No se pudo mostrar esta imagen. Elige una foto JPG o PNG."
                  : "Foto (opcional, se puede subir después)"}
              </span>
            </span>
          )}
          {(subiendoFoto || fotoSubida || errorFoto) && (
            <span
              className={`absolute bottom-1.5 left-1.5 rounded-full px-2 py-1 text-[10px] font-medium backdrop-blur-sm ${
                errorFoto ? "bg-error/80 text-white" : "bg-black/60 text-white"
              }`}
            >
              {subiendoFoto ? "Preparando foto..." : errorFoto ? "No se pudo subir" : "✓ Lista para guardar"}
            </span>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            // Ver comentario del mismo input en el modal de editar: sin
            // "capture" deja elegir entre cámara y galería.
            className="absolute inset-0 h-full w-full opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void elegirArchivo(f);
            }}
          />
        </label>
        {errorFoto && (
          <button type="button" onClick={reintentar} className="text-caption font-medium text-vip">
            Reintentar subir la foto
          </button>
        )}

        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          <div className="h-px flex-1 bg-border" /> o pegá el link de una imagen{" "}
          <div className="h-px flex-1 bg-border" />
        </div>
        <Input type="url" name="foto_url" placeholder="https://…" className="!py-2 text-caption" />

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">
            Nombre — separá variantes con &quot;/&quot; si se lo dicen distinto
          </span>
          <input
            name="nombre"
            type="text"
            required
            defaultValue={nombreInicial}
            placeholder="Ej: Press de pecho / Bench press / Press banca"
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          />
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Grupo muscular</span>
          <select
            name="grupo_muscular"
            required
            value={grupoNuevo}
            onChange={(evento) => setGrupoNuevo(evento.target.value)}
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              Elegir...
            </option>
            {GRUPOS.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">
            Tipo de movimiento — evita ejercicios repetidos o grupos incompletos
          </span>
          <select
            name="patron_movimiento"
            required
            disabled={!grupoNuevo}
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              {grupoNuevo ? "Elegir…" : "Primero elige el grupo muscular"}
            </option>
            {patronesVisibles.map((grupo) => (
              <optgroup key={grupo.etiqueta} label={grupo.etiqueta}>
                {grupo.opciones.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="text-micro mt-1 block text-text-tertiary">
            Este dato llega directamente a Armar rutina y alimenta el Semáforo VIP.
          </span>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Categoría</span>
          <select
            name="categoria"
            required
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              Elegir...
            </option>
            {CATEGORIAS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Equipo</span>
          <select
            name="equipo"
            required
            defaultValue=""
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          >
            <option value="" disabled>
              Elegir...
            </option>
            {EQUIPOS.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </label>

        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Ejercicio creado.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || subiendoFoto || (!!archivoElegido && !fotoSubida)}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Creando..." : subiendoFoto ? "Esperando la foto..." : "Crear ejercicio"}
        </button>
      </form>
    </Overlay>
  );
}
