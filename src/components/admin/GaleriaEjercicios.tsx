"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, Camera, Plus, X, Check, ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import { subirFotoEjercicio, crearEjercicioNuevo } from "@/app/admin/ejercicios/actions";
import type { Ejercicio } from "@/lib/ejercicios/tipos";

const ETIQUETAS_GRUPO: Record<string, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  piernas: "Piernas",
  hombros: "Hombros",
  brazos: "Brazos",
  core: "Core",
  cardio: "Cardio",
};

/** La miniatura a mostrar: la foto subida desde acá si existe, si no la
 * ilustración estática de siempre (public/ejercicios/<slug>). Mismo criterio
 * que usa la app del alumno (ver SesionEjercicioCard). */
function fotoDe(ej: Ejercicio): string | null {
  if (ej.fotoMiniaturaUrl) return ej.fotoMiniaturaUrl;
  const { src, origen } = resolverIlustracion(ej.ilustracionSlug, null);
  return origen === "ilustracion" ? src : null;
}

export function GaleriaEjercicios({ ejercicios }: { ejercicios: Ejercicio[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<Ejercicio | null>(null);
  const [creando, setCreando] = useState(false);
  // Justo después de subir una foto nueva, a veces el CDN de Storage todavía
  // no terminó de propagarla y la primera carga falla (el archivo ya está
  // subido de verdad, es solo una demora de segundos) — sin esto se veía el
  // ícono de "imagen rota" del navegador, que asusta más de lo que informa.
  // Cae al mismo placeholder neutro que un ejercicio sin foto todavía.
  const [erroresFoto, setErroresFoto] = useState<ReadonlySet<string>>(new Set());

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ejercicios;
    return ejercicios.filter((e) => e.nombre.toLowerCase().includes(q));
  }, [ejercicios, busqueda]);

  const sinFoto = ejercicios.filter((e) => !fotoDe(e)).length;

  return (
    <div className="space-y-3">
      {sinFoto > 0 && (
        <Card padding="p-2.5" className="flex items-center gap-2">
          <ImageIcon size={16} className="shrink-0 text-text-tertiary" />
          <p className="text-caption text-text-secondary">
            {sinFoto} ejercicio{sinFoto === 1 ? "" : "s"} todavía sin foto propia.
          </p>
        </Card>
      )}

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
        onClick={() => setCreando(true)}
        className="radius-control flex w-full items-center justify-center gap-2 border border-dashed border-vip/50 py-3 text-secondary font-semibold text-vip"
      >
        <Plus size={16} /> Ejercicio nuevo, con foto
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        {filtrados.map((ej) => {
          const foto = erroresFoto.has(ej.id) ? null : fotoDe(ej);
          return (
            <button
              key={ej.id}
              type="button"
              onClick={() => setEditando(ej)}
              className="group text-left"
            >
              <Card padding="p-0" className="overflow-hidden">
                <div className="relative aspect-square w-full bg-surface-2">
                  {foto ? (
                    <Image
                      src={foto}
                      alt={ej.nombre}
                      fill
                      sizes="200px"
                      className="object-cover"
                      onError={() => setErroresFoto((prev) => new Set(prev).add(ej.id))}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                      <ImageIcon size={26} />
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                    <Camera size={13} />
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-caption line-clamp-2 font-semibold leading-tight text-text">
                    {ej.nombre}
                  </p>
                  <p className="text-[10px] mt-0.5 text-text-tertiary">
                    {ETIQUETAS_GRUPO[ej.grupoMuscular] ?? ej.grupoMuscular}
                  </p>
                </div>
              </Card>
            </button>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <Card>
          <p className="text-body text-text-secondary">Ningún ejercicio coincide con la búsqueda.</p>
        </Card>
      )}

      {editando && (
        <ModalSubirFoto ejercicio={editando} fotoActual={fotoDe(editando)} onCerrar={() => setEditando(null)} />
      )}
      {creando && <ModalEjercicioNuevo onCerrar={() => setCreando(false)} />}
    </div>
  );
}

function Overlay({ children, onCerrar }: { children: React.ReactNode; onCerrar: () => void }) {
  return (
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
    </div>
  );
}

const ESTADO_INICIAL_FOTO = { error: null, ok: false };

function ModalSubirFoto({
  ejercicio,
  fotoActual,
  onCerrar,
}: {
  ejercicio: Ejercicio;
  fotoActual: string | null;
  onCerrar: () => void;
}) {
  const [state, formAction, pending] = useActionState(subirFotoEjercicio, ESTADO_INICIAL_FOTO);
  const [previa, setPrevia] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        <p className="text-card-title text-text">{ejercicio.nombre}</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-text-tertiary">
          <X size={20} />
        </button>
      </div>

      {/* aspect-square y no aspect-video: tiene que coincidir con el recorte
          que hace el servidor (500x500, ver subirFotoEjercicio en actions.ts)
          y con la tarjetita de la galería (también aspect-square) — si no,
          lo que encuadrás acá no es lo que termina guardado. */}
      <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
        {previa || fotoActual ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa ?? fotoActual ?? ""} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-tertiary">
            <Camera size={26} />
            <span className="text-caption">Tocá para elegir una foto</span>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          name="foto"
          accept="image/*"
          // Sin "capture": con ese atributo, varios navegadores de celular
          // abren la cámara directo y nunca ofrecen elegir de la galería —
          // sacándolo, el selector nativo siempre deja elegir entre sacar
          // una foto nueva o subir una que ya existe.
          className="absolute inset-0 h-full w-full opacity-0"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPrevia(URL.createObjectURL(f));
          }}
        />
      </label>

      <form
        action={(fd) => {
          const f = inputRef.current?.files?.[0];
          if (f) fd.set("foto", f);
          fd.set("ejercicio_id", ejercicio.id);
          formAction(fd);
        }}
        className="mt-3 space-y-2"
      >
        {state.error && <p className="text-caption text-error">{state.error}</p>}
        {state.ok && (
          <p className="text-caption flex items-center gap-1 text-success">
            <Check size={14} /> Foto actualizada — ya la ven los alumnos.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Subiendo..." : "Guardar foto"}
        </button>
      </form>
    </Overlay>
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

function ModalEjercicioNuevo({ onCerrar }: { onCerrar: () => void }) {
  const [state, formAction, pending] = useActionState(crearEjercicioNuevo, ESTADO_INICIAL_CREAR);
  const [previa, setPrevia] = useState<string | null>(null);

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

      <form action={formAction} className="space-y-3">
        {/* aspect-square y no aspect-video: tiene que coincidir con el recorte
          que hace el servidor (500x500, ver subirFotoEjercicio en actions.ts)
          y con la tarjetita de la galería (también aspect-square) — si no,
          lo que encuadrás acá no es lo que termina guardado. */}
      <label className="radius-card relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden border border-dashed border-border bg-surface-2">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previa} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-text-tertiary">
              <Camera size={26} />
              <span className="text-caption">Foto (opcional, se puede subir después)</span>
            </span>
          )}
          <input
            type="file"
            name="foto"
            accept="image/*"
            // Ver comentario del mismo input en el modal de editar: sin
            // "capture" deja elegir entre cámara y galería.
            className="absolute inset-0 h-full w-full opacity-0"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPrevia(URL.createObjectURL(f));
            }}
          />
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Nombre</span>
          <input
            name="nombre"
            type="text"
            required
            placeholder="Ej: Press en máquina Hammer"
            className="radius-control w-full border border-border bg-surface-2 px-3 py-2.5 text-secondary text-text"
          />
        </label>

        <label className="block">
          <span className="text-caption mb-1 block text-text-tertiary">Grupo muscular</span>
          <select
            name="grupo_muscular"
            required
            defaultValue=""
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
          disabled={pending}
          className="btn-accion radius-control flex h-11 w-full items-center justify-center gap-2 text-secondary font-semibold disabled:opacity-60"
        >
          {pending ? "Creando..." : "Crear ejercicio"}
        </button>
      </form>
    </Overlay>
  );
}
