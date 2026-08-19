"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ChevronRight, Dumbbell, Gauge, Images, ListChecks, Medal, Plus, Trophy, Utensils, X, Zap } from "lucide-react";
import { agregarPeso } from "@/app/alumno/progreso/actions";
import { obtenerProgresoV2Action, type ProgresoDatosV2 } from "@/app/portal-v2/progreso/actions";
import styles from "@/components/v2/PortalV2.module.css";

const DEMO_ESTADISTICAS = [
  { valor: "7", unidad: "", etiqueta: "Entrenamientos completados", detalle: "Últimos 30 días", Icono: Dumbbell },
  { valor: "1", unidad: "día", etiqueta: "Alimentación registrada", detalle: "Últimos 30 días", Icono: Utensils },
  { valor: "1,6", unidad: "", etiqueta: "Promedio semanal", detalle: "Últimos 30 días", Icono: Gauge },
  { valor: "6", unidad: "", etiqueta: "Impulsos cumplidos", detalle: "6 recomendaciones evaluadas", Icono: Zap },
  { valor: "16", unidad: "", etiqueta: "Series registradas", detalle: "En todos tus entrenamientos", Icono: ListChecks },
  { valor: "86", unidad: "%", etiqueta: "Adherencia", detalle: "Entrenamiento y alimentación", Icono: Trophy },
] as const;

const DEMO_COMUNIDAD = [
  { alumnoId: "vale", nombre: "Vale R.", puntos: 1240, posicion: 1, esActual: false },
  { alumnoId: "tu", nombre: "Tú", puntos: 900, posicion: 2, esActual: true },
  { alumnoId: "seba", nombre: "Seba M.", puntos: 760, posicion: 3, esActual: false },
] as const;

function fechaLegible(fecha: string | null) {
  if (!fecha) return "Sin registros todavía";
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" })
    .format(new Date(`${fecha}T12:00:00-04:00`));
}

