"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Search, X, Plus, ChevronLeft, Camera, ImageOff, Bookmark, ChefHat, Save, Trash2 } from "lucide-react";
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
import {
  alternarFavoritoNutricionV2,
  eliminarRecetaNutricionV2,
  guardarRecetaNutricionV2,
  obtenerBibliotecaNutricionV2,
  type BibliotecaNutricionV2,
} from "@/app/portal-v2/nutricion/actions";
import { normalizar } from "@/lib/alimentos/emparejar";
import { EscanerCodigoBarras } from "./EscanerCodigoBarras";

/**
 * Un producto de OFF que ya aparece en el catálogo local no aporta nada nuevo:
 * se prefiere el propio.
 *
 * La comparación por inclusión pide un largo mínimo. Sin él, un alimento local
 * de nombre corto se comportaba como comodín contra todo el catálogo de OFF:
 * tener "Sal" en la base hacía desaparecer "Salsa de tomate", "Salame",
 * "Salchicha" y "Salvado de avena" de los resultados, sin ninguna explicación
 * en pantalla. Lo mismo con "Te", "Pan" o "Ajo".
 */
const LARGO_MINIMO_INCLUSION = 5;

function esDuplicadoDeLocal(producto: ProductoOFF, locales: AlimentoCatalogo[]): boolean {
  const objetivo = normalizar(producto.nombre);
  if (!objetivo) return false;
  const conMarca = producto.marca ? normalizar(`${producto.marca} ${producto.nombre}`) : objetivo;
  return locales.some((l) => {
    const n = normalizar(l.nombre);
    if (!n) return false;
    if (n === objetivo || n === conMarca) return true;
    const corto = Math.min(n.length, objetivo.length);
    if (corto < LARGO_MINIMO_INCLUSION) return false;
    return n.includes(objetivo) || objetivo.includes(n);
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
 * "Confirmar" actúa en `pointerdown` (ver su comentario), así que para cuando
 * el dedo se levanta el panel ya no está. El click sintético cae entonces
 * sobre lo que haya quedado abajo — y abajo a la derecha, justo donde está
 * "Confirmar", vive la pestaña Ranked de la barra de navegación. Al agregar la
 * comida, la app se iba sola a Ranked.
 *
 * El escudo es una capa transparente que ocupa la pantalla por un instante y
 * no hace nada: el click fantasma le pega a ella y muere ahí.
 *
 * Solo se arma cuando el cierre vino de "Confirmar" (`armado`). Antes se
 * armaba en CUALQUIER cierre, y en los demás —la X, el fondo, Escape— la
 * acción ya había corrido en el `click`, o sea que no quedaba ningún click
 * pendiente que tragar: el escudo solo tapaba la pantalla 350 ms de más, y
 * quien cerraba el panel y tocaba enseguida el "+" de otra hora perdía ese
 * toque.
 */
function useEscudoAntiFantasma(hora: number | null, armado: React.RefObject<boolean>) {
  const [activo, setActivo] = useState(false);
  const previa = useRef(hora);

  useEffect(() => {
    const seCerro = previa.current !== null && hora === null;
    previa.current = hora;
    // `armado` se lee acá, en el efecto, y no en el render: para cuando el
    // efecto corre, "Confirmar" ya lo dejó en true.
    if (!seCerro || !armado.current) return;

    setActivo(true);
    const id = setTimeout(() => setActivo(false), MS_ESCUDO);
    return () => {
      clearTimeout(id);
      // Si el panel se reabre antes de que venza el plazo, el timeout se
      // cancela: sin esto `activo` quedaba en true indefinidamente.
      setActivo(false);
    };
  }, [hora, armado]);

  return activo;
}

export function HojaAgregarComida({
  hora,
  onCerrar,
  onConfirmar,
  modoInicial = "buscar",
  bibliotecaV2 = false,
}: {
  hora: number | null;
  onCerrar: () => void;
  onConfirmar: (elegidos: AlimentoElegido[]) => void;
  modoInicial?: "buscar" | "escanear";
  bibliotecaV2?: boolean;
}) {
  /** Lo levanta "Confirmar" justo antes de cerrar: es el único cierre que
   * deja un click sintético en el aire. */
  const cerroConfirmando = useRef(false);
  const escudo = useEscudoAntiFantasma(hora, cerroConfirmando);

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
    <Contenido
      hora={hora}
      modoInicial={modoInicial}
      bibliotecaV2={bibliotecaV2}
      onCerrar={() => {
        cerroConfirmando.current = false;
        onCerrar();
      }}
      onConfirmar={(elegidos) => {
        cerroConfirmando.current = true;
        onConfirmar(elegidos);
      }}
    />,
    document.body
  );
}

function Contenido({
  hora,
  onCerrar,
  onConfirmar,
  modoInicial,
  bibliotecaV2,
}: {
  hora: number;
  onCerrar: () => void;
  onConfirmar: (elegidos: AlimentoElegido[]) => void;
  modoInicial: "buscar" | "escanear";
  bibliotecaV2: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<AlimentoCatalogo[]>([]);
  const [buscandoAhora, setBuscandoAhora] = useState(false);
  // Open Food Facts entra en juego solo cuando el catálogo propio no alcanza.
  const [offResultados, setOffResultados] = useState<ProductoOFF[]>([]);
  const [offEstado, setOffEstado] = useState<"inactivo" | "buscando" | "listo">("inactivo");
  const [offError, setOffError] = useState<string | null>(null);
  const versionBusqueda = useRef(0);
  const [importandoOffId, setImportandoOffId] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<AlimentoCatalogo | null>(null);
  const [cantidad, setCantidad] = useState("100");
  /** true cuando el alumno mide en cucharadas/unidades en vez de gramos. */
  const [usarMedida, setUsarMedida] = useState(false);
  const [elegidos, setElegidos] = useState<AlimentoElegido[]>([]);
  const [creando, setCreando] = useState(false);
  const [escaneando, setEscaneando] = useState(modoInicial === "escanear");
  const [vistaBiblioteca, setVistaBiblioteca] = useState<"buscar" | "favoritos" | "recetas">("buscar");
  const [biblioteca, setBiblioteca] = useState<BibliotecaNutricionV2>({ disponible: false, favoritos: [], recetas: [] });
  const [nombreReceta, setNombreReceta] = useState("");
  const [errorBiblioteca, setErrorBiblioteca] = useState<string | null>(null);
  const [guardandoBiblioteca, iniciarGuardadoBiblioteca] = useTransition();
  /** Código de barras que no estaba en OFF: se precarga en el formulario de
   * alimento personalizado cuando el escáner cede el paso a "Crear alimento". */
  const [offIdParaCrear, setOffIdParaCrear] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bibliotecaV2) return;
    let vigente = true;
    void obtenerBibliotecaNutricionV2()
      .then((resultado) => { if (vigente) setBiblioteca(resultado); })
      .catch(() => { if (vigente) setErrorBiblioteca("No pudimos abrir tus guardados."); });
    return () => { vigente = false; };
  }, [bibliotecaV2]);

  // Escape cierra.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  /**
   * El fondo no debe scrollear detrás del panel abierto.
   *
   * Va SOLO, con dependencias vacías, y separado del listener de Escape:
   * la pantalla de atrás vuelve a medirse en cada `resize` de
   * `visualViewport` (ver `PantallaComer`), y con `[onCerrar]` de
   * dependencia este efecto se desarmaba y se rearmaba en medio del gesto,
   * desbloqueando el fondo por un instante en cada apertura/cierre de
   * teclado.
   *
   * Alcanza con `overflow: hidden` (sin tocar `position`): `viewport.
   * interactiveWidget = "resizes-visual"` en layout.tsx ya le pide a Android
   * el mismo comportamiento que iOS por defecto — el viewport de LAYOUT
   * nunca se mueve ni se achica con el teclado, solo el visual. Bajo ese
   * modelo nada `fixed` necesita salir del flujo del documento para quedar
   * quieto; sacar el body a `position: fixed` es redundante encima de eso y
   * fuerza un reflow completo de toda la pantalla de atrás en cada apertura
   * y cierre, que es el salto brusco reportado en el teléfono real.
   */
  useEffect(() => {
    const overflowPrevio = document.body.style.overflow;
    const overscrollHtmlPrevio = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = overflowPrevio;
      document.documentElement.style.overscrollBehavior = overscrollHtmlPrevio;
    };
  }, []);

  // El catálogo VIP sí se consulta mientras se escribe porque vive en nuestra
  // base. Open Food Facts NO: su límite oficial es 10 búsquedas/min/IP y pide
  // expresamente no implementar search-as-you-type. La consulta externa se
  // dispara con el botón visible más abajo.
  useEffect(() => {
    const q = busqueda.trim();
    // Con menos de 2 letras no se consulta; la lista ya la vació el onChange.
    if (q.length < 2) return;

    let vigente = true;
    const id = setTimeout(async () => {
      /**
       * Todo el cuerpo va dentro del try. Si una Server Action rechaza (señal
       * caída a mitad de camino, el servidor reiniciándose), sin esto la
       * ejecución muere antes de apagar las banderas: quedaba "Buscando…"
       * para siempre, y como el bloque de "crear alimento a mano" pide
       * `!buscandoAhora` para mostrarse, el socio no tenía NINGUNA salida.
       */
      try {
        const encontrados = await buscarAlimentosAction(q);
        if (!vigente) return;
        setResultados(encontrados);
        setBuscandoAhora(false);
      } catch {
        if (!vigente) return;
        setBuscandoAhora(false);
        setOffEstado("listo");
        setOffResultados([]);
        setOffError("No se pudo buscar. Revisa tu conexión.");
      }
    }, 250);

    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [busqueda]);

  const buscarCatalogoExterno = async () => {
    const q = busqueda.trim();
    if (q.length < 2 || offEstado === "buscando") return;
    const version = versionBusqueda.current;
    setOffEstado("buscando");
    setOffError(null);
    try {
      const chile = await buscarEnOFFAction(q, "chile");
      if (version !== versionBusqueda.current) return;
      let combinados: ProductoOFF[] = [];
      let error: string | null = null;
      if (chile.ok) combinados = chile.productos.filter((p) => !esDuplicadoDeLocal(p, resultados));
      else error = chile.error;

      if (resultados.length + combinados.length < LIMITE_BUSQUEDA_ALIMENTOS) {
        const global = await buscarEnOFFAction(q, "global");
        if (version !== versionBusqueda.current) return;
        if (global.ok) {
          const vistos = new Set(combinados.map((p) => p.offId));
          combinados = [...combinados, ...global.productos.filter((p) => !vistos.has(p.offId) && !esDuplicadoDeLocal(p, resultados))];
          error = null;
        } else if (!error) error = global.error;
      }
      setOffResultados(combinados.slice(0, LIMITE_BUSQUEDA_ALIMENTOS));
      setOffError(error);
      setOffEstado("listo");
    } catch {
      if (version !== versionBusqueda.current) return;
      setOffResultados([]);
      setOffError("No se pudo consultar el catálogo externo. Intenta nuevamente.");
      setOffEstado("listo");
    }
  };

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
    setOffError(null);
    try {
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
      if (!resultado.alimento) {
        setOffError(resultado.error ?? "No fue posible agregar este producto.");
        return;
      }
      elegirAlimento(resultado.alimento);
    } catch {
      setOffError("No se pudo agregar. Revisa tu conexión e intenta nuevamente.");
    } finally {
      // En `finally` y no después del await: si la acción rechaza, sin esto
      // `importandoOffId` quedaba con valor y TODAS las filas de Open Food
      // Facts se quedaban deshabilitadas para el resto de la sesión.
      setImportandoOffId(null);
    }
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
          // Una porción base en 0 vendría de una fila mal sembrada, pero
          // dividir igual mostraría "Infinity kcal" y volvería NaN el total
          // del día.
          const factor =
            seleccionado.porcionBase > 0 ? pendiente.cantidadBase / seleccionado.porcionBase : 0;
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

  const idsFavoritos = new Set(biblioteca.favoritos.map((alimento) => alimento.id));
  const refrescarBiblioteca = async () => {
    const siguiente = await obtenerBibliotecaNutricionV2();
    setBiblioteca(siguiente);
    return siguiente;
  };
  const alternarFavorito = (alimento: AlimentoCatalogo) => {
    iniciarGuardadoBiblioteca(async () => {
      setErrorBiblioteca(null);
      const resultado = await alternarFavoritoNutricionV2(alimento.id, !idsFavoritos.has(alimento.id));
      if (!resultado.ok) {
        setErrorBiblioteca(resultado.error);
        return;
      }
      await refrescarBiblioteca();
    });
  };
  const guardarComoReceta = () => {
    const ingredientes = aGuardar;
    iniciarGuardadoBiblioteca(async () => {
      setErrorBiblioteca(null);
      const resultado = await guardarRecetaNutricionV2({
        nombre: nombreReceta,
        ingredientes: ingredientes.map((item) => ({ alimentoId: item.alimento.id, cantidadBase: item.cantidadBase })),
      });
      if (!resultado.ok) {
        setErrorBiblioteca(resultado.error);
        return;
      }
      setNombreReceta("");
      await refrescarBiblioteca();
      setVistaBiblioteca("recetas");
      setSeleccionado(null);
    });
  };
  const usarReceta = (receta: BibliotecaNutricionV2["recetas"][number]) => {
    setElegidos(receta.ingredientes.map((ingrediente) => ({
      alimento: ingrediente.alimento,
      cantidadBase: ingrediente.cantidadBase / Math.max(1, receta.porciones),
    })));
    setSeleccionado(null);
    setVistaBiblioteca("buscar");
  };
  const eliminarReceta = (recetaId: string) => {
    iniciarGuardadoBiblioteca(async () => {
      const resultado = await eliminarRecetaNutricionV2(recetaId);
      if (!resultado.ok) {
        setErrorBiblioteca(resultado.error);
        return;
      }
      await refrescarBiblioteca();
    });
  };

  /**
   * Corre la acción una sola vez aunque lleguen `pointerup` y `click`.
   *
   * Los botones de abajo escuchan los dos eventos a propósito (el `click` solo
   * puede perderse en Android, pero es el que usa el teclado y los lectores de
   * pantalla). Sin este candado, en un navegador donde llegan ambos la comida
   * se agregaría dos veces.
   *
   * El candado es POR ACCIÓN, no uno global. Con uno solo compartido, tocar un
   * resultado y enseguida "Confirmar" no hacía nada: la segunda acción caía
   * dentro de la ventana abierta por la primera, y el socio veía el botón
   * muerto sin ninguna explicación — justo el síntoma que ya se había
   * peleado antes por otra causa. Y 200 ms alcanzan: el par pointerup/click
   * del mismo toque llega con milisegundos de diferencia.
   */
  const accionesEnCurso = useRef(new Set<string>());
  const unaSolaVez = (clave: string, accion: () => void) => {
    if (accionesEnCurso.current.has(clave)) return;
    accionesEnCurso.current.add(clave);
    accion();
    window.setTimeout(() => accionesEnCurso.current.delete(clave), 200);
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
  const gestoFueScroll = useRef(false);
  const alBajarElDedo = (e: React.PointerEvent) => {
    gestoFueScroll.current = false;
    inicioToque.current = { x: e.clientX, y: e.clientY };
  };
  /** false si el dedo se movió más que el umbral entre bajar y levantar: fue un scroll, no un toque. */
  const fueUnToque = (e: React.PointerEvent) => {
    const inicio = inicioToque.current;
    inicioToque.current = null;
    if (!inicio) return false;
    const esToque = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) <= UMBRAL_SCROLL_PX;
    gestoFueScroll.current = !esToque;
    return esToque;
  };
  const alClickDeFila = (clave: string, accion: () => void) => {
    if (gestoFueScroll.current) {
      gestoFueScroll.current = false;
      return;
    }
    unaSolaVez(clave, accion);
  };

  /** Pedido de volver el cursor al buscador, pendiente de que exista. */
  const volverAlBuscador = useRef(false);

  const sumarALista = () => {
    if (!pendiente) return;
    setElegidos((prev) => [...prev, pendiente]);
    setSeleccionado(null);
    versionBusqueda.current += 1;
    setBusqueda("");
    setResultados([]);
    // También los de Open Food Facts: al vaciar la búsqueda el efecto sale por
    // el return temprano y no los limpia, así que quedaban colgando bajo un
    // buscador vacío (y sin su encabezado, que exige resultados locales).
    setOffResultados([]);
    setOffEstado("inactivo");
    setOffError(null);
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
          // Lo que ya escribió en el buscador: no tiene por qué tipearlo dos
          // veces. Si llegó desde el escáner no hay búsqueda que reusar.
          nombreInicial={offIdParaCrear ? "" : busqueda.trim()}
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
          unaSolaVez("confirmar", () => onConfirmar(aGuardar));
        }}
        onClick={() => unaSolaVez("confirmar", () => onConfirmar(aGuardar))}
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
      {bibliotecaV2 && biblioteca.disponible && !seleccionado ? (
        <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Biblioteca nutricional">
          <button type="button" role="tab" aria-selected={vistaBiblioteca === "buscar"} onClick={() => setVistaBiblioteca("buscar")} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] ${vistaBiblioteca === "buscar" ? "bg-surface-2 text-text" : "text-text-tertiary"}`}><Search size={16} />Buscar</button>
          <button type="button" role="tab" aria-selected={vistaBiblioteca === "favoritos"} onClick={() => setVistaBiblioteca("favoritos")} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] ${vistaBiblioteca === "favoritos" ? "bg-surface-2 text-text" : "text-text-tertiary"}`}><Bookmark size={16} />Guardados</button>
          <button type="button" role="tab" aria-selected={vistaBiblioteca === "recetas"} onClick={() => setVistaBiblioteca("recetas")} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] ${vistaBiblioteca === "recetas" ? "bg-surface-2 text-text" : "text-text-tertiary"}`}><ChefHat size={16} />Recetas</button>
          <button type="button" onClick={() => setEscaneando(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-text-tertiary"><Camera size={16} />Escanear</button>
        </div>
      ) : null}

      {!seleccionado && vistaBiblioteca === "favoritos" ? (
        <div className="space-y-1">
          {biblioteca.favoritos.map((alimento) => (
            <button type="button" key={alimento.id} onClick={() => elegirAlimento(alimento)} className="radius-control flex min-h-[48px] w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1 truncate text-secondary text-text">{alimento.nombre}</span><span className="text-caption text-text-tertiary">{Math.round(alimento.kcal)} kcal</span>
            </button>
          ))}
          {biblioteca.favoritos.length === 0 ? <p className="p-3 text-center text-secondary text-text-tertiary">Marca alimentos desde el buscador para encontrarlos aquí.</p> : null}
        </div>
      ) : null}

      {!seleccionado && vistaBiblioteca === "recetas" ? (
        <div className="space-y-2">
          {biblioteca.recetas.map((receta) => (
            <article key={receta.id} className="radius-control flex min-h-[58px] items-center gap-2 border border-border bg-surface-2 px-3 py-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => usarReceta(receta)}><strong className="block truncate text-secondary text-text">{receta.nombre}</strong><small className="text-caption text-text-tertiary">{receta.ingredientes.length} ingredientes · {receta.porciones} porción</small></button>
              <button type="button" aria-label={`Eliminar ${receta.nombre}`} disabled={guardandoBiblioteca} onClick={() => eliminarReceta(receta.id)} className="grid h-10 w-10 place-items-center rounded-full text-error"><Trash2 size={16} /></button>
            </article>
          ))}
          {biblioteca.recetas.length === 0 ? <p className="p-3 text-center text-secondary text-text-tertiary">Agrega ingredientes y guárdalos como receta para reutilizarlos.</p> : null}
        </div>
      ) : null}

      {errorBiblioteca ? <p className="radius-control border border-error/30 bg-error/10 p-3 text-secondary text-error" role="alert">{errorBiblioteca}</p> : null}

      {!seleccionado && vistaBiblioteca === "buscar" && (
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
              versionBusqueda.current += 1;
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
                versionBusqueda.current += 1;
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

      {!seleccionado && vistaBiblioteca === "buscar" && buscandoAhora && (
        <p className="text-caption px-1 py-2 text-text-tertiary">Buscando…</p>
      )}

      {!seleccionado && vistaBiblioteca === "buscar" && !buscandoAhora && busqueda.trim().length >= 2 && resultados.length < LIMITE_BUSQUEDA_ALIMENTOS && offEstado === "inactivo" && (
        <button type="button" onClick={buscarCatalogoExterno} className="radius-control flex min-h-11 w-full items-center justify-center gap-2 border border-vip/25 bg-vip/5 px-3 text-caption font-semibold text-vip">
          <Search size={15} /> Buscar productos y marcas de Chile
        </button>
      )}

      {/* Cuando no hay resultados NO alcanza con decir "sin resultados": el
          socio queda sin saber qué hacer y abandona la carga. Acá se le
          ofrecen las dos salidas que tiene, con el nombre que ya escribió
          listo para reutilizar. */}
      {!seleccionado && vistaBiblioteca === "buscar" &&
        !buscandoAhora &&
        offEstado !== "buscando" &&
        busqueda.trim().length >= 2 &&
        resultados.length === 0 &&
        offResultados.length === 0 && (
          <div className="radius-control space-y-3 border border-border p-3">
            <p className="text-secondary text-text">
              No encontramos &quot;{busqueda.trim()}&quot;.
            </p>
            <p className="text-caption text-text-tertiary">
              Puedes crearlo tú mismo con los datos de la etiqueta: lo usas al instante y queda
              guardado para la próxima vez.
            </p>
            <Button size="sm" className="w-full" onClick={() => setCreando(true)}>
              <Plus size={15} /> Crear &quot;{busqueda.trim().slice(0, 24)}&quot;
            </Button>
            <button
              type="button"
              onClick={() => setEscaneando(true)}
              className="text-caption flex w-full items-center justify-center gap-1.5 text-text-tertiary underline"
            >
              <Camera size={14} /> o escanea el código de barras del envase
            </button>
          </div>
        )}

      {!seleccionado && vistaBiblioteca === "buscar" && resultados.length > 0 && (
        <div className="space-y-1">
          {resultados.map((r) => (
            <button
              key={r.id}
              type="button"
              // `touch-pan-y`: le dice al navegador que acá solo se arrastra
              // en vertical, así resuelve enseguida si el gesto es scroll o
              // toque en vez de esperar a ver si es un zoom o un arrastre
              // horizontal.
              style={{ touchAction: "pan-y" }}
              onPointerDown={alBajarElDedo}
              onPointerUp={(e) => {
                if (fueUnToque(e)) unaSolaVez(`local:${r.id}`, () => elegirAlimento(r));
              }}
              onClick={() => alClickDeFila(`local:${r.id}`, () => elegirAlimento(r))}
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

      {!seleccionado && vistaBiblioteca === "buscar" && offEstado === "buscando" && (
        <p className="text-caption px-1 py-2 text-text-tertiary">Buscando en Open Food Facts…</p>
      )}

      {!seleccionado && vistaBiblioteca === "buscar" && offResultados.length > 0 && (
        <div className="space-y-1">
          {resultados.length > 0 && (
            <p className="text-caption px-1 pt-1 text-text-tertiary">Open Food Facts</p>
          )}
          {offResultados.map((p) => (
            <button
              key={p.offId}
              type="button"
              disabled={importandoOffId !== null}
              // `touch-pan-y`: le dice al navegador que acá solo se arrastra
              // en vertical, así resuelve enseguida si el gesto es scroll o
              // toque en vez de esperar a ver si es un zoom o un arrastre
              // horizontal.
              style={{ touchAction: "pan-y" }}
              onPointerDown={alBajarElDedo}
              onPointerUp={(e) => {
                if (fueUnToque(e)) unaSolaVez(`off:${p.offId}`, () => elegirOFF(p));
              }}
              onClick={() => alClickDeFila(`off:${p.offId}`, () => elegirOFF(p))}
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

      {!seleccionado && vistaBiblioteca === "buscar" && offError && (
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
            {biblioteca.disponible ? <button type="button" disabled={guardandoBiblioteca} aria-label={idsFavoritos.has(seleccionado.id) ? `Quitar ${seleccionado.nombre} de guardados` : `Guardar ${seleccionado.nombre}`} aria-pressed={idsFavoritos.has(seleccionado.id)} onClick={() => alternarFavorito(seleccionado)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${idsFavoritos.has(seleccionado.id) ? "bg-vip/15 text-vip" : "text-text-tertiary"}`}><Bookmark size={17} fill={idsFavoritos.has(seleccionado.id) ? "currentColor" : "none"} /></button> : null}
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
              unaSolaVez("sumar", sumarALista);
            }}
            onClick={() => unaSolaVez("sumar", sumarALista)}
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

      {biblioteca.disponible && aGuardar.length > 0 ? (
        <div className="radius-control grid grid-cols-[1fr_auto] gap-2 border border-border bg-surface-2 p-2">
          <label className="min-w-0"><span className="sr-only">Nombre de la receta</span><input value={nombreReceta} onChange={(evento) => setNombreReceta(evento.target.value)} maxLength={60} placeholder="Nombre para guardar como receta" className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-secondary text-text outline-none" /></label>
          <button type="button" disabled={guardandoBiblioteca || nombreReceta.trim().length < 2} onClick={guardarComoReceta} className="flex min-h-11 items-center gap-1.5 rounded-lg bg-vip px-3 text-[12px] font-semibold text-black disabled:opacity-40"><Save size={15} />Guardar</button>
        </div>
      ) : null}

    </Marco>
  );
}

