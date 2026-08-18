"use client";

import { useEffect, useRef, useState } from "react";
import {
  Beef,
  Bookmark,
  ChefHat,
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

const DIAS_NUTRICION = [
  { dia: "LUN", numero: 17 },
  { dia: "MAR", numero: 18 },
  { dia: "MIÉ", numero: 19 },
  { dia: "JUE", numero: 20 },
  { dia: "VIE", numero: 21 },
  { dia: "SÁB", numero: 22 },
  { dia: "DOM", numero: 23 },
];

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
  { nombre: "Pan blanco", marca: "Bimbo", detalle: "120 cal · 3 p · 26 c · 1 g" },
  { nombre: "Queso fresco", marca: "VIP Selection", detalle: "120 cal · 6 p · 5 c · 9 g" },
  { nombre: "Salsa de tomate", marca: "Natural", detalle: "15 cal · 1 p · 4 c · 0 g" },
  { nombre: "Yogur alto en proteína", marca: "VIP Selection", detalle: "145 cal · 15 p · 12 c · 3 g" },
];

const OBJETIVOS_NUTRICION = [
  { nombre: "Definición", calorias: "2146 kcal" },
  { nombre: "Mantenimiento", calorias: "2446 kcal" },
  { nombre: "Volumen controlado", calorias: "2846 kcal" },
];

type PanelNutricion = "resumen" | "buscar" | "macros" | "escaner" | null;

