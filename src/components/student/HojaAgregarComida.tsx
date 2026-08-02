"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, Plus, ChevronLeft, Camera, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  buscarAlimentosAction,
  crearAlimentoPersonalizado,
  importarAlimentoOFF,
  buscarEnOFFAction,
} from "@/app/alumno/comer/actions";
import { LIMITE_BUSQUEDA_ALIMENTOS, type AlimentoCatalogo } from "@/app/alumno/comer/tipos";
import type { ProductoOFF } from "@/lib/alimentos/openFoodFacts";
import { normalizar } from "@/lib/alimentos/emparejar";
import { EscanerCodigoBarras } from "./EscanerCodigoBarras";

/** Un producto de OFF que ya aparece en el catálogo local (mismo nombre, o
 * uno contiene al otro) no aporta nada nuevo: se prefiere el propio. */
function esDuplicadoDeLocal(producto: ProductoOFF, locales: AlimentoCatalogo[]): boolean {
  const objetivo = normalizar(producto.nombre);
  const conMarca = producto.marca ? normalizar(`${producto.marca} ${producto.nombre}`) : objetivo;
  return locales.some((l) => {
    const n = normalizar(l.nombre);
    return n === objetivo || n === conMarca || n.includes(objetivo) || objetivo.includes(n);
  });
}

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
/** Cuánto vive el escudo. Android emite el click fantasma dentro de los ~300 ms
 * del toque; 350 da margen sin que se note la espera. */
const MS_ESCUDO = 350;

/**
 * Traga el click que Android emite DESPUÉS de que el panel ya se cerró.
 *
 * Los botones del panel actúan en `pointerdown` (ver el comentario de
 * "Confirmar"), así que para cuando el dedo se levanta el panel ya no está.
 * El click sintético cae entonces sobre lo que haya quedado abajo — y abajo a
 * la derecha, justo donde está "Confirmar", vive la pestaña Ranked de la barra
 * de navegación. Al agregar la comida, la app se iba sola a Ranked.
 *
 * El escudo es una capa transparente que ocupa la pantalla por un instante y
 * no hace nada: el click fantasma le pega a ella y muere ahí.
 */
function useEscudoAntiFantasma(hora: number | null) {
  const [activo, setActivo] = useState(false);
  const previa = useRef(hora);

  useEffect(() => {
    const seCerro = previa.current !== null && hora === null;
    previa.current = hora;
    if (!seCerro) return;

    setActivo(true);
    const id = setTimeout(() => setActivo(false), MS_ESCUDO);
    return () => clearTimeout(id);
  }, [hora]);

  return activo;
}