/** Fondo, panel y animación de entrada, comunes a las dos vistas del panel. */
/**
 * Cuántos píxeles del alto de la pantalla se está comiendo el teclado.
 *
 * El marco del panel NO se mide: cubre siempre la pantalla entera (ver Marco).
 * Lo único que depende del teclado es cuánto hay que separar el diálogo del
 * borde de abajo para que no quede tapado.
 *
 * Antes se calculaban `top` y `height` del marco a partir de `visualViewport`.
 * Con el teclado arriba, iOS avisa cambios de `visualViewport` también al
 * deslizar —el rebote del scroll cuenta como cambio de área—, y cada aviso
 * reescribía la geometría del marco entero: el panel se encogía a una franja,
 * y como el fondo negro vive DENTRO del marco, la pantalla de atrás y los
 * íconos quedaban a la vista sin atenuar. Midiendo solo el teclado, el peor
 * caso posible es que el diálogo quede unos píxeles corrido: el marco sigue
 * tapando todo y no hay nada que pueda saltar.
 */
function leerAltoTeclado(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  // `innerHeight` es el viewport de LAYOUT, que no se achica con el teclado
  // (layout.tsx pide `interactiveWidget: "resizes-visual"`). La diferencia
  // contra el visual es exactamente lo que ocupa el teclado.
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

/**
 * Menos que esto no es un teclado, es ruido: el rebote del scroll y la barra
 * de direcciones al esconderse mueven el área visual unas decenas de píxeles.
 */
const MINIMO_TECLADO_PX = 80;

/** Cuánto tiene que cambiar para que valga la pena mover el diálogo. Abrir o
 * cerrar el teclado mueve cientos de píxeles, así que el umbral no lo estorba;
 * lo que corta es el temblor mientras se recorre la lista. */
const UMBRAL_TECLADO_PX = 24;

function useAltoTeclado() {
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let dedoAbajo = false;
    let medicionPendiente = false;

    const medir = () => {
      const crudo = leerAltoTeclado();
      const nuevo = crudo < MINIMO_TECLADO_PX ? 0 : crudo;
      setAlto((previo) => (Math.abs(previo - nuevo) < UMBRAL_TECLADO_PX ? previo : nuevo));
    };
    medir();

    // Con el dedo apoyado no se toca nada: mover el diálogo en mitad del
    // gesto es lo que hacía que un scroll terminara seleccionando otra fila,
    // o que el toque se perdiera.
    const medirCuandoEsteQuieto = () => {
      if (dedoAbajo) {
        medicionPendiente = true;
        return;
      }
      medir();
    };
    const iniciarGesto = () => {
      dedoAbajo = true;
    };
    const terminarGesto = () => {
      dedoAbajo = false;
      if (!medicionPendiente) return;
      medicionPendiente = false;
      requestAnimationFrame(medir);
    };

    vv.addEventListener("resize", medirCuandoEsteQuieto);
    document.addEventListener("pointerdown", iniciarGesto, true);
    document.addEventListener("pointerup", terminarGesto, true);
    document.addEventListener("pointercancel", terminarGesto, true);
    return () => {
      vv.removeEventListener("resize", medirCuandoEsteQuieto);
      document.removeEventListener("pointerdown", iniciarGesto, true);
      document.removeEventListener("pointerup", terminarGesto, true);
      document.removeEventListener("pointercancel", terminarGesto, true);
    };
  }, []);

  return alto;
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
  const altoTeclado = useAltoTeclado();

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
    /* `inset-0` fijo, sin medir: el marco cubre SIEMPRE la pantalla completa.
       El fondo negro es hijo suyo, así que de esta forma no hay manera de que
       la pantalla de atrás ni los íconos se asomen, pase lo que pase con el
       teclado. Lo único que se mueve es la separación de abajo, que es lo que
       levanta el diálogo por encima del teclado. */
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end overscroll-none"
      style={{ paddingBottom: altoTeclado }}
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
        className="absolute inset-0 touch-none bg-black/60 animate-[aparecer-hoja_200ms_ease-out]"
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
        {/* `touch-none`: el encabezado y el pie no scrollean nada, pero sin
            esto iOS toma el arrastre que empieza sobre ellos y lo aplica al
            documento de atrás igual —aunque no tenga scroll, rebota—, que es
            lo que hacía saltar toda la hoja al deslizar desde el título. La
            lista del medio conserva su `touch-pan-y`. */}
        <div className="flex shrink-0 touch-none items-center justify-between gap-3 px-4 pb-3 pt-4">
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
            fuera del panel en vez de scrollear.

            `overscroll-contain` frena el scroll acá dentro: sin él, al llegar
            al final de la lista el gesto seguía de largo hacia la página de
            atrás, y en el celular eso esconde y vuelve a mostrar la barra de
            direcciones. Cada uno de esos cambios reposicionaba el panel, que
            se veía temblando mientras se scrolleaba. */}
        <div className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-4 pb-1">
          {children}
        </div>
        {pie && <div className="shrink-0 touch-none px-4 pb-4 pt-3">{pie}</div>}
      </div>
    </div>
  );
}

/** Alta de un alimento que no está en el catálogo del gimnasio. */
function FormularioAlimento({
  offIdInicial = null,
  nombreInicial = "",
  onCancelar,
  onCreado,
}: {
  /** Código de barras, cuando se llega acá desde el escáner sin match en OFF. */
  offIdInicial?: string | null;
  /** Lo que el socio ya escribió en el buscador, para no pedírselo de nuevo. */
  nombreInicial?: string;
  onCancelar: () => void;
  onCreado: (alimento: AlimentoCatalogo) => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
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
    try {
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
      if (res.error || !res.alimento) {
        setError(res.error ?? "No fue posible crear el alimento.");
        return;
      }
      onCreado(res.alimento);
    } catch {
      // Sin esto, una acción que rechaza dejaba el botón en "Guardando…" y
      // deshabilitado para siempre, sin mensaje: el socio había llenado el
      // nombre, la porción y los cuatro macros, y perdía todo.
      setError("No se pudo guardar. Revisa tu conexión e intenta nuevamente.");
    } finally {
      setGuardando(false);
    }
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