export function NutricionV2() {
  const [horaActual] = useState(horaActualChile);
  const [diaActivo, setDiaActivo] = useState(18);
  const [panel, setPanel] = useState<PanelNutricion>(null);
  const [horaSeleccionada, setHoraSeleccionada] = useState(horaActual);
  const [comidas, setComidas] = useState(() => [{ ...ALIMENTOS[0], dia: 18, hora: horaActual }]);
  const [aviso, setAviso] = useState("");
  const [colapsoSemana, setColapsoSemana] = useState(0);
  const lineaTiempoRef = useRef<HTMLElement>(null);
  const inicioScrollRef = useRef(0);

  useEffect(() => {
    const lineaTiempo = lineaTiempoRef.current;
    if (!lineaTiempo) return;
    if (diaActivo !== 18) {
      lineaTiempo.scrollTop = 0;
      inicioScrollRef.current = 0;
      return;
    }
    const filaActual = lineaTiempo.querySelector<HTMLElement>(`[data-hora="${horaActual}"]`);
    if (!filaActual) return;
    const inicio = Math.max(0, filaActual.offsetTop - 3 * 71);
    lineaTiempo.scrollTop = inicio;
    inicioScrollRef.current = inicio;
  }, [diaActivo, horaActual]);

  const manejarScrollHoras = (evento: React.UIEvent<HTMLElement>) => {
    const recorrido = Math.max(0, evento.currentTarget.scrollTop - inicioScrollRef.current);
    const siguiente = Math.min(1, recorrido / 52);
    setColapsoSemana((actual) => Math.abs(actual - siguiente) > 0.015 ? siguiente : actual);
  };

  const agregarComida = (alimento: (typeof ALIMENTOS)[number]) => {
    setComidas((actuales) => [...actuales, { ...alimento, dia: diaActivo, hora: horaSeleccionada }]);
    setPanel(null);
    setAviso(`${alimento.nombre} fue añadido a las ${etiquetaHora(horaSeleccionada)}`);
  };

  const copiarComida = () => {
    setComidas((actuales) => {
      const primera = actuales[0];
      return primera ? [...actuales, { ...primera, dia: diaActivo, hora: horaActual }] : actuales;
    });
    setAviso("Comida copiada correctamente");
  };

  const abrirPanel = (siguiente: Exclude<PanelNutricion, null>, hora = horaActual) => {
    setHoraSeleccionada(hora);
    setAviso("");
    setPanel(siguiente);
  };

  const elegirDia = (dia: number) => {
    setColapsoSemana(0);
    setDiaActivo(dia);
  };

  return (
    <div className={styles.nutritionPage}>
      <header className={styles.nutritionHeader}>
        <button type="button" className={styles.nutritionDateTitle} onClick={() => abrirPanel("resumen")}>
          {diaActivo} de agosto <ChevronRight size={17} />
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
          {DIAS_NUTRICION.map((dia) => (
            <button type="button" tabIndex={colapsoSemana > 0.98 ? -1 : 0} key={dia.numero} className={dia.numero === diaActivo ? styles.nutritionDayActive : ""} onClick={() => elegirDia(dia.numero)} aria-pressed={dia.numero === diaActivo}>
              <span>{dia.dia}</span><strong>{dia.numero}</strong>
            </button>
          ))}
        </div>

        <button type="button" className={styles.macroStrip} onClick={() => abrirPanel("resumen")} aria-label="Abrir resumen nutricional">
          <MacroCompacto icon={<Flame size={14} fill="currentColor" />} consumido="240" objetivo="2846" progreso={8} />
          <MacroCompacto nombre="P" consumido="22" objetivo="232" progreso={10} />
          <MacroCompacto nombre="C" consumido="31" objetivo="239" progreso={13} />
          <MacroCompacto nombre="G" consumido="10" objetivo="106" progreso={9} />
        </button>
      </header>

      <section ref={lineaTiempoRef} className={styles.nutritionTimeline} aria-label="Registro diario de comidas" onScroll={manejarScrollHoras}>
        {HORAS.map(({ hora, etiqueta }) => {
          const comidasDeLaHora = comidas.filter((comida) => comida.dia === diaActivo && comida.hora === hora);
          const esAhora = diaActivo === 18 && hora === horaActual;
          return (
          <div className={styles.nutritionTimeRow} key={hora} data-hora={hora}>
            <span className={`${styles.timePill} ${esAhora ? styles.timePillActive : ""}`}>{etiqueta}{esAhora ? <small>Ahora</small> : null}</span>
            <button type="button" className={styles.timeAdd} onClick={() => abrirPanel("buscar", hora)} aria-label={`Agregar comida a las ${etiqueta}`}><Plus size={17} /></button>
            {comidasDeLaHora.length > 0 ? (
              <div className={styles.loggedMeals}>
                {comidasDeLaHora.map((comida, comidaIndice) => (
                  <article className={styles.loggedMeal} key={`${comida.nombre}-${comidaIndice}`}>
                    <div><strong>{comida.nombre}</strong><span>{comida.marca}</span><p>{comida.detalle}</p></div><button type="button" aria-label={`Opciones de ${comida.nombre}`}>•••</button>
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
        <button type="button" onClick={copiarComida}><Copy size={14} />Copiar</button>
      </div>

      {aviso ? <button type="button" className={styles.nutritionToast} onClick={() => setAviso("")}><span>{aviso}</span><X size={14} /></button> : null}
      {panel === "resumen" ? <ResumenNutricional onClose={() => setPanel(null)} onAdjust={() => setPanel("macros")} /> : null}
      {panel === "buscar" ? <BuscarAlimento onClose={() => setPanel(null)} onAdd={agregarComida} /> : null}
      {panel === "macros" ? <AjustarMacros onClose={() => setPanel(null)} onApply={() => { setPanel(null); setAviso("Objetivos nutricionales actualizados"); }} /> : null}
      {panel === "escaner" ? <EscanerNutricional onClose={() => setPanel(null)} onAdd={() => agregarComida(ALIMENTOS[3])} /> : null}
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

function ResumenNutricional({ onClose, onAdjust }: { onClose: () => void; onAdjust: () => void }) {
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label="Resumen nutricional" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar resumen"><X size={19} /></button><button type="button" className={styles.adjustMacros} onClick={onAdjust}><PieChart size={14} />Ajustar macros</button></header>
        <h2>Resumen nutricional</h2>
        <ResumenMacrosAnimado />
        <div className={styles.nutrientHeading}><h3>Distribución de nutrientes</h3><span>g&nbsp;&nbsp;%</span></div>
        <div className={styles.nutrientRows}>
          <span><b>Fibra</b><em>3 / 38 g</em></span><span><b>Azúcar</b><em>7 / 36 g</em></span><span><b>Colesterol</b><em>30 / 300 mg</em></span><span><b>Sodio</b><em>920 / 1500 mg</em></span>
        </div>
        <div className={styles.nutrientHeading}><h3>Micronutrientes</h3><span>g&nbsp;&nbsp;%</span></div>
        <div className={styles.nutrientRows}>
          <span><b>Vitamina A</b><em>0 / 900 mcg</em></span><span><b>Vitamina D</b><em>0 / 15 mcg</em></span><span><b>Vitamina C</b><em>0 / 90 mg</em></span><span><b>Hierro</b><em>0 / 8 mg</em></span><span><b>Potasio</b><em>0 / 3400 mg</em></span>
        </div>
      </section>
    </div>
  );
}

function AjustarMacros({ onClose, onApply }: { onClose: () => void; onApply: () => void }) {
  const [objetivo, setObjetivo] = useState("Mantenimiento");
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={`${styles.nutritionPanel} ${styles.macroAdjustPanel}`} role="dialog" aria-modal="true" aria-label="Ajustar objetivos nutricionales" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar ajuste de macros"><X size={19} /></button><span>Vista personalizada</span></header>
        <h2>Ajustar macros</h2>
        <p>Elige el objetivo que mejor representa tu etapa actual.</p>
        <div className={styles.goalOptions}>
          {OBJETIVOS_NUTRICION.map((opcion) => (
            <button type="button" key={opcion.nombre} onClick={() => setObjetivo(opcion.nombre)} aria-pressed={objetivo === opcion.nombre}>
              <span><i />{opcion.nombre}</span><strong><Flame size={12} fill="currentColor" />{opcion.calorias}</strong>
            </button>
          ))}
        </div>
        <div className={styles.macroFields}>
          <label><span>Proteína</span><input inputMode="numeric" defaultValue="232" /><b>g</b></label>
          <label><span>Carbohidratos</span><input inputMode="numeric" defaultValue="239" /><b>g</b></label>
          <label><span>Grasas</span><input inputMode="numeric" defaultValue="106" /><b>g</b></label>
        </div>
        <button type="button" className={styles.macroApplyButton} onClick={onApply}>Aplicar objetivos</button>
      </section>
    </div>
  );
}

function EscanerNutricional({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
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
        <p>Centra el código o la etiqueta dentro del recuadro. En esta vista de prueba puedes simular una lectura.</p>
        <button type="button" className={styles.macroApplyButton} onClick={onAdd}>Simular lectura de prueba</button>
      </section>
    </div>
  );
}

const RADIO_MACRO = 42;
const VUELTA_MACRO = 2 * Math.PI * RADIO_MACRO;
const MACROS_RESUMEN = [
  { nombre: "Proteínas", Icono: Beef, consumido: 22, objetivo: 232 },
  { nombre: "Grasas", Icono: Droplet, consumido: 10, objetivo: 106 },
  { nombre: "Carbohidratos", Icono: Leaf, consumido: 31, objetivo: 239 },
];

function ResumenMacrosAnimado() {
  const avanceCalorias = Math.min(1, 240 / 2846);
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
          <span><strong>240</strong><small>/ 2846</small><em>kcal</em></span>
        </div>
        <div className={styles.animatedMacroBars}>
          {MACROS_RESUMEN.map(({ nombre, Icono, consumido, objetivo }) => (
            <div key={nombre}>
              <span><Icono size={12} /><b>{nombre}</b><small><strong>{consumido}</strong> / {objetivo} g</small></span>
              <i><em style={{ "--macro-scale": Math.min(1, consumido / objetivo) } as React.CSSProperties} /></i>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuscarAlimento({ onClose, onAdd }: { onClose: () => void; onAdd: (alimento: (typeof ALIMENTOS)[number]) => void }) {
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={`${styles.nutritionPanel} ${styles.foodSearchPanel}`} role="dialog" aria-modal="true" aria-label="Buscar alimentos" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar búsqueda"><X size={19} /></button></header>
        <div className={styles.foodSearchTabs}><span><Search size={18} />Buscar</span><span><ScanLine size={18} />Escanear</span><span><Bookmark size={18} />Guardados</span><span><ChefHat size={18} />Recetas</span></div>
        <h2>Buscar alimentos</h2>
        <label className={styles.foodSearchInput}><Search size={18} /><input aria-label="Nombre del alimento" placeholder="Busca por nombre o marca" autoFocus /></label>
        <div className={styles.foodList}>
          {ALIMENTOS.map((alimento) => (
            <article key={alimento.nombre}><div><strong>{alimento.nombre}</strong><span>{alimento.marca}</span><p>{alimento.detalle}</p></div><button type="button" onClick={() => onAdd(alimento)} aria-label={`Agregar ${alimento.nombre}`}><Plus size={21} /></button></article>
          ))}
        </div>
      </section>
    </div>
  );
}
