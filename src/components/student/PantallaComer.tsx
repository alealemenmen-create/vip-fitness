"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Search, Trash2, X } from "lucide-react";
import { TarjetaMacros } from "@/components/student/TarjetaMacros";
import { BarraPuntosVip } from "@/components/student/BarraPuntosVip";
import { calcularPuntosAlimentacion, siguienteMetaAlimentacion, PUNTOS_VIP } from "@/lib/ranking/reglas";
import {
  HojaAgregarComida,
  type AlimentoElegido,
} from "@/components/student/HojaAgregarComida";
import {
  agregarAlimentoAHora,
  quitarAlimentoDeComida,
  actualizarCantidadAlimento,
  eliminarComida,
} from "@/app/alumno/comer/actions";
import { TiraDias } from "@/components/student/TiraDias";
import { estadoDelDia, horasVacias } from "@/app/alumno/comer/tipos";
import type {
  EstadoDia,
  HoraDia,
  PlanAlimentacion,
  Totales,
} from "@/app/alumno/comer/tipos";

/** Desde el borde de abajo de la pantalla hasta donde puede llegar la lista:
 * el buscador fijo arranca a 100 px del borde y mide 48, más su `pb-2` (8).
 * Si se mueve el buscador, se mueve este número. */
const ALTO_ZONA_INFERIOR = 156;

/** Filas que quedan por ARRIBA de la hora actual al abrir el día de hoy. Con
 * un valor fijo, la hora de ahora aparece siempre en el mismo punto de la
 * pantalla —sean las 8 AM o las 9 PM— y la lista se corre por debajo. */
const FILAS_DE_CONTEXTO = 3;

/**
 * Alto que le queda a la línea de tiempo entre lo que tiene encima (fecha, tira
 * de días, macros) y el buscador fijo de abajo.
 *
 * Se mide en el cliente en vez de fijarlo en el CSS porque lo de arriba no mide
 * siempre igual: cambia con el tamaño de letra del sistema y con la barra del
 * navegador en el celular. `useLayoutEffect` lo resuelve ANTES de pintar, así
 * no se ve el salto de la lista pasando de alta a su alto real.
 */
function useAltoDisponible(ref: React.RefObject<HTMLDivElement | null>) {
  const [alto, setAlto] = useState<number | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const nodo = ref.current;
      if (!nodo) return;

      const caja = nodo.getBoundingClientRect();
      const desdeArriba = caja.top + window.scrollY;

      /**
       * Lo que va DEBAJO de la lista dentro del documento: el `pb-24` del
       * layout, la barra de navegación y —si un entrenador está mirando como
       * alumno— su enlace para volver al panel. No depende del alto de la
       * lista, así que se puede descontar de una.
       *
       * Sin esto la página quedaba con 88 px de scroll propio y bastaba
       * arrastrar un poco para llevarse el encabezado y los macros, que es
       * justo lo que no se quiere.
       */
      const debajo =
        document.documentElement.scrollHeight - (desdeArriba + caja.height);

      // El mínimo evita que en una pantalla muy baja (o con el teclado
      // abierto) la lista quede de un alto inservible.
      setAlto(
        Math.max(
          220,
          Math.min(
            window.innerHeight - desdeArriba - debajo,
            window.innerHeight - desdeArriba - ALTO_ZONA_INFERIOR,
          ),
        ),
      );
    };

    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [ref]);

  return alto;
}

