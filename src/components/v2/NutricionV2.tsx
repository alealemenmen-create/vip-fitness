"use client";

import { useState } from "react";
import {
  Bookmark,
  ChefHat,
  ChevronRight,
  Copy,
  Flame,
  LayoutGrid,
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

const HORAS = ["12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM"];

const ALIMENTOS = [
  { nombre: "Pan blanco", marca: "Bimbo", detalle: "120 cal · 3 p · 26 c · 1 g" },
  { nombre: "Queso fresco", marca: "VIP Selection", detalle: "120 cal · 6 p · 5 c · 9 g" },
  { nombre: "Salsa de tomate", marca: "Natural", detalle: "15 cal · 1 p · 4 c · 0 g" },
  { nombre: "Yogur alto en proteína", marca: "VIP Selection", detalle: "145 cal · 15 p · 12 c · 3 g" },
];

type PanelNutricion = "resumen" | "buscar" | null;

export function NutricionV2() {
  const [diaActivo, setDiaActivo] = useState(18);
  const [panel, setPanel] = useState<PanelNutricion>(null);
  const [comidas, setComidas] = useState(() => [ALIMENTOS[0]]);

  const agregarComida = (alimento: (typeof ALIMENTOS)[number]) => {
    setComidas((actuales) => [...actuales, alimento]);
    setPanel(null);
  };

  return (
    <div className={styles.nutritionPage}>
      <button type="button" className={styles.nutritionDateTitle} onClick={() => setPanel("resumen")}>
        18 de agosto <ChevronRight size={17} />
      </button>

      <div className={styles.nutritionDays} aria-label="Semana de nutrición">
        {DIAS_NUTRICION.map((dia) => (
          <button type="button" key={dia.numero} className={dia.numero === diaActivo ? styles.nutritionDayActive : ""} onClick={() => setDiaActivo(dia.numero)} aria-pressed={dia.numero === diaActivo}>
            <span>{dia.dia}</span><strong>{dia.numero}</strong>
          </button>
        ))}
      </div>

      <button type="button" className={styles.macroStrip} onClick={() => setPanel("resumen")} aria-label="Abrir resumen nutricional">
        <MacroCompacto icon={<Flame size={13} fill="currentColor" />} valor="240 / 2846" progreso={8} />
        <MacroCompacto nombre="P" valor="22 / 232" progreso={10} />
        <MacroCompacto nombre="C" valor="31 / 239" progreso={13} />
        <MacroCompacto nombre="G" valor="10 / 106" progreso={9} />
      </button>

      <section className={styles.nutritionTimeline} aria-label="Registro diario de comidas">
        {HORAS.map((hora, indice) => (
          <div className={styles.nutritionTimeRow} key={hora}>
            <span className={styles.timePill}>{hora}</span>
            <button type="button" className={styles.timeAdd} onClick={() => setPanel("buscar")} aria-label={`Agregar comida a las ${hora}`}><Plus size={17} /></button>
            {indice === 0 && comidas.length > 0 ? (
              <div className={styles.loggedMeals}>
                {comidas.map((comida, comidaIndice) => (
                  <article className={styles.loggedMeal} key={`${comida.nombre}-${comidaIndice}`}>
                    <div><strong>{comida.nombre}</strong><span>{comida.marca}</span><p>{comida.detalle}</p></div><button type="button" aria-label={`Opciones de ${comida.nombre}`}>•••</button>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <div className={styles.nutritionQuickBar} aria-label="Accesos rápidos de nutrición">
        <button type="button" onClick={() => setPanel("buscar")}><Search size={14} />Buscar</button>
        <button type="button"><ScanLine size={14} />Escanear</button>
        <button type="button"><LayoutGrid size={14} />Cálculo rápido</button>
        <button type="button"><Copy size={14} />Copiar comidas</button>
      </div>

      {panel === "resumen" ? <ResumenNutricional onClose={() => setPanel(null)} /> : null}
      {panel === "buscar" ? <BuscarAlimento onClose={() => setPanel(null)} onAdd={agregarComida} /> : null}
    </div>
  );
}

function MacroCompacto({ nombre, icon, valor, progreso }: { nombre?: string; icon?: React.ReactNode; valor: string; progreso: number }) {
  return (
    <span className={styles.macroCompact}>
      <span><b>{icon ?? nombre}</b><small>{valor}</small></span>
      <i><em style={{ width: `${progreso}%` }} /></i>
    </span>
  );
}

function ResumenNutricional({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.nutritionPanelBackdrop} role="presentation" onClick={onClose}>
      <section className={styles.nutritionPanel} role="dialog" aria-modal="true" aria-label="Resumen nutricional" onClick={(evento) => evento.stopPropagation()}>
        <header><button type="button" onClick={onClose} aria-label="Cerrar resumen"><X size={19} /></button><button type="button" className={styles.adjustMacros}><PieChart size={14} />Ajustar macros</button></header>
        <h2>Resumen nutricional</h2>
        <div className={styles.macroOverviewGrid}>
          <MacroOverview nombre="Calorías" valor="240 / 2846" progreso={8} />
          <MacroOverview nombre="Proteína" valor="22 / 232 g" progreso={10} />
          <MacroOverview nombre="Carbohidratos" valor="31 / 239 g" progreso={13} />
          <MacroOverview nombre="Grasas" valor="10 / 106 g" progreso={9} />
        </div>
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

function MacroOverview({ nombre, valor, progreso }: { nombre: string; valor: string; progreso: number }) {
  return <span><b>{nombre}</b><i><em style={{ width: `${progreso}%` }} /></i><strong>{valor}</strong></span>;
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
