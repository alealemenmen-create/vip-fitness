"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HojaAgregarComida, type AlimentoElegido } from "@/components/student/HojaAgregarComida";
import { agregarAlimentoAHora, actualizarCantidadAlimento, quitarAlimentoDeComida } from "@/app/alumno/comer/actions";
import { buscarEnOFFAction, buscarPorCodigoOFFAction } from "@/app/alumno/comer/actions";
import { guardarMisMacros } from "@/app/alumno/macros/actions";
import type { HoraDia, PlanAlimentacion } from "@/app/alumno/comer/tipos";
import type { ProductoOFF } from "@/lib/alimentos/openFoodFacts";
import { errorMetasNutricionales } from "@/lib/alimentos/metasNutricionales";
import { resumirMicronutrientes, sodioGramosAMiligramos, type ResumenMicronutrientes } from "@/lib/alimentos/resumenMicronutrientes";
import { puedeRegistrarComidaEnFecha } from "@/lib/alimentos/ventanaRegistro";
import {
  Beef,
  ChevronRight,
  Copy,
  Droplet,
  Flame,
  LayoutGrid,
  Leaf,
  PieChart,
  Plus,
  ScanLine,
  Search,
  X,
} from "lucide-react";
import styles from "./PortalV2.module.css";

function fechaChileISO() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Santiago",
  }).formatToParts(new Date());
  const valor = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valor.year}-${valor.month}-${valor.day}`;
}

function diasNutricionDemo(fechaCentral: string) {
  const etiquetas = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const central = new Date(`${fechaCentral}T12:00:00`);
  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(central);
    fecha.setDate(fecha.getDate() + indice - 3);
    const iso = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    return { dia: etiquetas[fecha.getDay()], numero: fecha.getDate(), fecha: iso };
  });
}

function etiquetaHora(hora: number) {
  if (hora === 0) return "12 AM";
  if (hora === 12) return "12 PM";
  return hora < 12 ? `${hora} AM` : `${hora - 12} PM`;
}

function horaActualChile() {
  const hora = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Santiago",
  }).format(new Date());
  return Number(hora);
}

const HORAS = Array.from({ length: 24 }, (_, hora) => ({ hora, etiqueta: etiquetaHora(hora) }));

const ALIMENTOS = [
  { nombre: "Pan blanco", marca: "Bimbo", detalle: "120 cal · 3 p · 26 c · 1 g", kcal: 120, prot: 3, carb: 26, grasa: 1 },
  { nombre: "Queso fresco", marca: "VIP Selection", detalle: "120 cal · 6 p · 5 c · 9 g", kcal: 120, prot: 6, carb: 5, grasa: 9 },
  { nombre: "Salsa de tomate", marca: "Natural", detalle: "15 cal · 1 p · 4 c · 0 g", kcal: 15, prot: 1, carb: 4, grasa: 0 },
  { nombre: "Yogur alto en proteína", marca: "VIP Selection", detalle: "145 cal · 15 p · 12 c · 3 g", kcal: 145, prot: 15, carb: 12, grasa: 3 },
];

function alimentoVisualDesdeOFF(producto: ProductoOFF): (typeof ALIMENTOS)[number] {
  return {
    nombre: producto.nombre,
    marca: producto.marca ?? "Open Food Facts",
    detalle: `${Math.round(producto.kcal)} cal · ${Math.round(producto.prot)} p · ${Math.round(producto.carb)} c · ${Math.round(producto.grasa)} g / 100 g`,
    kcal: producto.kcal,
    prot: producto.prot,
    carb: producto.carb,
    grasa: producto.grasa,
  };
}

export type NutricionDatosV2 = {
  fechaInicial: string;
  dias: { dia: string; numero: number; fecha: string }[];
  registros: Record<string, HoraDia[]>;
  plan: PlanAlimentacion;
  horaActual: number;
  soloLectura: boolean;
};

type ComidaVisual = (typeof ALIMENTOS)[number] & {
  fecha: string;
  hora: number;
  alimentoId?: string;
  cantidad?: number;
  unidad?: string;
  consumidoId?: string;
  fibra?: number | null;
  azucares?: number | null;
  sodio?: number | null;
};

function comidasDesdeRegistros(registros: Record<string, HoraDia[]>): ComidaVisual[] {
  return Object.entries(registros).flatMap(([fecha, horas]) => horas.flatMap((franja) =>
    franja.comidas.flatMap((comida) => comida.alimentos.map((alimento) => ({
      nombre: alimento.nombre,
      marca: `${Math.round(alimento.cantidad * 10) / 10} ${alimento.unidad}`,
      detalle: `${Math.round(alimento.kcal)} cal · ${Math.round(alimento.prot)} p · ${Math.round(alimento.carb)} c · ${Math.round(alimento.grasa)} g`,
      kcal: alimento.kcal,
      prot: alimento.prot,
      carb: alimento.carb,
      grasa: alimento.grasa,
      fibra: alimento.fibra,
      azucares: alimento.azucares,
      sodio: alimento.sodio,
      fecha,
      hora: franja.hora,
      alimentoId: alimento.alimentoId,
      consumidoId: alimento.id,
      cantidad: alimento.cantidad,
      unidad: alimento.unidad,
    })))
  ));
}

const OBJETIVOS_NUTRICION = [
  { nombre: "Definición", kcal: 2146, prot: 215, carb: 178, grasa: 64 },
  { nombre: "Mantenimiento", kcal: 2446, prot: 220, carb: 225, grasa: 74 },
  { nombre: "Volumen controlado", kcal: 2846, prot: 232, carb: 239, grasa: 106 },
];

type PanelNutricion = "resumen" | "buscar" | "macros" | "escaner" | "copiar" | null;
type OperacionNutricion = "copiar" | "cantidad" | "eliminar" | null;

export function NutricionV2({ datos }: { datos?: NutricionDatosV2 }) {
  const fechaDemo = useMemo(() => fechaChileISO(), []);
  const diasNutricion = useMemo(() => datos?.dias ?? diasNutricionDemo(fechaDemo), [datos?.dias, fechaDemo]);
  const [horaActual] = useState(() => datos?.horaActual ?? horaActualChile());
  const [fechaActiva, setFechaActiva] = useState(datos?.fechaInicial ?? fechaDemo);
  const [panel, setPanel] = useState<PanelNutricion>(null);
  const [horaSeleccionada, setHoraSeleccionada] = useState(horaActual);
  const [comidas, setComidas] = useState<ComidaVisual[]>(() => datos
    ? comidasDesdeRegistros(datos.registros)
    : [{ ...ALIMENTOS[0], fecha: fechaDemo, hora: horaActual }]);
  const [aviso, setAviso] = useState("");
  const [operacion, setOperacion] = useState<OperacionNutricion>(null);
  const operacionRef = useRef(false);
  const [comidaSeleccionada, setComidaSeleccionada] = useState<ComidaVisual | null>(null);
  const [cantidadBorrador, setCantidadBorrador] = useState("");
  const [objetivosLocales, setObjetivosLocales] = useState(() => ({
    kcal: datos?.plan?.kcalObjetivo ?? 2846,
    prot: datos?.plan?.protObjetivo ?? 232,
    carb: datos?.plan?.carbObjetivo ?? 239,
    grasa: datos?.plan?.grasaObjetivo ?? 106,
  }));
  const [colapsoSemana, setColapsoSemana] = useState(0);
  const lineaTiempoRef = useRef<HTMLElement>(null);
  const inicioScrollRef = useRef(0);

  useEffect(() => {
    const lineaTiempo = lineaTiempoRef.current;
    if (!lineaTiempo) return;
    if (fechaActiva !== (datos?.fechaInicial ?? fechaDemo)) {
      lineaTiempo.scrollTop = 0;
      inicioScrollRef.current = 0;
      return;
    }
    const filaActual = lineaTiempo.querySelector<HTMLElement>(`[data-hora="${horaActual}"]`);
    if (!filaActual) return;
    const inicio = Math.max(0, filaActual.offsetTop - 3 * 71);
    lineaTiempo.scrollTop = inicio;
    inicioScrollRef.current = inicio;
  }, [datos?.fechaInicial, fechaActiva, fechaDemo, horaActual]);

  const totales = useMemo(() => comidas
    .filter((comida) => comida.fecha === fechaActiva)
    .reduce((acumulado, comida) => ({
      kcal: acumulado.kcal + comida.kcal,
      prot: acumulado.prot + comida.prot,
      carb: acumulado.carb + comida.carb,
      grasa: acumulado.grasa + comida.grasa,
    }), { kcal: 0, prot: 0, carb: 0, grasa: 0 }), [comidas, fechaActiva]);
  const objetivos = objetivosLocales;
  const fechaPermiteRegistrar = !datos || puedeRegistrarComidaEnFecha({
    fecha: fechaActiva,
    fechaHoy: datos.fechaInicial,
    fechasConRegistro: Object.keys(datos.registros),
  });
  const micronutrientes = useMemo(
    () => resumirMicronutrientes(comidas.filter((comida) => comida.fecha === fechaActiva)),
    [comidas, fechaActiva],
  );
  const porcentaje = (valor: number, objetivo: number) => objetivo > 0
    ? Math.min(100, (valor / objetivo) * 100)
    : 0;

  const manejarScrollHoras = (evento: React.UIEvent<HTMLElement>) => {
    const recorrido = Math.max(0, evento.currentTarget.scrollTop - inicioScrollRef.current);
    const siguiente = Math.min(1, recorrido / 52);
    setColapsoSemana((actual) => Math.abs(actual - siguiente) > 0.015 ? siguiente : actual);
  };

  const agregarComida = (alimento: (typeof ALIMENTOS)[number]) => {
    setComidas((actuales) => [...actuales, { ...alimento, fecha: fechaActiva, hora: horaSeleccionada }]);
    setPanel(null);
    setAviso(`${alimento.nombre} fue añadido a las ${etiquetaHora(horaSeleccionada)}`);
  };

  const copiarComida = async (seleccion?: ComidaVisual) => {
    if (operacionRef.current) return;
    if (!fechaPermiteRegistrar) {
      setPanel(null);
      setAviso("Solo puedes registrar comida de hoy, de ayer o continuar un día que ya tenga registros");
      return;
    }
    if (datos?.soloLectura) {
      setAviso("Esta cuenta está abierta en modo solo lectura");
      return;
    }
    const origen = seleccion ?? [...comidas].reverse().find((comida) => comida.fecha === fechaActiva);
    if (!origen) {
      setAviso("Todavía no hay una comida para copiar en este día");
      return;
    }
    operacionRef.current = true;
    setOperacion("copiar");
    try {
      let consumidoId = origen.consumidoId;
      if (datos && origen.alimentoId && origen.cantidad && origen.unidad) {
        const resultado = await agregarAlimentoAHora(fechaActiva, horaActual, origen.alimentoId, origen.cantidad, origen.unidad);
        if (resultado.error) {
          setAviso(resultado.error);
          return;
        }
        consumidoId = resultado.consumidoId;
      }
      setComidas((actuales) => [...actuales, { ...origen, fecha: fechaActiva, hora: horaActual, consumidoId }]);
      setPanel(null);
      setAviso("Comida copiada correctamente");
    } catch {
      setAviso("No pudimos copiar la comida. Revisa tu conexión e intenta nuevamente.");
    } finally {
      operacionRef.current = false;
      setOperacion(null);
    }
  };

  const abrirPanel = (siguiente: Exclude<PanelNutricion, null>, hora = horaActual) => {
    if (datos?.soloLectura && (siguiente === "buscar" || siguiente === "escaner" || siguiente === "macros")) {
      setAviso("Esta cuenta está abierta en modo solo lectura");
      return;
    }
    if (!fechaPermiteRegistrar && (siguiente === "buscar" || siguiente === "escaner" || siguiente === "copiar")) {
      setAviso("Solo puedes registrar comida de hoy, de ayer o continuar un día que ya tenga registros");
      return;
    }
    setHoraSeleccionada(hora);
    setAviso("");
    setPanel(siguiente);
  };

  const elegirDia = (fecha: string) => {
    setColapsoSemana(0);
    setFechaActiva(fecha);
  };

  const confirmarAlimentosReales = async (elegidos: AlimentoElegido[]) => {
    if (elegidos.length === 0) return;
    if (!fechaPermiteRegistrar) {
      setAviso("La fecha seleccionada ya no admite registros nuevos");
      return;
    }
    setPanel(null);
    setAviso("Guardando alimentos…");
    let guardados = 0;
    try {
      for (const elegido of elegidos) {
        const resultado = await agregarAlimentoAHora(
          fechaActiva,
          horaSeleccionada,
          elegido.alimento.id,
          elegido.cantidadBase,
          elegido.alimento.unidad,
        );
        if (resultado.error) {
          setAviso(guardados > 0 ? `${resultado.error} Se guardaron ${guardados} alimentos.` : resultado.error);
          return;
        }
        const factor = elegido.alimento.porcionBase > 0 ? elegido.cantidadBase / elegido.alimento.porcionBase : 0;
        setComidas((actuales) => [...actuales, {
          nombre: elegido.alimento.nombre,
          marca: `${Math.round(elegido.cantidadBase * 10) / 10} ${elegido.alimento.unidad}`,
          detalle: `${Math.round(elegido.alimento.kcal * factor)} cal · ${Math.round(elegido.alimento.prot * factor)} p · ${Math.round(elegido.alimento.carb * factor)} c · ${Math.round(elegido.alimento.grasa * factor)} g`,
          kcal: elegido.alimento.kcal * factor,
          prot: elegido.alimento.prot * factor,
          carb: elegido.alimento.carb * factor,
          grasa: elegido.alimento.grasa * factor,
          fibra: elegido.alimento.fibra === null ? null : elegido.alimento.fibra * factor,
          azucares: elegido.alimento.azucares === null ? null : elegido.alimento.azucares * factor,
          sodio: elegido.alimento.sodio === null ? null : elegido.alimento.sodio * factor,
          alimentoId: elegido.alimento.id,
          consumidoId: resultado.consumidoId,
          cantidad: elegido.cantidadBase,
          unidad: elegido.alimento.unidad,
          fecha: fechaActiva,
          hora: horaSeleccionada,
        }]);
        guardados += 1;
      }
      setAviso(`${guardados} ${guardados === 1 ? "alimento agregado" : "alimentos agregados"}`);
    } catch {
      setAviso(guardados > 0
        ? `Se guardaron ${guardados} alimentos antes de perder la conexión. Reintenta los restantes.`
        : "No pudimos guardar los alimentos. Revisa tu conexión e intenta nuevamente.");
    }
  };

  const abrirOpcionesComida = (comida: ComidaVisual) => {
    setComidaSeleccionada(comida);
    setCantidadBorrador(String(comida.cantidad ?? 100));
  };

  const guardarCantidad = async () => {
    if (!comidaSeleccionada || operacionRef.current) return;
    const cantidad = Number(cantidadBorrador.replace(",", "."));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      setAviso("Ingresa una cantidad válida");
      return;
    }
    operacionRef.current = true;
    setOperacion("cantidad");
    try {
      if (datos && comidaSeleccionada.consumidoId) {
        const resultado = await actualizarCantidadAlimento(comidaSeleccionada.consumidoId, cantidad, comidaSeleccionada.fecha);
        if (resultado.error) { setAviso(resultado.error); return; }
      }
      const anterior = comidaSeleccionada.cantidad ?? 100;
      const factor = cantidad / Math.max(anterior, 0.0001);
      setComidas((actuales) => actuales.map((comida) => comida === comidaSeleccionada ? {
        ...comida,
        cantidad,
        marca: `${Math.round(cantidad * 10) / 10} ${comida.unidad ?? "g"}`,
        kcal: comida.kcal * factor,
        prot: comida.prot * factor,
        carb: comida.carb * factor,
        grasa: comida.grasa * factor,
        fibra: comida.fibra === null || comida.fibra === undefined ? comida.fibra : comida.fibra * factor,
        azucares: comida.azucares === null || comida.azucares === undefined ? comida.azucares : comida.azucares * factor,
        sodio: comida.sodio === null || comida.sodio === undefined ? comida.sodio : comida.sodio * factor,
        detalle: `${Math.round(comida.kcal * factor)} cal · ${Math.round(comida.prot * factor)} p · ${Math.round(comida.carb * factor)} c · ${Math.round(comida.grasa * factor)} g`,
      } : comida));
      setComidaSeleccionada(null);
      setAviso("Cantidad actualizada");
    } catch {
      setAviso("No pudimos actualizar la cantidad. El registro anterior se conserva.");
    } finally {
      operacionRef.current = false;
      setOperacion(null);
    }
  };

  const quitarComida = async () => {
    if (!comidaSeleccionada || operacionRef.current) return;
    operacionRef.current = true;
    setOperacion("eliminar");
    try {
      if (datos && comidaSeleccionada.consumidoId) {
        const resultado = await quitarAlimentoDeComida(comidaSeleccionada.consumidoId, comidaSeleccionada.fecha);
        if (resultado.error) { setAviso(resultado.error); return; }
      }
      setComidas((actuales) => actuales.filter((comida) => comida !== comidaSeleccionada));
      setComidaSeleccionada(null);
      setAviso("Alimento eliminado del registro");
    } catch {
      setAviso("No pudimos eliminar el alimento. El registro se conserva.");
    } finally {
      operacionRef.current = false;
      setOperacion(null);
    }
  };

  const fechaTitulo = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" })
    .format(new Date(`${fechaActiva}T12:00:00`));

  return (
    <div className={styles.nutritionPage}>
      <header className={styles.nutritionHeader}>
        <button type="button" className={styles.nutritionDateTitle} onClick={() => abrirPanel("resumen")}>
          {fechaTitulo} <ChevronRight size={17} />
        </button>

        <div
          className={styles.nutritionDays}
          aria-label="Semana de nutrición"
          aria-hidden={colapsoSemana > 0.98}
          style={{
            height: `${31 * (1 - colapsoSemana)}px`,
            marginTop: `${6 * (1 - colapsoSemana)}px`,
            marginBottom: `${6 * (1 - colapsoSemana)}px`,
            opacity: 1 - colapsoSemana,
            transform: `translateY(${-5 * colapsoSemana}px)`,
          }}
        >
          {diasNutricion.map((dia) => (
            <button type="button" tabIndex={colapsoSemana > 0.98 ? -1 : 0} key={dia.fecha} className={dia.fecha === fechaActiva ? styles.nutritionDayActive : ""} onClick={() => elegirDia(dia.fecha)} aria-pressed={dia.fecha === fechaActiva}>
              <span>{dia.dia}</span><strong>{dia.numero}</strong>
            </button>
          ))}
        </div>

        <button type="button" className={styles.macroStrip} onClick={() => abrirPanel("resumen")} aria-label="Abrir resumen nutricional">
          <MacroCompacto icon={<Flame size={14} fill="currentColor" />} consumido={String(Math.round(totales.kcal))} objetivo={String(objetivos.kcal)} progreso={porcentaje(totales.kcal, objetivos.kcal)} />
          <MacroCompacto nombre="P" consumido={String(Math.round(totales.prot))} objetivo={String(objetivos.prot)} progreso={porcentaje(totales.prot, objetivos.prot)} />
          <MacroCompacto nombre="C" consumido={String(Math.round(totales.carb))} objetivo={String(objetivos.carb)} progreso={porcentaje(totales.carb, objetivos.carb)} />
          <MacroCompacto nombre="G" consumido={String(Math.round(totales.grasa))} objetivo={String(objetivos.grasa)} progreso={porcentaje(totales.grasa, objetivos.grasa)} />
        </button>
      </header>

      <section ref={lineaTiempoRef} className={styles.nutritionTimeline} aria-label="Registro diario de comidas" onScroll={manejarScrollHoras}>
        {HORAS.map(({ hora, etiqueta }) => {
          const comidasDeLaHora = comidas.filter((comida) => comida.fecha === fechaActiva && comida.hora === hora);
          const esAhora = fechaActiva === (datos?.fechaInicial ?? fechaDemo) && hora === horaActual;
          return (
          <div className={styles.nutritionTimeRow} key={hora} data-hora={hora}>
            <span className={`${styles.timePill} ${esAhora ? styles.timePillActive : ""}`}>{etiqueta}{esAhora ? <small>Ahora</small> : null}</span>
            <button type="button" className={styles.timeAdd} onClick={() => abrirPanel("buscar", hora)} aria-label={`Agregar comida a las ${etiqueta}`} title={!fechaPermiteRegistrar ? "Disponible para hoy, ayer o un día que ya tenga registros" : undefined}><Plus size={17} /></button>
            {comidasDeLaHora.length > 0 ? (
              <div className={styles.loggedMeals}>
                {comidasDeLaHora.map((comida, comidaIndice) => (
                  <article className={styles.loggedMeal} key={`${comida.nombre}-${comidaIndice}`}>
                    <div><strong>{comida.nombre}</strong><span>{comida.marca}</span><p>{comida.detalle}</p></div><button type="button" onClick={() => abrirOpcionesComida(comida)} aria-label={`Opciones de ${comida.nombre}`}>•••</button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
          );
        })}
      </section>

      <div className={styles.nutritionQuickBar} aria-label="Accesos rápidos de nutrición">
        <button type="button" onClick={() => abrirPanel("buscar")}><Search size={14} />Buscar</button>
        <button type="button" onClick={() => abrirPanel("escaner")}><ScanLine size={14} />Escanear</button>
        <button type="button" onClick={() => abrirPanel("macros")}><LayoutGrid size={14} />Calcular</button>
        <button type="button" onClick={() => abrirPanel("copiar")}><Copy size={14} />Copiar</button>
      </div>

      {aviso ? <button type="button" className={styles.nutritionToast} onClick={() => setAviso("")}><span>{aviso}</span><X size={14} /></button> : null}
      {panel === "resumen" ? <ResumenNutricional totales={totales} objetivos={objetivos} micronutrientes={micronutrientes} reales={Boolean(datos)} onClose={() => setPanel(null)} onAdjust={() => setPanel("macros")} /> : null}
      {panel === "buscar" && !datos ? <BuscarAlimento onClose={() => setPanel(null)} onScan={() => setPanel("escaner")} onAdd={agregarComida} /> : null}
      {panel === "macros" ? <AjustarMacros objetivos={objetivos} real={Boolean(datos)} onClose={() => setPanel(null)} onApply={(nuevos) => { setObjetivosLocales(nuevos); setPanel(null); setAviso("Objetivos nutricionales actualizados"); }} /> : null}
      {panel === "copiar" ? <CopiarAlimentos comidas={comidas} copiando={operacion === "copiar"} onClose={() => setPanel(null)} onCopy={copiarComida} /> : null}
      {panel === "escaner" && !datos ? <EscanerNutricional onClose={() => setPanel(null)} onAdd={agregarComida} /> : null}
      {datos ? <HojaAgregarComida hora={panel === "buscar" || panel === "escaner" ? horaSeleccionada : null} modoInicial={panel === "escaner" ? "escanear" : "buscar"} bibliotecaV2 onCerrar={() => setPanel(null)} onConfirmar={confirmarAlimentosReales} /> : null}
      {comidaSeleccionada ? (
        <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={() => setComidaSeleccionada(null)}>
          <section className={`${styles.nutritionPanel} ${styles.foodOptionsPanel}`} role="dialog" aria-modal="true" aria-busy={operacion !== null} aria-label={`Editar ${comidaSeleccionada.nombre}`} onClick={(evento) => evento.stopPropagation()}>
            <header><button type="button" onClick={() => setComidaSeleccionada(null)} aria-label="Cerrar"><X size={19} /></button></header>
            <h2>{comidaSeleccionada.nombre}</h2>
            <label><span>Cantidad ({comidaSeleccionada.unidad ?? "g"})</span><input inputMode="decimal" value={cantidadBorrador} onChange={(evento) => setCantidadBorrador(evento.target.value)} autoFocus /></label>
            <button type="button" className={styles.macroApplyButton} disabled={operacion !== null} onClick={guardarCantidad}>{operacion === "cantidad" ? "Guardando…" : "Guardar cantidad"}</button>
            <button type="button" className={styles.foodDeleteButton} disabled={operacion !== null} onClick={quitarComida}>{operacion === "eliminar" ? "Eliminando…" : "Eliminar del registro"}</button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MacroCompacto({ nombre, icon, consumido, objetivo, progreso }: { nombre?: string; icon?: React.ReactNode; consumido: string; objetivo: string; progreso: number }) {
  return (
    <span className={styles.macroCompact}>
      <span><b>{icon ?? nombre}</b><small><strong>{consumido}</strong> / {objetivo}</small></span>
      <i><em style={{ width: `${progreso}%` }} /></i>
    </span>
  );
}

function CopiarAlimentos({ comidas, copiando, onClose, onCopy }: { comidas: ComidaVisual[]; copiando: boolean; onClose: () => void; onCopy: (comida: ComidaVisual) => void }) {
  const recientes = [...comidas].reverse().slice(0, 12);
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={`${styles.nutritionPanel} ${styles.foodSearchPanel}`} role="dialog" aria-modal="true" aria-busy={copiando} aria-label="Copiar alimentos" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></header>
        <h2>Copiar alimentos</h2>
        <p className={styles.copyFoodsIntro}>Elige un registro reciente. Se copiará a la hora actual conservando su cantidad real.</p>
        <div className={styles.copyFoodsList}>
          {recientes.length ? recientes.map((comida, indice) => (
            <button type="button" disabled={copiando} key={`${comida.fecha}-${comida.hora}-${comida.nombre}-${indice}`} onClick={() => onCopy(comida)}>
              <span><strong>{comida.nombre}</strong><small>{comida.fecha} · {etiquetaHora(comida.hora)}</small></span><b>{copiando ? "Copiando…" : `${Math.round(comida.kcal)} cal`}</b><Plus size={17} />
            </button>
          )) : <p>No hay alimentos recientes para copiar.</p>}
        </div>
      </section>
    </div>
  );
}

type TotalesNutricionV2 = { kcal: number; prot: number; carb: number; grasa: number };

function ResumenNutricional({
  onClose,
  onAdjust,
  totales,
  objetivos,
  micronutrientes,
  reales,
}: {
  onClose: () => void;
  onAdjust: () => void;
  totales: TotalesNutricionV2;
  objetivos: TotalesNutricionV2;
  micronutrientes: ResumenMicronutrientes;
  reales: boolean;
}) {
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label="Resumen nutricional" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar resumen"><X size={19} /></button><button type="button" className={styles.adjustMacros} onClick={onAdjust}><PieChart size={14} />Ajustar macros</button></header>
        <h2>Resumen nutricional</h2>
        <ResumenMacrosAnimado totales={totales} objetivos={objetivos} />
        <div className={styles.nutrientHeading}><h3>Distribución de nutrientes</h3><span>{reales ? "Cantidad · cobertura" : "g  %"}</span></div>
        <div className={styles.nutrientRows}>{reales
          ? <MicronutrientesReales resumen={micronutrientes} />
          : <><span><b>Fibra</b><em>3 / 38 g</em></span><span><b>Azúcar</b><em>7 / 36 g</em></span><span><b>Colesterol</b><em>30 / 300 mg</em></span><span><b>Sodio</b><em>920 / 1500 mg</em></span></>
        }</div>
        {!reales ? <><div className={styles.nutrientHeading}><h3>Micronutrientes</h3><span>g&nbsp;&nbsp;%</span></div><div className={styles.nutrientRows}>
          <span><b>Vitamina A</b><em>0 / 900 mcg</em></span><span><b>Vitamina D</b><em>0 / 15 mcg</em></span><span><b>Vitamina C</b><em>0 / 90 mg</em></span><span><b>Hierro</b><em>0 / 8 mg</em></span><span><b>Potasio</b><em>0 / 3400 mg</em></span>
        </div></> : null}
      </section>
    </div>
  );
}

function MicronutrientesReales({ resumen }: { resumen: ResumenMicronutrientes }) {
  if (resumen.totalAlimentos === 0) {
    return <span><b>Sin alimentos registrados</b><em>Agrega un alimento para ver sus nutrientes.</em></span>;
  }

  const filas = [
    { nombre: "Fibra", unidad: "g", dato: resumen.fibra, convertir: (valor: number) => Math.round(valor * 10) / 10 },
    { nombre: "Azúcares", unidad: "g", dato: resumen.azucares, convertir: (valor: number) => Math.round(valor * 10) / 10 },
    { nombre: "Sodio", unidad: "mg", dato: resumen.sodio, convertir: sodioGramosAMiligramos },
  ];

  return <>{filas.map(({ nombre, unidad, dato, convertir }) => (
    <span key={nombre}>
      <b>{nombre}</b>
      <em>{dato.total === null
        ? "Sin dato en las etiquetas"
        : `${convertir(dato.total)} ${unidad} · ${dato.conDatos}/${resumen.totalAlimentos} con datos`}</em>
    </span>
  ))}</>;
}

function AjustarMacros({
  onClose,
  onApply,
  objetivos,
  real,
}: {
  onClose: () => void;
  onApply: (objetivos: TotalesNutricionV2) => void;
  objetivos: TotalesNutricionV2;
  real: boolean;
}) {
  const [objetivo, setObjetivo] = useState(() =>
    OBJETIVOS_NUTRICION.find((opcion) =>
      opcion.kcal === objetivos.kcal &&
      opcion.prot === objetivos.prot &&
      opcion.carb === objetivos.carb &&
      opcion.grasa === objetivos.grasa
    )?.nombre ?? ""
  );
  const [valores, setValores] = useState(() => ({ ...objetivos }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aplicar = async () => {
    setError(null);
    const errorValores = errorMetasNutricionales(valores);
    if (errorValores) {
      setError(errorValores);
      return;
    }
    setGuardando(true);
    try {
      if (real) {
        const formData = new FormData();
        formData.set("kcal_objetivo", String(Math.round(valores.kcal)));
        formData.set("prot_objetivo", String(Math.round(valores.prot)));
        formData.set("carb_objetivo", String(Math.round(valores.carb)));
        formData.set("grasa_objetivo", String(Math.round(valores.grasa)));
        const resultado = await guardarMisMacros({ error: null, ok: false }, formData);
        if (!resultado.ok) {
          setError(resultado.error);
          return;
        }
      }
      onApply(valores);
    } catch {
      setError("No pudimos guardar tus objetivos. Los valores anteriores se conservan.");
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={`${styles.nutritionPanel} ${styles.macroAdjustPanel}`} role="dialog" aria-modal="true" aria-label="Ajustar objetivos nutricionales" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar ajuste de macros"><X size={19} /></button><span>Vista personalizada</span></header>
        <h2>Ajustar macros</h2>
        <p>Elige el objetivo que mejor representa tu etapa actual.</p>
        <div className={styles.goalOptions}>
          {OBJETIVOS_NUTRICION.map((opcion) => (
            <button type="button" key={opcion.nombre} onClick={() => { setObjetivo(opcion.nombre); setValores({ kcal: opcion.kcal, prot: opcion.prot, carb: opcion.carb, grasa: opcion.grasa }); }} aria-pressed={objetivo === opcion.nombre}>
              <span><i />{opcion.nombre}</span><strong><Flame size={12} fill="currentColor" />{opcion.kcal} kcal</strong>
            </button>
          ))}
        </div>
        <div className={styles.macroFields}>
          <label><span>Calorías</span><input type="number" min="1" step="1" inputMode="numeric" value={valores.kcal} onChange={(evento) => setValores((actual) => ({ ...actual, kcal: Number(evento.target.value) || 0 }))} /><b>kcal</b></label>
          <label><span>Proteína</span><input type="number" min="0" step="1" inputMode="numeric" value={valores.prot} onChange={(evento) => setValores((actual) => ({ ...actual, prot: Number(evento.target.value) || 0 }))} /><b>g</b></label>
          <label><span>Carbohidratos</span><input type="number" min="0" step="1" inputMode="numeric" value={valores.carb} onChange={(evento) => setValores((actual) => ({ ...actual, carb: Number(evento.target.value) || 0 }))} /><b>g</b></label>
          <label><span>Grasas</span><input type="number" min="0" step="1" inputMode="numeric" value={valores.grasa} onChange={(evento) => setValores((actual) => ({ ...actual, grasa: Number(evento.target.value) || 0 }))} /><b>g</b></label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <button type="button" className={styles.macroApplyButton} disabled={guardando} onClick={aplicar}>{guardando ? "Guardando…" : "Aplicar objetivos"}</button>
      </section>
    </div>
  );
}

function EscanerNutricional({ onClose, onAdd }: { onClose: () => void; onAdd: (alimento: (typeof ALIMENTOS)[number]) => void }) {
  const [codigo, setCodigo] = useState("");
  const [producto, setProducto] = useState<ProductoOFF | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState("");
  const consultar = async () => {
    const limpio = codigo.replace(/\D/g, "");
    if (limpio.length < 4) {
      setError("Ingresa un código de barras válido");
      return;
    }
    setConsultando(true);
    setError("");
    setProducto(null);
    try {
      const resultado = await buscarPorCodigoOFFAction(limpio);
      if (!resultado.ok) setError(resultado.error);
      else if (!resultado.producto) setError("Ese producto aún no está en Open Food Facts");
      else setProducto(resultado.producto);
    } catch {
      setError("No se pudo consultar el código. Revisa tu conexión.");
    } finally {
      setConsultando(false);
    }
  };
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={`${styles.nutritionPanel} ${styles.scannerPanel}`} role="dialog" aria-modal="true" aria-label="Escáner nutricional" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar escáner"><X size={19} /></button><span>Escáner VIP</span></header>
        <div className={styles.scannerViewport}>
          <ScanLine size={52} />
          <span className={styles.scannerFrame} />
          <i />
        </div>
        <h2>Escanea el alimento</h2>
        <p>La cámara real se activa con HTTPS y una cuenta autorizada. En este localhost puedes comprobar ahora mismo el código contra Open Food Facts.</p>
        <label className={styles.foodSearchInput}><ScanLine size={18} /><input aria-label="Código de barras" inputMode="numeric" placeholder="Ej. 5449000000996" value={codigo} onChange={(evento) => setCodigo(evento.target.value)} /></label>
        <button type="button" className={styles.macroApplyButton} disabled={consultando} onClick={consultar}>{consultando ? "Consultando…" : "Consultar código real"}</button>
        {error ? <p role="alert">{error}</p> : null}
        {producto ? <article className={styles.scannerResult}><div><strong>{producto.nombre}</strong><span>{producto.marca ?? "Open Food Facts"}</span><p>{Math.round(producto.kcal)} cal · {Math.round(producto.prot)} p · {Math.round(producto.carb)} c · {Math.round(producto.grasa)} g / 100 g</p></div><button type="button" onClick={() => onAdd(alimentoVisualDesdeOFF(producto))}><Plus size={18} />Agregar</button></article> : null}
      </section>
    </div>
  );
}

const RADIO_MACRO = 42;
const VUELTA_MACRO = 2 * Math.PI * RADIO_MACRO;
function ResumenMacrosAnimado({ totales, objetivos }: { totales: TotalesNutricionV2; objetivos: TotalesNutricionV2 }) {
  const avanceCalorias = objetivos.kcal > 0 ? Math.min(1, totales.kcal / objetivos.kcal) : 0;
  const macros = [
    { nombre: "Proteínas", Icono: Beef, consumido: totales.prot, objetivo: objetivos.prot },
    { nombre: "Grasas", Icono: Droplet, consumido: totales.grasa, objetivo: objetivos.grasa },
    { nombre: "Carbohidratos", Icono: Leaf, consumido: totales.carb, objetivo: objetivos.carb },
  ];
  return (
    <section className={styles.animatedMacroCard} aria-label="Progreso nutricional animado">
      <p>Tu progreso nutricional</p>
      <div className={styles.animatedMacroContent}>
        <div className={styles.calorieRing}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r={RADIO_MACRO} />
            <circle
              cx="50"
              cy="50"
              r={RADIO_MACRO}
              className={styles.calorieRingProgress}
              style={{ "--ring-offset": VUELTA_MACRO * (1 - avanceCalorias) } as React.CSSProperties}
            />
          </svg>
          <span><strong>{Math.round(totales.kcal)}</strong><small>/ {objetivos.kcal}</small><em>kcal</em></span>
        </div>
        <div className={styles.animatedMacroBars}>
          {macros.map(({ nombre, Icono, consumido, objetivo }) => (
            <div key={nombre}>
              <span><Icono size={12} /><b>{nombre}</b><small><strong>{consumido}</strong> / {objetivo} g</small></span>
              <i><em style={{ "--macro-scale": objetivo > 0 ? Math.min(1, consumido / objetivo) : 0 } as React.CSSProperties} /></i>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuscarAlimento({ onClose, onScan, onAdd }: { onClose: () => void; onScan: () => void; onAdd: (alimento: (typeof ALIMENTOS)[number]) => void }) {
  const [consulta, setConsulta] = useState("");
  const [externos, setExternos] = useState<ProductoOFF[]>([]);
  const [buscandoExternos, setBuscandoExternos] = useState(false);
  const [errorExterno, setErrorExterno] = useState("");
  const visibles = ALIMENTOS.filter((alimento) => `${alimento.nombre} ${alimento.marca}`.toLocaleLowerCase("es").includes(consulta.trim().toLocaleLowerCase("es")));
  const buscarChile = async () => {
    if (consulta.trim().length < 2) return;
    setBuscandoExternos(true);
    setErrorExterno("");
    try {
      const resultado = await buscarEnOFFAction(consulta, "chile");
      if (!resultado.ok) {
        setExternos([]);
        setErrorExterno(resultado.error);
      } else {
        setExternos(resultado.productos.slice(0, 12));
        if (resultado.productos.length === 0) setErrorExterno("No encontramos productos chilenos con ese nombre");
      }
    } catch {
      setErrorExterno("No se pudo consultar Open Food Facts");
    } finally {
      setBuscandoExternos(false);
    }
  };
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={`${styles.nutritionPanel} ${styles.foodSearchPanel}`} role="dialog" aria-modal="true" aria-label="Buscar alimentos" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar búsqueda"><X size={19} /></button></header>
        <div className={styles.foodSearchTabs} aria-label="Método para agregar alimentos"><span aria-current="page"><Search size={18} />Buscar</span><button type="button" onClick={onScan}><ScanLine size={18} />Escanear</button></div>
        <h2>Buscar alimentos</h2>
        <label className={styles.foodSearchInput}><Search size={18} /><input aria-label="Nombre del alimento" placeholder="Busca por nombre o marca" value={consulta} onChange={(evento) => setConsulta(evento.target.value)} autoFocus /></label>
        <button type="button" className={styles.foodExternalSearch} onClick={buscarChile} disabled={consulta.trim().length < 2 || buscandoExternos}>{buscandoExternos ? "Buscando productos de Chile…" : "Buscar también en productos de Chile"}</button>
        <div className={styles.foodList}>
          {visibles.map((alimento) => (
            <article key={alimento.nombre}><div><strong>{alimento.nombre}</strong><span>{alimento.marca}</span><p>{alimento.detalle}</p></div><button type="button" onClick={() => onAdd(alimento)} aria-label={`Agregar ${alimento.nombre}`}><Plus size={21} /></button></article>
          ))}
          {externos.map((producto) => {
            const alimento = alimentoVisualDesdeOFF(producto);
            return <article key={producto.offId}><div><strong>{producto.nombre}</strong><span>{producto.marca ?? "Open Food Facts"}</span><p>{alimento.detalle}</p></div><button type="button" onClick={() => onAdd(alimento)} aria-label={`Agregar ${producto.nombre}`}><Plus size={21} /></button></article>;
          })}
          {errorExterno ? <p role="alert">{errorExterno}</p> : visibles.length === 0 && externos.length === 0 ? <p>Busca también en el catálogo abierto de productos de Chile.</p> : null}
        </div>
      </section>
    </div>
  );
}