function etiquetaHora(hora: number): string {
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:00 ${hora < 12 ? "AM" : "PM"}`;
}

function sumar(horas: HoraDia[]): Totales {
  return horas.reduce(
    (acc, h) => ({
      kcal: acc.kcal + h.totales.kcal,
      prot: acc.prot + h.totales.prot,
      carb: acc.carb + h.totales.carb,
      grasa: acc.grasa + h.totales.grasa,
    }),
    { kcal: 0, prot: 0, carb: 0, grasa: 0 },
  );
}

function recalcular(horas: HoraDia[]): HoraDia[] {
  return horas.map((h) => ({
    ...h,
    totales: h.comidas.reduce(
      (acc, c) => ({
        kcal: acc.kcal + c.totales.kcal,
        prot: acc.prot + c.totales.prot,
        carb: acc.carb + c.totales.carb,
        grasa: acc.grasa + c.totales.grasa,
      }),
      { kcal: 0, prot: 0, carb: 0, grasa: 0 },
    ),
  }));
}

/**
 * Calorías y macros en una línea, para el detalle desplegado de una comida.
 *
 * Letra chica a propósito: entra al lado de la cantidad sin robarle ancho al
 * nombre del alimento. Los colores son los mismos de la tarjeta de macros de
 * arriba (salen del acento del tema), así "P" siempre es el mismo color en
 * toda la pantalla y no hace falta leer la etiqueta para ubicarse.
 */
function LineaMacros({
  kcal,
  prot,
  carb,
  grasa,
  className = "",
}: Totales & { className?: string }) {
  const macros: [string, number, string][] = [
    ["P", prot, "var(--macro-prot)"],
    ["C", carb, "var(--macro-carb)"],
    ["G", grasa, "var(--macro-grasa)"],
  ];

  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-micro ${className}`}>
      <span className="font-semibold" style={{ color: "var(--macro-cal)" }}>
        {Math.round(kcal)} cal
      </span>
      {macros.map(([letra, valor, color]) => (
        <span key={letra} className="text-text-tertiary">
          <span style={{ color }}>{letra}</span>
          {Math.round(valor)}
        </span>
      ))}
    </span>
  );
}

/** Lo que el plan del entrenador propone para una hora: se muestra como guía
 * en la franja vacía, para que la línea de tiempo diga algo en vez de ser 24
 * filas idénticas. */
export type GuiaPlan = { hora: number; nombre: string; kcal: number | null };