export default function ProgresoV2Page() {
  const [datos, setDatos] = useState<ProgresoDatosV2 | null | undefined>(undefined);
  const [peso, setPeso] = useState("88.0");
  const [pesoBorrador, setPesoBorrador] = useState(peso);
  const [modalPeso, setModalPeso] = useState(false);
  const [detallePrograma, setDetallePrograma] = useState(false);
  const [aviso, setAviso] = useState("");
  const [guardando, iniciarGuardado] = useTransition();

  useEffect(() => {
    let activo = true;
    obtenerProgresoV2Action()
      .then((respuesta) => {
        if (!activo) return;
        setDatos(respuesta);
        if (respuesta) setPeso(respuesta.peso == null ? "" : respuesta.peso.toFixed(1));
      })
      .catch(() => { if (activo) setDatos(null); });
    return () => { activo = false; };
  }, []);

  const estadisticas = useMemo(() => datos ? [
    { valor: String(datos.estadisticas.entrenamientos), unidad: "", etiqueta: "Entrenamientos completados", detalle: "Últimos 30 días", Icono: Dumbbell },
    { valor: String(datos.estadisticas.diasAlimentacion), unidad: datos.estadisticas.diasAlimentacion === 1 ? "día" : "días", etiqueta: "Alimentación registrada", detalle: "Últimos 30 días", Icono: Utensils },
    { valor: datos.estadisticas.promedioSemanal.toLocaleString("es-CL"), unidad: "", etiqueta: "Promedio semanal", detalle: "Últimos 30 días", Icono: Gauge },
    { valor: String(datos.estadisticas.impulsosCumplidos), unidad: "", etiqueta: "Impulsos cumplidos", detalle: `${datos.estadisticas.impulsosEvaluados} recomendaciones evaluadas`, Icono: Zap },
    { valor: String(datos.estadisticas.seriesRegistradas), unidad: "", etiqueta: "Series registradas", detalle: "Con carga y repeticiones reales", Icono: ListChecks },
    { valor: datos.estadisticas.adherencia == null ? "—" : String(Math.round(datos.estadisticas.adherencia)), unidad: datos.estadisticas.adherencia == null ? "" : "%", etiqueta: "Adherencia", detalle: "Entrenamiento y alimentación", Icono: Trophy },
  ] : DEMO_ESTADISTICAS, [datos]);

  const comunidad = datos ? datos.clasificacion : DEMO_COMUNIDAD;

  const abrirPeso = () => {
    setPesoBorrador(peso);
    setModalPeso(true);
  };

  const guardarPeso = () => {
    const numero = Number(pesoBorrador.replace(",", "."));
    if (!Number.isFinite(numero) || numero <= 0) {
      setAviso("Ingresa un peso válido");
      return;
    }
    if (datos?.soloLectura) {
      setAviso("Esta cuenta está en modo lectura");
      return;
    }

    iniciarGuardado(async () => {
      if (datos) {
        const formulario = new FormData();
        formulario.set("peso_kg", String(numero));
        formulario.set("fecha", datos.fechaHoy);
        const resultado = await agregarPeso({ error: null, ok: false }, formulario);
        if (!resultado.ok) {
          setAviso(resultado.error || "No fue posible guardar el peso");
          return;
        }
        setDatos((actual) => actual ? { ...actual, peso: numero, fechaPeso: actual.fechaHoy } : actual);
        setAviso(resultado.aviso || (resultado.puntos ? `Peso guardado · +${resultado.puntos} XP` : "Peso registrado correctamente"));
      } else {
        setAviso("Peso registrado en la vista de demostración");
      }
      setPeso(numero.toFixed(1));
      setModalPeso(false);
    });
  };

  const porcentajePrograma = datos?.programa
    ? Math.min(100, Math.round((datos.programa.sesionesRealizadas / Math.max(1, datos.programa.sesionesEsperadas)) * 100))
    : datos ? 0 : 29;

  return (
    <section className={styles.progressPage} aria-busy={datos === undefined}>
      <div className={styles.progressSectionHeading}><h1>Tu día</h1><span>{datos?.nombre ? `Hola, ${datos.nombre.split(" ")[0]}` : "Método VIP"}</span></div>
      <section className={styles.todayDashboard} aria-label="Estado de hoy">
        <Link href={datos?.hoy.sesionEnProgresoId ? `/portal-v2/entrenamiento/sesion?id=${datos.hoy.sesionEnProgresoId}` : "/portal-v2/entrenamiento"}>
          <span><Dumbbell size={18} /></span>
          <div><small>ENTRENAMIENTO</small><strong>{datos?.hoy.sesionEnProgresoId ? "Sesión en curso" : "Programa de hoy"}</strong><p>{datos?.hoy.sesionEnProgresoId ? "Continúa exactamente donde quedaste" : "Revisa tu día y comienza cuando estés listo"}</p></div>
          <ChevronRight size={17} />
        </Link>
        <Link href="/portal-v2/nutricion">
          <span><Utensils size={18} /></span>
          <div><small>NUTRICIÓN</small><strong>{datos ? `${datos.hoy.calorias} kcal · ${datos.hoy.proteina} g proteína` : "Registro del día"}</strong><p>{datos ? `${datos.hoy.comidasRegistradas} comidas registradas hoy` : "Busca, escanea y registra tus alimentos"}</p></div>
          <ChevronRight size={17} />
        </Link>
      </section>

      <div className={styles.progressSectionHeading}>
        <h2>Peso corporal</h2>
        <Link href="/alumno/progreso">Ver historial <ChevronRight size={16} /></Link>
      </div>

      <section className={styles.bodyweightCard} aria-label="Peso corporal actual">
        <div className={styles.bodyweightMain}>
          <span><Images size={24} /></span>
          <div><strong>{peso ? `${peso} kg` : "Sin registro"}</strong><small>{datos === undefined ? "Cargando último registro…" : datos === null ? "Vista de demostración" : `Último registro: ${fechaLegible(datos.fechaPeso)}`}</small></div>
        </div>
        <div className={styles.bodyweightFooter}>
          <p><strong>{datos?.variacionPeso == null ? "0" : `${datos.variacionPeso > 0 ? "+" : ""}${datos.variacionPeso.toLocaleString("es-CL")}`} kg</strong> en 30 días</p>
          <button type="button" onClick={abrirPeso} disabled={datos?.soloLectura}>Registrar <Plus size={17} /></button>
        </div>
      </section>

      <div className={styles.progressSectionHeading}><h2>Tu rendimiento</h2></div>
      <div className={styles.lifetimeGrid}>
        {estadisticas.map(({ valor, unidad, etiqueta, detalle, Icono }) => (
          <article key={etiqueta}>
            <Icono size={16} />
            <p><strong>{valor}</strong>{unidad ? <span>{unidad}</span> : null}</p>
            <h3>{etiqueta}</h3>
            <small>{detalle}</small>
          </article>
        ))}
      </div>

      <div className={styles.progressSectionHeading}>
        <h2>Programa actual</h2>
        <button type="button" onClick={() => setDetallePrograma(true)}>Ver progreso <ChevronRight size={16} /></button>
      </div>
      <button type="button" className={styles.programProgressCard} onClick={() => setDetallePrograma(true)}>
        <div>
          <span>Programa activo</span>
          <strong>{datos ? datos.programa?.nombre ?? "Sin programa activo" : "Método VIP"}</strong>
          <small>{datos ? datos.programa ? `Próxima sesión · día ${datos.programa.sesionActual}` : "Tu entrenador aún no asigna una rutina" : "Semana 1 · Piernas"}</small>
        </div>
        <i><em style={{ width: `${porcentajePrograma}%` }} /></i>
        <p><b>{datos ? `${datos.programa?.sesionesRealizadas ?? 0} sesiones realizadas` : "5 sesiones"}</b><span>{porcentajePrograma} % de adherencia</span></p>
      </button>

      <div className={styles.progressSectionHeading}>
        <h2>Rango actual</h2>
        <Link href="/portal-v2/progreso/comunidad">Ver clasificación <ChevronRight size={16} /></Link>
      </div>
      <article className={styles.latestMedalCard}>
        <Image src={datos?.rango?.imagen || "/rangos/rank_bronze.png"} alt={`Rango ${datos ? datos.rango?.nombre ?? "inicial" : "Bronce"}`} width={76} height={76} />
        <div><strong>{datos ? datos.rango?.nombre ?? "Rango inicial" : "Bronce"}</strong><span>{datos?.rango ? `Puesto ${datos.rango.posicion} este mes` : "Tu evolución comienza aquí"}</span></div>
        <p>{(datos ? datos.rango?.puntosAcumulados ?? 0 : 900).toLocaleString("es-CL")} XP <Medal size={19} /></p>
      </article>

      <div className={styles.progressSectionHeading}>
        <h2>Comunidad</h2>
        <Link href="/portal-v2/progreso/comunidad">Abrir comunidad <ChevronRight size={16} /></Link>
      </div>
      <section className={styles.communityPreview} aria-label="Clasificación de la comunidad">
        {comunidad.slice(0, 3).map(({ alumnoId, nombre, puntos, posicion }) => (
          <article className={styles.communityPerson} key={alumnoId}>
            <div className={`${styles.communityPhoto} ${styles.communityInitial}`}>
              <strong aria-hidden="true">{nombre.trim().charAt(0).toUpperCase()}</strong>
              <span className={styles.communityTrophy} data-place={posicion} aria-label={`Puesto ${posicion}`}><Trophy size={13} strokeWidth={2.2} /></span>
            </div>
            <strong>{nombre}</strong>
            <small>{puntos.toLocaleString("es-CL")} XP</small>
          </article>
        ))}
      </section>

      {modalPeso ? (
        <div className={styles.progressModalBackdrop} role="presentation" onClick={() => setModalPeso(false)}>
          <section className={styles.progressModal} role="dialog" aria-modal="true" aria-label="Registrar peso" onClick={(evento) => evento.stopPropagation()}>
            <header><h2>Registrar peso</h2><button type="button" onClick={() => setModalPeso(false)} aria-label="Cerrar"><X size={19} /></button></header>
            <p>Guarda tu peso de hoy. Para proteger la clasificación solo se acepta hoy o ayer.</p>
            <label><span>Peso actual</span><input inputMode="decimal" value={pesoBorrador} onChange={(evento) => setPesoBorrador(evento.target.value)} autoFocus /><b>kg</b></label>
            <button type="button" className={styles.progressSaveButton} onClick={guardarPeso} disabled={guardando}>{guardando ? "Guardando…" : "Guardar registro"}</button>
          </section>
        </div>
      ) : null}

      {detallePrograma ? <DetallePrograma datos={datos} porcentaje={porcentajePrograma} onClose={() => setDetallePrograma(false)} /> : null}
      {aviso ? <button type="button" className={styles.progressToast} onClick={() => setAviso("")}><span>{aviso}</span><X size={14} /></button> : null}
    </section>
  );
}

