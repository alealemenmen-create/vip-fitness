"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  ExternalLink,
  History,
  ImagePlus,
  Layers,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Send,
  Users,
} from "lucide-react";
import {
  guardarBorradorEstudioVipV2,
  publicarEstudioVipV2,
  subirPortadaEstudioVipV2,
  restaurarVersionEstudioVip,
  type VersionHistorialEstudioVip,
} from "@/app/control-vip/estudio-vip/actions";
import { BottomNavV2 } from "@/components/v2/BottomNavV2";
import {
  TARJETAS_ENTRENAMIENTO,
  type ConfiguracionEstudioVip,
  type DocumentoEstudioVip,
  type TarjetaEntrenamientoId,
} from "@/lib/estudio-vip/configuracion";

const NOMBRES_TARJETA: Record<TarjetaEntrenamientoId, string> = {
  rutina: "Rutina asignada",
  biblioteca: "Biblioteca de ejercicios",
  programas: "Mis programas",
  historial: "Historial",
  impulso: "Impulso VIP",
  preparacion: "Preparación de hoy",
};

type Seccion = "marca" | "portada" | "navegacion" | "tarjetas" | "alumnos" | "historial";

const SECCIONES: { id: Seccion; etiqueta: string; Icon: typeof Palette }[] = [
  { id: "marca", etiqueta: "Marca y tema", Icon: Palette },
  { id: "portada", etiqueta: "Portada y aviso", Icon: ImagePlus },
  { id: "navegacion", etiqueta: "Navegación inferior", Icon: Layers },
  { id: "tarjetas", etiqueta: "Tarjetas de Entrenamiento", Icon: Layers },
  { id: "alumnos", etiqueta: "Alumnos", Icon: Users },
  { id: "historial", etiqueta: "Historial de versiones", Icon: History },
];

function Campo({ etiqueta, valor, onChange, ayuda, maxLength = 160 }: {
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  ayuda?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-text-secondary">
      {etiqueta}
      <input
        value={valor}
        maxLength={maxLength}
        onChange={(evento) => onChange(evento.target.value)}
        className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-normal text-text outline-none transition focus:border-vip/70"
      />
      {ayuda ? <span className="text-[10px] font-normal leading-relaxed text-text-muted">{ayuda}</span> : null}
    </label>
  );
}

function formatearFechaHistorial(iso: string): string {
  if (!iso) return "Fecha desconocida";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(iso));
}

/**
 * Vista previa central de Control VIP V2 (Fase 5): la navegación inferior es
 * el componente REAL de Portal V2 (`BottomNavV2`), no una maqueta — cambia
 * en vivo con el borrador. La portada y las tarjetas siguen siendo una
 * representación (igual que antes): renderizar `EntrenamientoInicioV2` con
 * datos reales de un alumno en vivo, mientras se edita cada tecla, queda
 * para una fase futura.
 */