export function PantallaComer({
  fechaInicial,
  registrosServidor,
  rango,
  plan,
  guias,
  soloLectura,
  hoy,
  horaActual,
}: {
  fechaInicial: string;
  /** Toda la ventana de días ya cargada: cambiar de día no pide nada más. */
  registrosServidor: Record<string, HoraDia[]>;
  /** Hasta dónde llega lo precargado; fuera de acá sí hay que ir al servidor. */
  rango: { desde: string; hasta: string };
  plan: PlanAlimentacion;
  guias: GuiaPlan[];
  soloLectura: boolean;
  hoy: string;
  /** Hora de Chile calculada en el servidor — ver `horaActualISO`. */
  horaActual: number;
}) {
  const router = useRouter();
  const [fecha, setFecha] = useState(fechaInicial);
  const [registros, setRegistros] = useState(registrosServidor);
  const [horaAbierta, setHoraAbierta] = useState<number | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El servidor manda la verdad; el estado local solo adelanta lo que el
  // alumno acaba de hacer. Cuando llega data nueva (router.refresh, o una
  // ventana nueva) se reemplaza.
  //
  // El ajuste va en el render y no en un useEffect a propósito: así React
  // vuelve a renderizar antes de pintar, sin el parpadeo de mostrar un cuadro
  // con los datos viejos. La firma evita comparar objetos por identidad, que
  // cambian en cada render del servidor.
  const firmaServidor = useMemo(
    () => JSON.stringify(registrosServidor),
    [registrosServidor],
  );
  const [firmaPrevia, setFirmaPrevia] = useState(firmaServidor);
  if (firmaServidor !== firmaPrevia) {
    setFirmaPrevia(firmaServidor);
    setRegistros(registrosServidor);
    setFecha(fechaInicial);
  }

  // A propósito NO se salta solo a la hora actual al entrar: probado en el
  // celular, esa vista arranca con el encabezado, la tira de días y los macros
  // ya fuera de pantalla, que es justamente lo que el alumno necesita ver
  // primero. La hora de ahora queda igual señalada en ámbar, y el botón de
  // abajo abre directamente esa hora sin tener que buscarla.

  const horas = registros[fecha] ?? horasVacias();
  const esHoy = fecha === hoy;
  const totales = sumar(horas);
  const puntosAlimentacion = calcularPuntosAlimentacion(totales.kcal, plan?.kcalObjetivo ?? null);
  const siguienteMeta = siguienteMetaAlimentacion(puntosAlimentacion);

  const estados = useMemo(() => {
    const m: Record<string, EstadoDia> = {};
    for (const [f, hs] of Object.entries(registros)) m[f] = estadoDelDia(hs);
    return m;
  }, [registros]);

  const contenedorHoras = useRef<HTMLDivElement>(null);
  const altoLista = useAltoDisponible(contenedorHoras);

  /**
   * Deja la hora actual siempre en la misma posición de la lista.
   *
   * Antes se probó desplazando la PÁGINA entera y se descartó: se llevaba
   * puestos el encabezado, la tira de días y los macros. Acá el que se desplaza
   * es solo el contenedor de las horas, así que arriba no se mueve nada.
   *
   * Se cuenta por filas y no por píxeles porque las filas no miden todas igual
   * (una hora con tres comidas es mucho más alta que una vacía).
   */
  useEffect(() => {
    const nodo = contenedorHoras.current;
    if (!nodo || altoLista === null) return;

    if (!esHoy) {
      // Otro día no tiene "ahora": se empieza por el principio.
      nodo.scrollTop = 0;
      return;
    }

    const filas = Array.from(nodo.querySelectorAll<HTMLElement>("[data-hora]"));
    const actual = filas.findIndex((f) => f.dataset.hora === String(horaActual));
    if (actual < 0) return;

    nodo.scrollTop = filas[Math.max(0, actual - FILAS_DE_CONTEXTO)].offsetTop;
    // `expandida` queda fuera a propósito: desplegar una comida no debe mover
    // la lista bajo el dedo.
  }, [fecha, esHoy, horaActual, altoLista]);

  /** Dentro de la ventana precargada el cambio es inmediato; fuera hay que
   * traer la ventana siguiente, y ahí sí se navega. */
  const elegirDia = (nueva: string) => {
    if (nueva === fecha) return;
    if (nueva >= rango.desde && nueva <= rango.hasta) {
      setFecha(nueva);
      setExpandida(null);
      // La URL se corrige a mano y no con el router: `router.push` volvería a
      // pedirle la pantalla al servidor (~300 ms) y justamente eso es lo que
      // se sentía lento. Así el enlace queda bien para recargar o compartir,
      // sin costo.
      window.history.replaceState(null, "", `/alumno/comer/${nueva}`);
      return;
    }
    router.push(`/alumno/comer/${nueva}`, { scroll: false });
  };

  const guiaPorHora = useMemo(() => {
    const m = new Map<number, GuiaPlan>();
    for (const g of guias) if (!m.has(g.hora)) m.set(g.hora, g);
    return m;
  }, [guias]);

  /** Reemplaza las horas del día en curso dentro del mapa de la ventana. */
  const escribirHoras = (
    calcular: (previas: HoraDia[]) => HoraDia[],
    enFecha = fecha
  ) => {
    setRegistros((prev) => ({
      ...prev,
      [enFecha]: recalcular(calcular(prev[enFecha] ?? horasVacias())),
    }));
  };

  /** Alta optimista: la comida aparece al instante y, si el servidor falla, se
   * revierte con un aviso en vez de quedar mostrando algo que no se guardó. */
  const confirmar = async (elegidos: AlimentoElegido[]) => {
    const hora = horaAbierta;
    if (hora === null || elegidos.length === 0) return;

    setHoraAbierta(null);
    setError(null);
    const previo = registros;
    const enFecha = fecha;

    const temporal = `temp-${Date.now()}`;
    const alimentos = elegidos.map((e, i) => {
      const factor = e.cantidadBase / e.alimento.porcionBase;
      return {
        id: `${temporal}-${i}`,
        alimentoId: e.alimento.id,
        nombre: e.alimento.nombre,
        cantidad: e.cantidadBase,
        unidad: e.alimento.unidad,
        kcal: e.alimento.kcal * factor,
        prot: e.alimento.prot * factor,
        carb: e.alimento.carb * factor,
        grasa: e.alimento.grasa * factor,
      };
    });

    escribirHoras(
      (prev) =>
        prev.map((h) =>
          h.hora !== hora
            ? h
            : {
                ...h,
                comidas: [
                  ...h.comidas,
                  {
                    tipoComida: `${String(hora).padStart(2, "0")}:00`,
                    comidaId: temporal,
                    omitida: false,
                    observacion: null,
                    alimentos,
                    totales: alimentos.reduce(
                      (acc, a) => ({
                        kcal: acc.kcal + a.kcal,
                        prot: acc.prot + a.prot,
                        carb: acc.carb + a.carb,
                        grasa: acc.grasa + a.grasa,
                      }),
                      { kcal: 0, prot: 0, carb: 0, grasa: 0 },
                    ),
                  },
                ],
              },
        ),
      enFecha,
    );

    for (const e of elegidos) {
      const res = await agregarAlimentoAHora(
        enFecha,
        hora,
        e.alimento.id,
        e.cantidadBase,
        e.alimento.unidad,
      );
      if (res.error) {
        setRegistros(previo);
        setError(res.error);
        return;
      }
    }
    router.refresh();
  };

  const quitarAlimento = async (alimentoId: string) => {
    const previo = registros;
    const enFecha = fecha;
    escribirHoras(
      (prev) =>
        prev.map((h) => ({
          ...h,
          comidas: h.comidas
            .map((c) => {
              const quedan = c.alimentos.filter((a) => a.id !== alimentoId);
              return {
                ...c,
                alimentos: quedan,
                totales: quedan.reduce(
                  (acc, a) => ({
                    kcal: acc.kcal + a.kcal,
                    prot: acc.prot + a.prot,
                    carb: acc.carb + a.carb,
                    grasa: acc.grasa + a.grasa,
                  }),
                  { kcal: 0, prot: 0, carb: 0, grasa: 0 },
                ),
              };
            })
            .filter((c) => c.alimentos.length > 0 || c.omitida),
        })),
      enFecha,
    );
    try {
      await quitarAlimentoDeComida(alimentoId, enFecha);
      router.refresh();
    } catch {
      setRegistros(previo);
      setError("No fue posible quitar el alimento.");
    }
  };

  const borrarComida = async (comidaId: string) => {
    const previo = registros;
    const enFecha = fecha;
    escribirHoras(
      (prev) =>
        prev.map((h) => ({
          ...h,
          comidas: h.comidas.filter((c) => c.comidaId !== comidaId),
        })),
      enFecha,
    );
    const res = await eliminarComida(comidaId, enFecha);
    if (res.error) {
      setRegistros(previo);
      setError(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Sin fila de fecha: el día elegido ya se ve resaltado en la tira, y el
          acceso al plan se fue a "Mis planes" (el menú de las tres rayitas),
          que es donde vive ahora todo lo que manda el entrenador. */}
      <TiraDias
        seleccionada={fecha}
        onSeleccionar={elegirDia}
        estados={estados}
        hoy={hoy}
      />

      <TarjetaMacros
        kcal={totales.kcal}
        kcalObjetivo={plan?.kcalObjetivo ?? null}
        prot={totales.prot}
        protObjetivo={plan?.protObjetivo ?? null}
        grasa={totales.grasa}
        grasaObjetivo={plan?.grasaObjetivo ?? null}
        carb={totales.carb}
        carbObjetivo={plan?.carbObjetivo ?? null}
      />

      <BarraPuntosVip
        puntos={puntosAlimentacion}
        maximo={PUNTOS_VIP.alimentacionMaximo}
        etiqueta="Puntos de alimentación"
        ayuda={siguienteMeta?.texto ?? "Meta diaria alcanzada: mantente cerca de tus calorías objetivo"}
      />

      {error && (
        <div className="radius-control flex items-start gap-2 border border-error/40 bg-error/10 px-3 py-2">
          <p className="text-caption flex-1 text-error">{error}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setError(null)}
          >
            <X size={14} className="text-error" />
          </button>
        </div>
      )}

      {/* La línea de tiempo scrollea SOLA, no con la página: así la fecha, la
          tira de días y la tarjeta de macros nunca se van de pantalla y las
          horas pasan por debajo. El alto se mide en el cliente (ver
          `useAltoDisponible`) porque depende de cuánto ocupe todo lo de arriba,
          que cambia según el tema y el tamaño de letra del teléfono. */}
      <div
        ref={contenedorHoras}
        style={altoLista ? { height: altoLista } : undefined}
        // `-mb-24` cancela el `pb-24` del layout de /alumno (que existe para
        // que la barra de navegación no tape el final de las otras pantallas).
        // Acá ese hueco sobra —el buscador fijo ya tiene el suyo reservado— y
        // sin cancelarlo la lista terminaba 80 px antes de tiempo.
        className="-mx-1 -mb-24 overflow-y-auto overscroll-contain px-1 pb-2"
      >
        <div className="relative">
          {/* Una sola línea punteada para toda la lista: por fila se cortaría en
            cada borde y se vería a tramos. */}
          {/* Ancho de la cápsula + el gap + medio botón "+". Si cambia
              cualquiera de los tres, hay que recalcular esto o la línea deja
              de pasar por el centro de los botones. */}
          <div
            aria-hidden
            className="linea-horas absolute bottom-6 top-6 w-px"
            style={{ left: "calc(3.75rem + 0.5rem + 1rem)" }}
          />

          {horas.map((h) => {
            const vacia = h.comidas.length === 0;
            const guia = guiaPorHora.get(h.hora);
            return (
              <div
                key={h.hora}
                data-hora={h.hora}
                className="relative flex items-start gap-2 py-1"
              >
                <span
                  className={`radius-control flex h-8 w-[3.75rem] shrink-0 items-center justify-center text-micro font-medium transition-colors duration-200 ${
                    esHoy && h.hora === horaActual
                      ? "bg-surface-2 text-vip"
                      : "bg-surface-2 text-text-tertiary"
                  }`}
                >
                  {etiquetaHora(h.hora)}
                </span>

                <button
                  type="button"
                  aria-label={`Agregar comida a las ${etiquetaHora(h.hora)}`}
                  disabled={soloLectura}
                  onClick={() => setHoraAbierta(h.hora)}
                  // `relative` sin z-index: alcanza para tapar la línea punteada
                  // (que va antes en el DOM). Con z-10 el botón se pintaba
                  // ENCIMA de la barra de navegación al scrollear.
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-transform duration-150 active:scale-90 disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>

                <div className="min-w-0 flex-1">
                  {vacia ? (
                    <button
                      type="button"
                      disabled={soloLectura}
                      onClick={() => setHoraAbierta(h.hora)}
                      className="flex min-h-8 w-full items-center gap-2 text-left disabled:opacity-40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-caption text-text-tertiary">
                          {guia ? guia.nombre : "Agregar comida"}
                        </span>
                        {guia && (
                          <span className="block truncate text-micro text-text-tertiary/70">
                            Según tu plan
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-micro text-text-tertiary">
                        {guia?.kcal != null ? `meta ${guia.kcal} cal` : "0 cal"}
                      </span>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-text-tertiary"
                      />
                    </button>
                  ) : (
                    <div className="space-y-1">
                      {h.comidas.map((c) => {
                        const abierta = expandida === c.comidaId;
                        return (
                          <div
                            key={c.comidaId}
                            className="comida-entrando radius-control border border-border bg-surface"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandida(abierta ? null : c.comidaId)
                              }
                              className="flex min-h-8 w-full items-center gap-2 px-2.5 py-1.5 text-left"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-caption leading-tight text-text">
                                  {c.alimentos[0]?.nombre ?? "Comida"}
                                </span>
                                {c.alimentos.length > 1 && (
                                  <span className="text-micro text-text-tertiary">
                                    +{c.alimentos.length - 1} más
                                  </span>
                                )}
                              </span>
                              <span
                                className="shrink-0 text-micro font-semibold"
                                style={{ color: "var(--macro-cal)" }}
                              >
                                {Math.round(c.totales.kcal)} cal
                              </span>
                              <ChevronRight
                                size={14}
                                className={`shrink-0 text-text-tertiary transition-transform duration-200 ${
                                  abierta ? "rotate-90" : ""
                                }`}
                              />
                            </button>

                            {abierta && (
                              <div className="space-y-1.5 border-t border-border px-2 py-2">
                                {/* Total de la comida: el encabezado plegado
                                    solo muestra las calorías, y estando abierto
                                    interesa el reparto de macros. */}
                                <div className="flex items-center gap-2 px-0.5">
                                  <span className="text-micro uppercase tracking-wide text-text-tertiary">
                                    Total
                                  </span>
                                  <LineaMacros
                                    kcal={c.totales.kcal}
                                    prot={c.totales.prot}
                                    carb={c.totales.carb}
                                    grasa={c.totales.grasa}
                                    className="ml-auto"
                                  />
                                </div>

                                {c.alimentos.map((a) => (
                                  <div
                                    key={a.id}
                                    className="radius-control bg-surface-2/60 px-2 py-1.5"
                                  >
                                    {/* El nombre va en su propia línea y SIN
                                        truncar: compartiendo fila con la
                                        cantidad quedaba cortado a la mitad. */}
                                    <div className="flex items-start gap-1">
                                      <span className="min-w-0 flex-1 text-micro leading-snug text-text">
                                        {a.nombre}
                                      </span>
                                      {!soloLectura && (
                                        <button
                                          type="button"
                                          aria-label={`Quitar ${a.nombre}`}
                                          onClick={() => quitarAlimento(a.id)}
                                          className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full active:scale-90"
                                        >
                                          <X size={13} className="text-error" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="mt-1 flex items-center gap-1.5">
                                      <input
                                        type="number"
                                        min="1"
                                        inputMode="decimal"
                                        aria-label={`Cantidad de ${a.nombre} en ${a.unidad}`}
                                        defaultValue={a.cantidad}
                                        disabled={soloLectura}
                                        onBlur={(e) => {
                                          const v = Number(e.target.value);
                                          if (v !== a.cantidad && v > 0) {
                                            actualizarCantidadAlimento(
                                              a.id,
                                              v,
                                              fecha,
                                            ).then(() => router.refresh());
                                          }
                                        }}
                                        className="radius-control w-14 shrink-0 border border-border bg-surface px-1.5 py-0.5 text-micro text-text outline-none focus:border-vip disabled:opacity-70"
                                      />
                                      <span className="shrink-0 text-micro text-text-tertiary">
                                        {a.unidad}
                                      </span>
                                      <LineaMacros
                                        kcal={a.kcal}
                                        prot={a.prot}
                                        carb={a.carb}
                                        grasa={a.grasa}
                                        className="ml-auto"
                                      />
                                    </div>
                                  </div>
                                ))}

                                {!soloLectura && c.comidaId && (
                                  <button
                                    type="button"
                                    onClick={() => borrarComida(c.comidaId!)}
                                    className="flex min-h-8 items-center gap-1.5 px-0.5 text-micro text-error"
                                  >
                                    <Trash2 size={12} /> Eliminar la comida
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Buscador fijo: va sobre la barra de navegación (que mide 74 px) y no se
          mueve al desplazar la línea de tiempo. Los 26 px extra lo despegan de
          los íconos, que quedaban casi pegados. Si se cambia esta distancia,
          hay que mover también `ALTO_ZONA_INFERIOR` o la lista de horas se
          mete por debajo del buscador. */}
      {!soloLectura && (
        <div className="fixed inset-x-0 bottom-[100px] z-30 mx-auto w-full max-w-md px-4 pb-2">
          <button
            type="button"
            onClick={() => setHoraAbierta(horaActual)}
            className="radius-control flex h-12 w-full items-center gap-2 border border-border bg-surface px-4 text-left shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] transition-transform duration-150 active:scale-[0.99]"
          >
            <Search size={16} className="shrink-0 text-text-secondary" />
            <span className="text-secondary flex-1 text-text-tertiary">
              Buscar alimentos
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2">
              <Plus size={15} className="text-vip" />
            </span>
          </button>
        </div>
      )}

      <HojaAgregarComida
        hora={horaAbierta}
        onCerrar={() => setHoraAbierta(null)}
        onConfirmar={confirmar}
      />
    </div>
  );
}