function DetallePrograma({ datos, porcentaje, onClose }: { datos: ProgresoDatosV2 | null | undefined; porcentaje: number; onClose: () => void }) {
  const realizadas = datos?.programa?.sesionesRealizadas ?? 5;
  const esperadas = datos?.programa?.sesionesEsperadas ?? 7;
  const impulsos = datos?.estadisticas.impulsosCumplidos ?? 6;
  const evaluados = datos?.estadisticas.impulsosEvaluados ?? 6;
  const precision = evaluados ? Math.round((impulsos / evaluados) * 100) : 0;

  return (
    <section className={styles.programDetail} role="dialog" aria-modal="true" aria-label="Progreso del programa">
      <header><button type="button" onClick={onClose} aria-label="Volver a Progreso"><ArrowLeft size={24} /></button></header>
      <h2>Progreso del programa</h2>
      <strong>{datos?.programa?.nombre ?? "Método VIP"}</strong>
      <p>Resumen real de los últimos 30 días</p>

      <div className={styles.programCalendar}>
        <h3>{porcentaje} % de adherencia</h3>
        <div className={styles.programWeek}>
          <span>30D</span>
          {Array.from({ length: Math.min(7, Math.max(1, esperadas)) }, (_, indice) => (
            <i className={indice < Math.min(realizadas, 7) ? styles.programDayDone : ""} key={indice}>
              {indice < Math.min(realizadas, 7) ? <Dumbbell size={14} /> : indice + 1}
            </i>
          ))}
        </div>
      </div>

      <div className={styles.programTotals}>
        <span><strong>{realizadas}</strong><small>Sesiones realizadas</small></span>
        <span><strong>{datos?.estadisticas.seriesRegistradas ?? 16}</strong><small>Series registradas</small></span>
      </div>
      <article className={styles.impulsoProgressCard}><Zap size={19} fill="currentColor" /><div><strong>Impulso Alejandro</strong><span>{impulsos} de {evaluados} recomendaciones cumplidas</span></div><b>{precision} %</b></article>
    </section>
  );
}