function VistaPreviaCentral({ configuracion }: { configuracion: ConfiguracionEstudioVip }) {
  const estilo = {
    "--v2-accent": configuracion.tema.colorAcento,
    "--v2-bg": configuracion.tema.colorFondo,
  } as React.CSSProperties;

  return (
    <div
      className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[34px] border-[5px] border-[#252a28] shadow-2xl"
      style={{ ...estilo, background: configuracion.tema.colorFondo }}
    >
      <div className="mx-auto mt-2 h-1.5 w-20 rounded-full bg-[#303431]" />
      <div className="p-4 pb-2 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: configuracion.tema.colorAcento }}>
              Vista previa
            </p>
            <h3 className="text-xl font-black">{configuracion.marca.nombre}</h3>
            <p className="max-w-[250px] text-[9px] leading-relaxed text-[#8f9691]">{configuracion.marca.subtitulo}</p>
          </div>
        </div>
        {configuracion.entrenamiento.aviso.visible && (configuracion.entrenamiento.aviso.titulo || configuracion.entrenamiento.aviso.texto) ? (
          <div
            className="mb-3 rounded-xl border p-3"
            style={{ borderColor: `${configuracion.tema.colorAcento}55`, background: `${configuracion.tema.colorAcento}10` }}
          >
            <strong className="text-xs">{configuracion.entrenamiento.aviso.titulo || "Aviso"}</strong>
            <p className="mt-1 text-[9px] leading-relaxed text-[#aeb4b0]">{configuracion.entrenamiento.aviso.texto}</p>
          </div>
        ) : null}
        <div className="relative mb-3 min-h-52 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#252a27] to-[#111412]">
          {configuracion.entrenamiento.imagenPortadaUrl ? (
            <Image src={configuracion.entrenamiento.imagenPortadaUrl} alt="Portada configurada" fill sizes="390px" className="object-cover opacity-65" />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-4 pt-16">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: configuracion.tema.colorAcento }}>
              {configuracion.entrenamiento.etiquetaFase}
            </span>
            <h4 className="mt-1 text-lg font-black">Programa del alumno</h4>
            <p className="text-[9px] text-[#b6bbb7]">Aquí se mantienen sus días, ejercicios y cifras reales.</p>
            <button type="button" className="mt-3 rounded-lg px-4 py-2 text-[10px] font-black text-black" style={{ background: configuracion.tema.colorAcento }}>
              {configuracion.entrenamiento.textoBotonIniciar}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pb-3">
          {TARJETAS_ENTRENAMIENTO.filter((id) => !["impulso", "preparacion"].includes(id) && configuracion.tarjetas[id].visible).map((id) => (
            <div key={id} className="rounded-xl border border-white/10 bg-white/[.035] p-3">
              <strong className="block text-[10px]">{configuracion.tarjetas[id].titulo}</strong>
              <span className="mt-1 block text-[8px] leading-relaxed text-[#8f9691]">{configuracion.tarjetas[id].detalle}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Componente real de Portal V2 — no una maqueta. */}
      <BottomNavV2 navegacion={configuracion.navegacion} />
    </div>
  );
}

export function EstudioVipEditorV2({ borradorInicial, publicadoInicial, totalAlumnos, alumnosV2, historial }: {
  borradorInicial: DocumentoEstudioVip;
  publicadoInicial: DocumentoEstudioVip;
  totalAlumnos: number;
  alumnosV2: number;
  historial: VersionHistorialEstudioVip[];
}) {
  const [seccion, setSeccion] = useState<Seccion>("marca");
  const [configuracion, setConfiguracion] = useState(borradorInicial.configuracion);
  const [versionPublicada, setVersionPublicada] = useState(publicadoInicial.version);
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  const archivoRef = useRef<HTMLInputElement>(null);

  const actualizar = <K extends keyof ConfiguracionEstudioVip>(clave: K, valor: ConfiguracionEstudioVip[K]) =>
    setConfiguracion((actual) => ({ ...actual, [clave]: valor }));
  const actualizarEntrenamiento = (parcial: Partial<ConfiguracionEstudioVip["entrenamiento"]>) =>
    setConfiguracion((actual) => ({ ...actual, entrenamiento: { ...actual.entrenamiento, ...parcial } }));
  const actualizarTarjeta = (id: TarjetaEntrenamientoId, parcial: Partial<ConfiguracionEstudioVip["tarjetas"][TarjetaEntrenamientoId]>) =>
    setConfiguracion((actual) => ({ ...actual, tarjetas: { ...actual.tarjetas, [id]: { ...actual.tarjetas[id], ...parcial } } }));

  const moverNavegacion = (indice: number, direccion: -1 | 1) => {
    const destino = indice + direccion;
    if (destino < 0 || destino >= configuracion.navegacion.length) return;
    const siguiente = [...configuracion.navegacion];
    [siguiente[indice], siguiente[destino]] = [siguiente[destino], siguiente[indice]];
    actualizar("navegacion", siguiente);
  };

  const ejecutar = (tipo: "guardar" | "publicar") =>
    iniciarTransicion(async () => {
      setEstado(null);
      const resultado = tipo === "guardar" ? await guardarBorradorEstudioVipV2(configuracion) : await publicarEstudioVipV2(configuracion);
      setEstado({ tipo: resultado.ok ? "ok" : "error", texto: resultado.mensaje });
      if (resultado.documento) {
        setConfiguracion(resultado.documento.configuracion);
        if (tipo === "publicar") setVersionPublicada(resultado.documento.version);
      }
    });

  const restaurar = (version: VersionHistorialEstudioVip) => {
    if (!window.confirm(`¿Publicar de nuevo la versión ${version.version}? Queda como una versión nueva; nada del historial se borra.`)) return;
    iniciarTransicion(async () => {
      setEstado(null);
      const resultado = await restaurarVersionEstudioVip(version.ruta);
      setEstado({ tipo: resultado.ok ? "ok" : "error", texto: resultado.mensaje });
      if (resultado.documento) {
        setConfiguracion(resultado.documento.configuracion);
        setVersionPublicada(resultado.documento.version);
      }
    });
  };

  const subirPortada = (archivo: File | undefined) => {
    if (!archivo) return;
    iniciarTransicion(async () => {
      setEstado(null);
      const datos = new FormData();
      datos.set("archivo", archivo);
      const resultado = await subirPortadaEstudioVipV2(datos);
      if (resultado.ok && resultado.url) actualizarEntrenamiento({ imagenPortadaUrl: resultado.url });
      setEstado({ tipo: resultado.ok ? "ok" : "error", texto: resultado.mensaje });
      if (archivoRef.current) archivoRef.current.value = "";
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_420px]">
      {/* Panel izquierdo: árbol de secciones */}
      <nav aria-label="Secciones de Estudio VIP" className="flex gap-2 overflow-x-auto pb-1 xl:sticky xl:top-24 xl:flex-col xl:self-start xl:overflow-visible xl:pb-0">
        {SECCIONES.map(({ id, etiqueta, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSeccion(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-colors xl:shrink ${
              seccion === id ? "border-vip/40 bg-vip/10 text-vip" : "border-border text-text-secondary hover:bg-surface-2"
            }`}
          >
            <Icon size={15} /> <span className="whitespace-nowrap">{etiqueta}</span>
          </button>
        ))}
      </nav>

      {/* Centro: vista previa real */}
      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-vip">Vista previa</p>
            <p className="text-xs text-text-secondary">La navegación de abajo es el componente real de Portal V2</p>
          </div>
          <Link href="/portal-v2/entrenamiento" target="_blank" className="boton-panel-secundario">
            <ExternalLink size={14} /> Abrir real
          </Link>
        </div>
        <VistaPreviaCentral configuracion={configuracion} />
        <p className="mx-auto mt-3 max-w-[390px] text-center text-[10px] leading-relaxed text-text-muted">
          Portada y tarjetas son representativas; la navegación de abajo es real. La página real conserva los datos
          de la cuenta o del alumno seleccionado en &ldquo;Ver como alumno&rdquo;.
        </p>
      </div>

      {/* Derecha: propiedades de la sección elegida */}
      <div className="space-y-4">
        <div className="admin-panel-card rounded-3xl p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
            <p className="text-xs font-semibold text-text-secondary">Publicada v{versionPublicada}</p>
          </div>

          {seccion === "marca" && (
            <div className="grid gap-4">
              <Campo etiqueta="Nombre de la experiencia" valor={configuracion.marca.nombre} onChange={(nombre) => actualizar("marca", { ...configuracion.marca, nombre })} maxLength={50} />
              <Campo etiqueta="Subtítulo" valor={configuracion.marca.subtitulo} onChange={(subtitulo) => actualizar("marca", { ...configuracion.marca, subtitulo })} />
              <label className="grid gap-1.5 text-xs font-semibold text-text-secondary">
                Color principal
                <input type="color" value={configuracion.tema.colorAcento} onChange={(e) => actualizar("tema", { ...configuracion.tema, colorAcento: e.target.value })} className="h-11 w-full rounded-xl border border-border bg-background p-1" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-text-secondary">
                Fondo de Portal V2
                <input type="color" value={configuracion.tema.colorFondo} onChange={(e) => actualizar("tema", { ...configuracion.tema, colorFondo: e.target.value })} className="h-11 w-full rounded-xl border border-border bg-background p-1" />
              </label>
            </div>
          )}

          {seccion === "portada" && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <Campo etiqueta="Etiqueta bajo el programa" valor={configuracion.entrenamiento.etiquetaFase} onChange={(etiquetaFase) => actualizarEntrenamiento({ etiquetaFase })} maxLength={50} />
                <Campo etiqueta="Texto del botón principal" valor={configuracion.entrenamiento.textoBotonIniciar} onChange={(textoBotonIniciar) => actualizarEntrenamiento({ textoBotonIniciar })} maxLength={35} ayuda="El número del día se agrega automáticamente." />
              </div>
              <div className="rounded-2xl border border-dashed border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => archivoRef.current?.click()} disabled={pendiente} className="boton-panel-secundario">
                    <ImagePlus size={16} /> Subir portada global
                  </button>
                  <span className="text-[10px] text-text-muted">JPG, PNG, WebP o HEIC · se optimiza automáticamente</span>
                </div>
                <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={(e) => subirPortada(e.target.files?.[0])} />
                {configuracion.entrenamiento.imagenPortadaUrl ? (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <a href={configuracion.entrenamiento.imagenPortadaUrl} target="_blank" rel="noreferrer" className="truncate text-xs text-vip underline">Ver portada cargada</a>
                    <button type="button" className="text-xs font-bold text-error" onClick={() => actualizarEntrenamiento({ imagenPortadaUrl: "" })}>Quitar</button>
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border p-4">
                <label className="flex items-center gap-2 text-sm font-bold text-text">
                  <input type="checkbox" checked={configuracion.entrenamiento.aviso.visible} onChange={(e) => actualizarEntrenamiento({ aviso: { ...configuracion.entrenamiento.aviso, visible: e.target.checked } })} className="size-4 accent-vip" /> Mostrar aviso global
                </label>
                <div className="mt-3 grid gap-3">
                  <Campo etiqueta="Título del aviso" valor={configuracion.entrenamiento.aviso.titulo} onChange={(titulo) => actualizarEntrenamiento({ aviso: { ...configuracion.entrenamiento.aviso, titulo } })} maxLength={80} />
                  <Campo etiqueta="Texto" valor={configuracion.entrenamiento.aviso.texto} onChange={(texto) => actualizarEntrenamiento({ aviso: { ...configuracion.entrenamiento.aviso, texto } })} maxLength={240} />
                  <Campo etiqueta="Texto del botón (opcional)" valor={configuracion.entrenamiento.aviso.botonTexto} onChange={(botonTexto) => actualizarEntrenamiento({ aviso: { ...configuracion.entrenamiento.aviso, botonTexto } })} maxLength={35} />
                  <Campo etiqueta="Destino del botón" valor={configuracion.entrenamiento.aviso.botonHref} onChange={(botonHref) => actualizarEntrenamiento({ aviso: { ...configuracion.entrenamiento.aviso, botonHref } })} ayuda="Ruta interna como /portal-v2/mas o URL https." />
                </div>
              </div>
            </div>
          )}

          {seccion === "navegacion" && (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary">Entrenamiento permanece siempre visible para no dejar alumnos sin acceso a su rutina.</p>
              {configuracion.navegacion.map((item, indice) => (
                <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-border p-2">
                  <label className="grid size-9 place-items-center">
                    <input
                      type="checkbox"
                      aria-label={`Mostrar ${item.etiqueta} en la navegación`}
                      checked={item.visible}
                      disabled={item.id === "entrenamiento"}
                      onChange={(e) => actualizar("navegacion", configuracion.navegacion.map((actual) => (actual.id === item.id ? { ...actual, visible: e.target.checked } : actual)))}
                      className="size-4 accent-vip"
                    />
                  </label>
                  <input
                    value={item.etiqueta}
                    maxLength={18}
                    onChange={(e) => actualizar("navegacion", configuracion.navegacion.map((actual) => (actual.id === item.id ? { ...actual, etiqueta: e.target.value } : actual)))}
                    className="min-h-10 rounded-lg border border-border bg-background px-3 text-sm text-text"
                    aria-label={`Etiqueta de ${item.id}`}
                  />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moverNavegacion(indice, -1)} disabled={indice === 0} className="grid size-9 place-items-center rounded-lg border border-border text-text-secondary disabled:opacity-30" aria-label="Mover arriba"><ArrowUp size={15} /></button>
                    <button type="button" onClick={() => moverNavegacion(indice, 1)} disabled={indice === configuracion.navegacion.length - 1} className="grid size-9 place-items-center rounded-lg border border-border text-text-secondary disabled:opacity-30" aria-label="Mover abajo"><ArrowDown size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {seccion === "tarjetas" && (
            <div className="space-y-3">
              {TARJETAS_ENTRENAMIENTO.map((id) => (
                <div key={id} className="rounded-2xl border border-border p-3">
                  <label className="mb-3 flex items-center gap-2 text-sm font-bold text-text">
                    <input type="checkbox" checked={configuracion.tarjetas[id].visible} onChange={(e) => actualizarTarjeta(id, { visible: e.target.checked })} className="size-4 accent-vip" /> {NOMBRES_TARJETA[id]}
                  </label>
                  <div className="grid gap-3">
                    <Campo etiqueta="Título visible" valor={configuracion.tarjetas[id].titulo} onChange={(titulo) => actualizarTarjeta(id, { titulo })} maxLength={70} />
                    <Campo etiqueta="Descripción" valor={configuracion.tarjetas[id].detalle} onChange={(detalle) => actualizarTarjeta(id, { detalle })} maxLength={140} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {seccion === "alumnos" && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-text-secondary">
                Hay {totalAlumnos} perfiles reales y {alumnosV2} con Portal V2 habilitado. Rutina, plan, acceso, ficha,
                nutrición y vista como alumno se administran en cada ficha; Estudio VIP no duplica esos datos.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/control-vip/alumnos" className="boton-panel-secundario">Abrir alumnos <ExternalLink size={14} /></Link>
                <Link href="/control-vip/rutinas" className="boton-panel-secundario">Crear o asignar rutina <ExternalLink size={14} /></Link>
              </div>
            </div>
          )}

          {seccion === "historial" && (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary">
                Cada publicación deja una versión anterior guardada. Nada se borra: restaurar publica esa versión de
                nuevo, como una versión nueva.
              </p>
              {historial.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-text-tertiary">
                  Todavía no hay versiones anteriores — aparecen después de la segunda publicación.
                </p>
              ) : (
                historial.map((version) => (
                  <div key={version.ruta} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-caption font-semibold text-text">Versión {version.version}</p>
                      <p className="flex items-center gap-1 truncate text-micro text-text-tertiary">
                        <Clock size={11} /> {formatearFechaHistorial(version.fecha)}
                      </p>
                    </div>
                    <button type="button" onClick={() => restaurar(version)} disabled={pendiente} className="boton-panel-secundario shrink-0">
                      <RotateCcw size={13} /> Restaurar
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {estado ? (
          <div role="status" className={`rounded-2xl border p-3 text-sm ${estado.tipo === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-error/30 bg-error/10 text-error"}`}>
            {estado.tipo === "ok" ? <Check className="mr-2 inline" size={16} /> : null}
            {estado.texto}
          </div>
        ) : null}
        <div className="sticky bottom-20 z-20 flex flex-wrap gap-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur md:bottom-4">
          <button type="button" onClick={() => ejecutar("guardar")} disabled={pendiente} className="boton-panel-secundario min-w-0 flex-1">
            {pendiente ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Guardar borrador
          </button>
          <button type="button" onClick={() => ejecutar("publicar")} disabled={pendiente} className="boton-panel-primario min-w-0 flex-1">
            {pendiente ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Publicar en Portal V2
          </button>
        </div>
      </div>
    </div>
  );
}