export function HojaAgregarComida({
  hora,
  onCerrar,
  onConfirmar,
}: {
  hora: number | null;
  onCerrar: () => void;
  onConfirmar: (elegidos: AlimentoElegido[]) => void;
}) {
  const escudo = useEscudoAntiFantasma(hora);

  // Sin estado de "montado": el panel solo existe cuando el alumno tocó una
  // hora, así que en el render del servidor `hora` siempre es null y nunca se
  // llega a tocar `document`.
  if (typeof document === "undefined") return null;
  if (hora === null) {
    // z-50 como el panel: tiene que quedar por encima de la barra de
    // navegación (z-40), que es justo a quien le llegaba el click de más.
    return escudo
      ? createPortal(<div aria-hidden className="fixed inset-0 z-50" />, document.body)
      : null;
  }

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
  // Open Food Facts entra en juego solo cuando el catálogo propio no alcanza.
  const [offResultados, setOffResultados] = useState<ProductoOFF[]>([]);
  const [offEstado, setOffEstado] = useState<"inactivo" | "buscando" | "listo">("inactivo");
  const [offError, setOffError] = useState<string | null>(null);
  const [importandoOffId, setImportandoOffId] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<AlimentoCatalogo | null>(null);
  const [cantidad, setCantidad] = useState("100");
  /** true cuando el alumno mide en cucharadas/unidades en vez de gramos. */
  const [usarMedida, setUsarMedida] = useState(false);
  const [elegidos, setElegidos] = useState<AlimentoElegido[]>([]);
  const [creando, setCreando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  /** Código de barras que no estaba en OFF: se precarga en el formulario de
   * alimento personalizado cuando el escáner cede el paso a "Crear alimento". */
  const [offIdParaCrear, setOffIdParaCrear] = useState<string | null>(null);
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
  // Si el catálogo propio no alcanza, se completa con Open Food Facts
  // (Chile primero; a todo el mundo solo si Chile tampoco encontró nada).
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

      if (encontrados.length >= LIMITE_BUSQUEDA_ALIMENTOS) {
        setOffResultados([]);
        setOffEstado("inactivo");
        return;
      }

      setOffEstado("buscando");
      setOffError(null);
      const chile = await buscarEnOFFAction(q, "chile");
      if (!vigente) return;

      let combinados: ProductoOFF[] = [];
      let error: string | null = null;

      if (chile.ok) {
        combinados = chile.productos.filter((p) => !esDuplicadoDeLocal(p, encontrados));
      } else {
        error = chile.error;
      }

      // Se abre a todo el mundo mientras falten resultados para llenar la
      // lista, no solo cuando Chile no encontró nada: fruta fresca y otros
      // productos sin marca casi no tienen presencia en el catálogo de OFF
      // filtrado por Chile, así que "encontró 1" no significa "encontró todo".
      if (encontrados.length + combinados.length < LIMITE_BUSQUEDA_ALIMENTOS) {
        const global = await buscarEnOFFAction(q, "global");
        if (!vigente) return;
        if (global.ok) {
          const vistos = new Set(combinados.map((p) => p.offId));
          combinados = [
            ...combinados,
            ...global.productos.filter((p) => !vistos.has(p.offId) && !esDuplicadoDeLocal(p, encontrados)),
          ];
          error = null;
        } else if (!error) {
          error = global.error;
        }
      }

      setOffResultados(combinados.slice(0, LIMITE_BUSQUEDA_ALIMENTOS));
      setOffError(error);
      setOffEstado("listo");
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

  /** El alumno eligió un producto de Open Food Facts: se copia al catálogo
   * (para no depender de la API para volver a consultarlo) y de ahí en
   * adelante se trata como cualquier otro alimento. */
  const elegirOFF = async (producto: ProductoOFF) => {
    setImportandoOffId(producto.offId);
    const resultado = await importarAlimentoOFF({
      offId: producto.offId,
      nombre: producto.nombre,
      marca: producto.marca,
      kcal: producto.kcal,
      prot: producto.prot,
      carb: producto.carb,
      grasa: producto.grasa,
      fibra: producto.fibra,
      azucares: producto.azucares,
      sodio: producto.sodio,
      medidaNombre: producto.medidaNombre,
      medidaGramos: producto.medidaGramos,
      imagenUrl: producto.imagenUrl,
    });
    setImportandoOffId(null);
    if (!resultado.alimento) {
      setOffError(resultado.error ?? "No fue posible agregar este producto.");
      return;
    }
    elegirAlimento(resultado.alimento);
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

  /** Calorías y macros de la cantidad que se está por cargar, no de los
   * 100 g/porción base — el alumno necesita ver lo que realmente va a comer. */
  const aporte =
    pendiente && seleccionado
      ? (() => {
          const factor = pendiente.cantidadBase / seleccionado.porcionBase;
          return {
            kcal: Math.round(seleccionado.kcal * factor),
            prot: Math.round(seleccionado.prot * factor),
            carb: Math.round(seleccionado.carb * factor),
            grasa: Math.round(seleccionado.grasa * factor),
            azucares: seleccionado.azucares !== null ? Math.round(seleccionado.azucares * factor) : null,
          };
        })()
      : null;

  /** Lo que se guardaría si se confirmara ahora: la lista más lo que esté a
   * medio cargar. Así un alimento suelto no obliga a pasar por "Sumar a la
   * comida" antes de confirmar. */
  const aGuardar = pendiente ? [...elegidos, pendiente] : elegidos;

  /**
   * Corre la acción una sola vez aunque lleguen `pointerdown` y `click`.
   *
   * Los botones de abajo escuchan los dos eventos a propósito (el `click` solo
   * puede perderse en Android, pero es el que usa el teclado y los lectores de
   * pantalla). Sin este candado, en un navegador donde llegan ambos la comida
   * se agregaría dos veces.
   */
  const ultimaAccion = useRef(0);
  const unaSolaVez = (accion: () => void) => {
    const ahora = Date.now();
    if (ahora - ultimaAccion.current < 600) return;
    ultimaAccion.current = ahora;
    accion();
  };

  /**
   * Toque vs. scroll en la lista de resultados.
   *
   * Antes cada fila elegía el alimento en `onPointerDown` (para que un solo
   * toque bastara incluso con el teclado abierto — ver el comentario que
   * tenían "Confirmar" y "Sumar y buscar otro"). Con la lista más larga
   * ahora (Open Food Facts se suma abajo del catálogo local) eso rompía el
   * scroll: `preventDefault` en el toque inicial le impedía al navegador
   * reconocer que el dedo se estaba arrastrando para bajar, y cualquier
   * intento de scroll que arrancara sobre una fila elegía esa fila al
   * instante.
   *
   * Acá se mide la distancia entre dónde bajó el dedo y dónde se levantó:
   * si se movió más que `UMBRAL_SCROLL_PX`, fue un scroll y no se elige
   * nada. `onPointerUp` no bloquea el scroll (ya terminó para cuando este
   * evento llega), así que el arrastre funciona normal, y sigue
   * disparándose con un solo toque porque no depende del `click` sintético
   * que a veces se pierde.
   */
  const UMBRAL_SCROLL_PX = 10;
  const inicioToque = useRef<{ x: number; y: number } | null>(null);
  const alBajarElDedo = (e: React.PointerEvent) => {
    inicioToque.current = { x: e.clientX, y: e.clientY };
  };
  /** false si el dedo se movió más que el umbral entre bajar y levantar: fue un scroll, no un toque. */
  const fueUnToque = (e: React.PointerEvent) => {
    const inicio = inicioToque.current;
    inicioToque.current = null;
    if (!inicio) return false;
    return Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) <= UMBRAL_SCROLL_PX;
  };

  /** Pedido de volver el cursor al buscador, pendiente de que exista. */
  const volverAlBuscador = useRef(false);

  const sumarALista = () => {
    if (!pendiente) return;
    setElegidos((prev) => [...prev, pendiente]);
    setSeleccionado(null);
    setBusqueda("");
    setResultados([]);
    // El foco NO se puede pedir acá: mientras hay un alimento elegido el
    // buscador no está montado, así que `campo.current` es null y la llamada
    // no hacía nada. El teclado se cerraba y había que tocar el campo de nuevo
    // para cargar el segundo alimento. Se pide para después de que React
    // vuelva a montarlo (ver el efecto de abajo).
    volverAlBuscador.current = true;
  };

  useEffect(() => {
    if (seleccionado || !volverAlBuscador.current) return;
    volverAlBuscador.current = false;
    campo.current?.focus();
  }, [seleccionado]);

  if (creando) {
    return (
      <Marco onCerrar={onCerrar} titulo={`Alimento nuevo · ${etiquetaHora(hora)}`}>
        <FormularioAlimento
          offIdInicial={offIdParaCrear}
          onCancelar={() => {
            setCreando(false);
            setOffIdParaCrear(null);
          }}
          onCreado={(alimento) => {
            setCreando(false);
            setOffIdParaCrear(null);
            elegirAlimento(alimento);
          }}
        />
      </Marco>
    );
  }

  if (escaneando) {
    return (
      <Marco onCerrar={onCerrar} titulo={`Escanear código · ${etiquetaHora(hora)}`}>
        <EscanerCodigoBarras
          onEncontrado={(alimento) => {
            setEscaneando(false);
            elegirAlimento(alimento);
          }}
          onNoEncontrado={(codigo) => {
            setEscaneando(false);
            setOffIdParaCrear(codigo);
            setCreando(true);
          }}
          onVolverATexto={() => setEscaneando(false)}
        />
      </Marco>
    );
  }

  /* La fila que no puede irse de pantalla: se le pasa al Marco como `pie` en
     vez de ir con el resto del contenido. Ver el comentario en Marco. */
  const acciones = (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setCreando(true)}
        className="text-caption font-medium text-vip underline"
      >
        Crear alimento personalizado
      </button>
      {/*
        En Android el `click` de este botón se perdía y la comida no se
        agregaba nunca. El campo de cantidad es numérico: al tocarlo se abre el
        teclado, y al tocar "Confirmar" el campo pierde el foco, el teclado se
        cierra y `visualViewport` cambia de alto. Ese cambio mueve el panel
        entero (ver `useAreaVisible`) ENTRE el pointerdown y el pointerup, así
        que el navegador ya no considera que ambos ocurrieron sobre el mismo
        elemento y nunca emite el `click`. Desde afuera se ve como que el
        alimento elegido "desaparece".
        Actuar en `pointerdown` con `preventDefault` evita el blur, y con eso
        el teclado no se cierra ni nada se mueve. Es el mismo arreglo que ya
        estaba en la lista de resultados por la misma causa.
      */}
      <Button
        size="sm"
        className="w-auto px-5"
        disabled={aGuardar.length === 0}
        onPointerDown={(e) => {
          if (aGuardar.length === 0) return;
          e.preventDefault();
          unaSolaVez(() => onConfirmar(aGuardar));
        }}
        onClick={() => unaSolaVez(() => onConfirmar(aGuardar))}
      >
        Confirmar
      </Button>
    </div>
  );

  return (
    <Marco
      onCerrar={onCerrar}
      titulo={`Agregar a las ${etiquetaHora(hora)}`}
      pie={acciones}
    >
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
              setOffResultados([]);
              setOffEstado("inactivo");
              setOffError(null);
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
                setOffResultados([]);
                setOffEstado("inactivo");
                setOffError(null);
              }}
              className="shrink-0 text-text-tertiary"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            aria-label="Escanear código de barras"
            onClick={() => setEscaneando(true)}
            className="shrink-0 text-text-tertiary"
          >
            <Camera size={17} />
          </button>
        </div>
      )}

      {!seleccionado && buscandoAhora && (
        <p className="text-caption px-1 py-2 text-text-tertiary">Buscando…</p>
      )}

      {!seleccionado &&
        !buscandoAhora &&
        offEstado !== "buscando" &&
        busqueda.trim().length >= 2 &&
        resultados.length === 0 &&
        offResultados.length === 0 && (
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
              onPointerDown={alBajarElDedo}
              onPointerUp={(e) => {
                if (fueUnToque(e)) unaSolaVez(() => elegirAlimento(r));
              }}
              onClick={() => unaSolaVez(() => elegirAlimento(r))}
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

      {!seleccionado && offEstado === "buscando" && (
        <p className="text-caption px-1 py-2 text-text-tertiary">Buscando en Open Food Facts…</p>
      )}

      {!seleccionado && offResultados.length > 0 && (
        <div className="space-y-1">
          {resultados.length > 0 && (
            <p className="text-caption px-1 pt-1 text-text-tertiary">Open Food Facts</p>
          )}
          {offResultados.map((p) => (
            <button
              key={p.offId}
              type="button"
              disabled={importandoOffId !== null}
              onPointerDown={alBajarElDedo}
              onPointerUp={(e) => {
                if (fueUnToque(e)) unaSolaVez(() => elegirOFF(p));
              }}
              onClick={() => unaSolaVez(() => elegirOFF(p))}
              className="radius-control flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2 active:bg-surface-2 disabled:opacity-60"
            >
              {p.imagenUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagenUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface">
                  <ImageOff size={14} className="text-text-tertiary" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-secondary text-text">
                {p.nombre}
                {p.marca && <span className="text-text-tertiary"> · {p.marca}</span>}
              </span>
              <span className="text-caption shrink-0 text-text-tertiary">
                {importandoOffId === p.offId ? "Agregando…" : `${Math.round(p.kcal)} kcal`}
              </span>
            </button>
          ))}
        </div>
      )}

      {!seleccionado && offError && (
        <p className="text-caption px-1 py-1 text-text-tertiary">{offError}</p>
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

          {aporte && (
            <div className="radius-control grid grid-cols-4 gap-2 bg-surface-2 p-2 text-center">
              <div>
                <p className="text-secondary text-text">{aporte.kcal}</p>
                <p className="text-caption text-text-tertiary">kcal</p>
              </div>
              <div>
                <p className="text-secondary text-text">{aporte.prot} g</p>
                <p className="text-caption text-text-tertiary">Prot</p>
              </div>
              <div>
                <p className="text-secondary text-text">{aporte.carb} g</p>
                <p className="text-caption text-text-tertiary">Carb</p>
              </div>
              <div>
                <p className="text-secondary text-text">{aporte.grasa} g</p>
                <p className="text-caption text-text-tertiary">Grasa</p>
              </div>
            </div>
          )}
          {aporte?.azucares !== null && aporte && (
            <p className="text-caption text-text-tertiary">Azúcares: {aporte.azucares} g</p>
          )}

          {/* Atajo para cargar VARIOS alimentos en la misma comida: suma este y
              deja el buscador listo para el siguiente. Para uno solo no hace
              falta pasar por acá — Confirmar ya lo toma. */}
          {/* onPointerDown + preventDefault, igual que en la lista de
              resultados: ver el comentario largo en el botón "Confirmar". */}
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onPointerDown={(e) => {
              e.preventDefault();
              unaSolaVez(sumarALista);
            }}
            onClick={() => unaSolaVez(sumarALista)}
          >
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
type AreaVisible = { alto: number; desde: number };

/**
 * Los valores se redondean a propósito. `visualViewport` los entrega con
 * decimales y en Android cambian de a fracciones de píxel durante toda la
 * subida del teclado: sin redondear, cada uno de esos avisos era un render
 * más y el panel entero temblaba mientras se acomodaba.
 */
function leerArea(): AreaVisible | null {
  // Sin `window` (render del servidor) o sin la API: se cae al comportamiento
  // de antes, que es el panel pegado al borde de abajo de la pantalla.
  if (typeof window === "undefined" || !window.visualViewport) return null;
  const vv = window.visualViewport;
  return { alto: Math.round(vv.height), desde: Math.round(vv.offsetTop) };
}

function useAreaVisible() {
  // Se mide en el primer render y no en el efecto: midiendo después, el panel
  // se pintaba una vez del alto de la pantalla completa y recién ahí se
  // acomodaba. Ese primer salto era el que se veía como un rectángulo negro
  // que se agrandaba justo al abrir el buscador.
  const [area, setArea] = useState<AreaVisible | null>(leerArea);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const medir = () => {
      const nueva = leerArea();
      if (!nueva) return;
      // Devolver el objeto anterior cuando nada cambió corta el render: si no,
      // cada aviso repetido del teclado vuelve a pintar el panel.
      setArea((previa) =>
        previa && previa.alto === nueva.alto && previa.desde === nueva.desde
          ? previa
          : nueva
      );
    };
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
  pie,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  /**
   * Fila de acciones. Va SEPARADA del contenido a propósito: es lo único que
   * no puede irse de pantalla nunca.
   *
   * Antes el panel era una sola caja con scroll, así que "Confirmar" y "Sumar
   * y buscar otro" se desplazaban junto con la lista de resultados. Con el
   * teclado abierto y una búsqueda con varios resultados, quedaban por debajo
   * del borde y no había forma de llegar a ellos: desde afuera se veía como
   * que la opción de agregar otro alimento directamente no existía.
   */
  pie?: React.ReactNode;
  children: React.ReactNode;
}) {
  const area = useAreaVisible();

  /**
   * Si el toque EMPEZÓ sobre el fondo negro. Solo entonces cerrar es lo que el
   * alumno pidió.
   *
   * Sin esto el panel se cerraba solo al tocar "Sumar y buscar otro": al sumar,
   * el formulario de cantidad desaparece y el panel se encoge de golpe, así que
   * para cuando el dedo se levanta, bajo ese mismo punto de la pantalla ya no
   * está el botón sino el fondo. Android emite el `click` contra lo que haya
   * ahí EN ESE MOMENTO, y ese click caía en el fondo y cerraba todo. Desde
   * afuera se veía como que la comida se perdía y había que empezar de nuevo.
   */
  const inicioEnFondo = useRef(false);

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col justify-end"
      style={area ? { top: area.desde, height: area.alto } : { top: 0, bottom: 0 }}
      // En captura, o sea ANTES que el handler del fondo: así un toque que
      // arranca dentro del panel deja la marca en false y el fondo la respeta.
      onPointerDownCapture={() => {
        inicioEnFondo.current = false;
      }}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onPointerDown={() => {
          inicioEnFondo.current = true;
        }}
        onClick={() => {
          if (inicioEnFondo.current) onCerrar();
          inicioEnFondo.current = false;
        }}
        className="absolute inset-0 bg-black/60 animate-[aparecer-hoja_200ms_ease-out]"
      />
      {/*
        Columna de tres piezas: encabezado y pie de alto fijo, y en el medio lo
        único que scrollea. El `max-h-[85%]` es del área visible que ya calculó
        el contenedor de arriba, no `85vh`: con `vh` el panel podía medir más
        que la pantalla disponible y volvía a esconderse bajo el teclado.
      */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="franja-segura-inferior relative mx-auto flex max-h-[85%] w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border-t border-border bg-surface animate-[subir-hoja_220ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-4">
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
        {/* `min-h-0` no es decorativo: sin él un hijo flex se niega a achicarse
            por debajo de su contenido y la lista larga vuelve a empujar el pie
            fuera del panel en vez de scrollear. */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-1">
          {children}
        </div>
        {pie && <div className="shrink-0 px-4 pb-4 pt-3">{pie}</div>}
      </div>
    </div>
  );
}

/** Alta de un alimento que no está en el catálogo del gimnasio. */
function FormularioAlimento({
  offIdInicial = null,
  onCancelar,
  onCreado,
}: {
  /** Código de barras, cuando se llega acá desde el escáner sin match en OFF. */
  offIdInicial?: string | null;
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
      offId: offIdInicial,
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
      {offIdInicial && (
        <p className="text-caption text-text-tertiary">
          Código escaneado: {offIdInicial} (no está en Open Food Facts, se guarda igual)
        </p>
      )}

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
