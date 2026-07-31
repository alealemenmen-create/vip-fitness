"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Plus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  buscarAlimentosAction,
  crearAlimentoPersonalizado,
} from "@/app/alumno/comer/actions";
import type { AlimentoCatalogo } from "@/app/alumno/comer/tipos";

export type AlimentoElegido = {
  alimento: AlimentoCatalogo;
  /** Ya convertido a la unidad base del alimento. */
  cantidadBase: number;
};

function etiquetaHora(hora: number): string {
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:00 ${hora < 12 ? "AM" : "PM"}`;
}

/**
 * Panel inferior para cargar la comida de una hora.
 *
 * Va en un portal sobre <body> a propósito: cualquier ancestro con `transform`
 * convierte a `position: fixed` en relativo y el panel aparecería recortado
 * dentro de la tarjeta en vez de cubrir la pantalla.
 */
export function HojaAgregarComida({
  hora,
  onCerrar,
  onConfirmar,
}: {
  hora: number | null;
  onCerrar: () => void;
  onConfirmar: (elegidos: AlimentoElegido[]) => void;
}) {
  // Sin estado de "montado": el panel solo existe cuando el alumno tocó una
  // hora, así que en el render del servidor `hora` siempre es null y nunca se
  // llega a tocar `document`.
  if (hora === null || typeof document === "undefined") return null;

  return createPortal(
    <Contenido hora={hora} onCerrar={onCerrar} onConfirmar={onConfirmar} />,
    document.body
  );
}

function Contenido({
  hora,
  onCerrar,
  onConfirmar,
}: {
  hora: number;
  onCerrar: () => void;
  onConfirmar: (elegidos: AlimentoElegido[]) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<AlimentoCatalogo[]>([]);
  const [buscandoAhora, setBuscandoAhora] = useState(false);
  const [seleccionado, setSeleccionado] = useState<AlimentoCatalogo | null>(null);
  const [cantidad, setCantidad] = useState("100");
  /** true cuando el alumno mide en cucharadas/unidades en vez de gramos. */
  const [usarMedida, setUsarMedida] = useState(false);
  const [elegidos, setElegidos] = useState<AlimentoElegido[]>([]);
  const [creando, setCreando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // Escape cierra, y el fondo no debe scrollear detrás del panel abierto.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  // El catálogo tiene miles de alimentos: se consulta al servidor a medida que
  // el alumno escribe, con una pausa para no disparar una consulta por tecla.
  useEffect(() => {
    const q = busqueda.trim();
    // Con menos de 2 letras no se consulta; la lista ya la vació el onChange.
    if (q.length < 2) return;

    let vigente = true;
    const id = setTimeout(async () => {
      const encontrados = await buscarAlimentosAction(q);
      if (!vigente) return;
      setResultados(encontrados);
      setBuscandoAhora(false);
    }, 250);

    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [busqueda]);

  /** Deja el alimento listo para ingresar la cantidad. Si trae medida propia
   * (1 cucharada, 1 unidad), se arranca en ella en vez de en 100 g. */
  const elegirAlimento = (alimento: AlimentoCatalogo) => {
    setSeleccionado(alimento);
    const conMedida = Boolean(alimento.medidaNombre && alimento.medidaGramos);
    setUsarMedida(conMedida);
    setCantidad(conMedida ? "1" : String(alimento.porcionBase));
  };

  /**
   * El alimento que está en pantalla con su cantidad, listo para entrar en la
   * comida. `null` si no hay ninguno elegido o la cantidad no sirve.
   *
   * Siempre en la unidad base del alimento: la medida casera (cucharadas,
   * unidades) es solo la forma de ingresarlo.
   */
  const pendiente: AlimentoElegido | null = (() => {
    if (!seleccionado) return null;
    const cantidadBase =
      usarMedida && seleccionado.medidaGramos
        ? Number(cantidad) * seleccionado.medidaGramos
        : Number(cantidad);
    if (!Number.isFinite(cantidadBase) || cantidadBase <= 0) return null;
    return { alimento: seleccionado, cantidadBase };
  })();

  /** Lo que se guardaría si se confirmara ahora: la lista más lo que esté a
   * medio cargar. Así un alimento suelto no obliga a pasar por "Sumar a la
   * comida" antes de confirmar. */
  const aGuardar = pendiente ? [...elegidos, pendiente] : elegidos;

  const sumarALista = () => {
    if (!pendiente) return;
    setElegidos((prev) => [...prev, pendiente]);
    setSeleccionado(null);
    setBusqueda("");
    setResultados([]);
    campo.current?.focus();
  };

  if (creando) {
    return (
      <Marco onCerrar={onCerrar} titulo={`Alimento nuevo · ${etiquetaHora(hora)}`}>
        <FormularioAlimento
          onCancelar={() => setCreando(false)}
          onCreado={(alimento) => {
            setCreando(false);
            elegirAlimento(alimento);
          }}
        />
      </Marco>
    );
  }

  return (
    <Marco onCerrar={onCerrar} titulo={`Agregar a las ${etiquetaHora(hora)}`}>
      {!seleccionado && (
        <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-3 py-2.5">
          <Search size={16} className="shrink-0 text-text-secondary" />
          <input
            ref={campo}
            autoFocus
            value={busqueda}
            onChange={(e) => {
              const valor = e.target.value;
              // Un onChange con el mismo texto no es una edición real: es
              // ruido del teclado del celular y no debe borrar nada.
              if (valor === busqueda) return;
              setBusqueda(valor);
              const corta = valor.trim().length < 2;
              setBuscandoAhora(!corta);
              if (corta) setResultados([]);
            }}
            placeholder="Buscar alimentos"
            className="min-w-0 flex-1 bg-transparent text-secondary text-text outline-none"
          />
          {busqueda && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setBusqueda("");
                setResultados([]);
                setBuscandoAhora(false);
              }}
              className="shrink-0 text-text-tertiary"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {!seleccionado && buscandoAhora && (
        <p className="text-caption px-1 py-2 text-text-tertiary">Buscando…</p>
      )}

      {!seleccionado && !buscandoAhora && busqueda.trim().length >= 2 && resultados.length === 0 && (
        <p className="text-caption px-1 py-2 text-text-tertiary">
          Sin resultados para &quot;{busqueda.trim()}&quot;.
        </p>
      )}

      {!seleccionado && resultados.length > 0 && (
        <div className="space-y-1">
          {resultados.map((r) => (
            <button
              key={r.id}
              type="button"
              /**
               * Va en onPointerDown y no solo en onClick: en el celular el
               * campo tiene el foco con el teclado abierto, y el primer toque
               * solo lo cerraba — el clic se perdía y el alimento no se
               * seleccionaba nunca. preventDefault evita ese blur.
               */
              onPointerDown={(e) => {
                e.preventDefault();
                elegirAlimento(r);
              }}
              onClick={() => elegirAlimento(r)}
              className="radius-control flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2"
            >
              <span className="text-secondary min-w-0 flex-1 truncate text-text">{r.nombre}</span>
              <span className="text-caption shrink-0 text-text-tertiary">
                {Math.round(r.kcal)} kcal · {r.porcionBase} {r.unidad}
              </span>
            </button>
          ))}
        </div>
      )}

      {seleccionado && (
        <div className="radius-control space-y-3 border border-border p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Elegir otro alimento"
              onClick={() => setSeleccionado(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>
            <p className="text-secondary min-w-0 flex-1 truncate font-medium text-text">
              {seleccionado.nombre}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-24 py-2"
            />
            <span className="text-secondary text-text-tertiary">
              {usarMedida && seleccionado.medidaNombre
                ? seleccionado.medidaNombre
                : seleccionado.unidad}
            </span>
          </div>

          {/* Los alimentos que no se pesan (aceite, huevo, leche) traen su
              medida real: se registra en cucharadas o unidades y la app
              convierte a la unidad base. */}
          {seleccionado.medidaNombre && seleccionado.medidaGramos && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const nueva = !usarMedida;
                  setUsarMedida(nueva);
                  setCantidad(nueva ? "1" : String(seleccionado.porcionBase));
                }}
                className="text-caption text-vip underline"
              >
                {usarMedida
                  ? `Medir en ${seleccionado.unidad}`
                  : `Medir en ${seleccionado.medidaNombre}`}
              </button>
              {usarMedida && (
                <span className="text-caption text-text-tertiary">
                  = {Math.round(Number(cantidad || 0) * seleccionado.medidaGramos)}{" "}
                  {seleccionado.unidad}
                </span>
              )}
            </div>
          )}

          {/* Atajo para cargar VARIOS alimentos en la misma comida: suma este y
              deja el buscador listo para el siguiente. Para uno solo no hace
              falta pasar por acá — Confirmar ya lo toma. */}
          <Button variant="secondary" size="sm" className="w-full" onClick={sumarALista}>
            <Plus size={15} /> Sumar y buscar otro
          </Button>
        </div>
      )}

      {elegidos.length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          {elegidos.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <p className="text-secondary min-w-0 flex-1 truncate text-text">
                {e.alimento.nombre}
                <span className="text-text-tertiary">
                  {" "}
                  · {Math.round(e.cantidadBase)} {e.alimento.unidad}
                </span>
              </p>
              <button
                type="button"
                aria-label={`Quitar ${e.alimento.nombre}`}
                onClick={() => setElegidos((prev) => prev.filter((_, j) => j !== i))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-error active:scale-95"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="text-caption font-medium text-vip underline"
        >
          Crear alimento personalizado
        </button>
        <Button
          size="sm"
          className="w-auto px-5"
          disabled={aGuardar.length === 0}
          onClick={() => onConfirmar(aGuardar)}
        >
          Confirmar
        </Button>
      </div>
    </Marco>
  );
}

/** Fondo, panel y animación de entrada, comunes a las dos vistas del panel. */
/**
 * Alto y posición de lo que se ve DE VERDAD en pantalla.
 *
 * `position: fixed` se ancla al viewport de layout, que en el celular NO se
 * achica cuando sube el teclado. Por eso el panel quedaba abajo del teclado:
 * seguía pegado al borde inferior de una pantalla que ya no estaba a la vista,
 * y había que arrastrarlo para sacarlo de atrás.
 *
 * `visualViewport` sí refleja el área visible. Con su alto y su desplazamiento,
 * el panel se apoya sobre el teclado en vez de quedar detrás.
 */
function useAreaVisible() {
  const [area, setArea] = useState<{ alto: number; desde: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    // Navegador sin la API (o server): se cae al comportamiento de antes.
    if (!vv) return;

    const medir = () => setArea({ alto: vv.height, desde: vv.offsetTop });
    medir();
    vv.addEventListener("resize", medir);
    // `scroll` también: en iOS el área visible se corre hacia arriba cuando el
    // teclado empuja la página, y solo cambia el offset, no el alto.
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);

  return area;
}

function Marco({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  const area = useAreaVisible();

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col justify-end"
      style={area ? { top: area.desde, height: area.alto } : { top: 0, bottom: 0 }}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/60 animate-[aparecer-hoja_200ms_ease-out]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        // `max-h-[85%]` y no `85vh`: el porcentaje es del área visible que ya
        // calculó el contenedor. Con `vh` el panel podía medir más que la
        // pantalla disponible y volvía a esconderse bajo el teclado.
        className="franja-segura-inferior relative mx-auto max-h-[85%] w-full max-w-md overflow-y-auto rounded-t-[24px] border-t border-border bg-surface p-4 animate-[subir-hoja_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-card-title min-w-0 truncate text-text">{titulo}</p>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary active:scale-95"
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

/** Alta de un alimento que no está en el catálogo del gimnasio. */
function FormularioAlimento({
  onCancelar,
  onCreado,
}: {
  onCancelar: () => void;
  onCreado: (alimento: AlimentoCatalogo) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [porcion, setPorcion] = useState("100");
  const [unidad, setUnidad] = useState("g");
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [carb, setCarb] = useState("");
  const [grasa, setGrasa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    const res = await crearAlimentoPersonalizado({
      nombre,
      porcionBase: Number(porcion),
      unidad,
      kcal: Number(kcal || 0),
      prot: Number(prot || 0),
      carb: Number(carb || 0),
      grasa: Number(grasa || 0),
    });
    setGuardando(false);
    if (res.error || !res.alimento) {
      setError(res.error ?? "No fue posible crear el alimento.");
      return;
    }
    onCreado(res.alimento);
  };

  const campos: [string, string, (v: string) => void, string][] = [
    ["CALORÍAS", kcal, setKcal, "kcal"],
    ["PROTEÍNAS", prot, setProt, "g"],
    ["CARBOHIDRATOS", carb, setCarb, "g"],
    ["GRASAS", grasa, setGrasa, "g"],
  ];

  return (
    <>
      <div>
        <label className="text-caption mb-1.5 block text-text-tertiary">NOMBRE</label>
        <Input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Pan amasado de la feria"
          className="py-2"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-caption mb-1.5 block text-text-tertiary">PORCIÓN</label>
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={porcion}
            onChange={(e) => setPorcion(e.target.value)}
            className="py-2"
          />
        </div>
        <div className="w-24">
          <label className="text-caption mb-1.5 block text-text-tertiary">UNIDAD</label>
          <Input value={unidad} onChange={(e) => setUnidad(e.target.value)} className="py-2" />
        </div>
      </div>

      <p className="text-caption text-text-tertiary">
        Los valores son por esa porción, tal como vienen en la etiqueta.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {campos.map(([etiqueta, valor, set, sufijo]) => (
          <div key={etiqueta}>
            <label className="text-caption mb-1.5 block text-text-tertiary">
              {etiqueta} ({sufijo})
            </label>
            <Input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={valor}
              onChange={(e) => set(e.target.value)}
              placeholder="0"
              className="py-2"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-caption text-error">{error}</p>}

      <p className="text-caption text-text-tertiary">
        Lo puedes usar de inmediato. Aparece para el resto del gimnasio solo si tu entrenador lo
        acepta.
      </p>

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" loading={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Crear y usar"}
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </>
  );
}
