"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Dumbbell, Play, Search, ShieldCheck, X } from "lucide-react";
import { ETIQUETAS_GRUPO_MUSCULAR } from "@/components/student/GrupoMuscularIcon";
import { ModalVideoCloudflare } from "@/components/student/ModalVideoCloudflare";
import { resolverIlustracion } from "@/lib/ejercicios/ilustracion";
import type { Ejercicio, EquipoEjercicio } from "@/lib/ejercicios/tipos";
import { obtenerFichaEjercicioV2 } from "@/app/portal-v2/entrenamiento/biblioteca/actions";
import { ImagenV2Segura } from "@/components/v2/ImagenV2Segura";
import styles from "./PortalV2.module.css";

const EQUIPOS: Record<EquipoEjercicio, string> = {
  barra: "Barra",
  mancuerna: "Mancuernas",
  polea: "Polea",
  maquina: "Máquina",
  smith: "Smith",
  peso_corporal: "Peso corporal",
  kettlebell: "Kettlebell",
  banda: "Banda",
  banco: "Banco",
  otro: "Otro",
};

const NIVELES = { principiante: "Principiante", intermedio: "Intermedio", avanzado: "Avanzado" } as const;

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL").trim();
}

export type EjercicioResumenV2 = Pick<Ejercicio,
  "id" | "nombre" | "aliases" | "grupoMuscular" | "equipo" | "ilustracionSlug" |
  "fotoMiniaturaUrl" | "fotoCompletaUrl" | "videoCloudflareEstado"
>;

function fotoDe(ejercicio: EjercicioResumenV2) {
  return ejercicio.fotoMiniaturaUrl
    ?? ejercicio.fotoCompletaUrl
    ?? resolverIlustracion(ejercicio.ilustracionSlug, ejercicio.grupoMuscular).src;
}

function respaldoDe(ejercicio: EjercicioResumenV2) {
  return resolverIlustracion(ejercicio.ilustracionSlug, ejercicio.grupoMuscular).src ?? "/v2/piernas.webp";
}

export function BibliotecaEjerciciosV2({
  ejercicios,
  puedeVerVideos,
  busquedaInicial,
}: {
  ejercicios: EjercicioResumenV2[];
  puedeVerVideos: boolean;
  busquedaInicial: string;
}) {
  const [busqueda, setBusqueda] = useState(busquedaInicial.slice(0, 80));
  const [grupo, setGrupo] = useState<string>("todos");
  const [seleccionado, setSeleccionado] = useState<Ejercicio | null>(null);
  const [seleccionando, setSeleccionando] = useState<string | null>(null);
  const [videoAbierto, setVideoAbierto] = useState(false);

  const grupos = useMemo(() => [...new Set(ejercicios.map((ejercicio) => ejercicio.grupoMuscular))]
    .sort((a, b) => ETIQUETAS_GRUPO_MUSCULAR[a].localeCompare(ETIQUETAS_GRUPO_MUSCULAR[b], "es")), [ejercicios]);
  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda);
    return ejercicios.filter((ejercicio) => {
      if (grupo !== "todos" && ejercicio.grupoMuscular !== grupo) return false;
      if (!termino) return true;
      return normalizar([
        ejercicio.nombre,
        ...ejercicio.aliases,
        ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular],
        EQUIPOS[ejercicio.equipo],
      ].join(" ")).includes(termino);
    });
  }, [busqueda, ejercicios, grupo]);

  const cerrarFicha = () => {
    setVideoAbierto(false);
    setSeleccionado(null);
  };

  const abrirFicha = async (resumen: EjercicioResumenV2) => {
    setSeleccionando(resumen.id);
    try {
      const ficha = await obtenerFichaEjercicioV2(resumen.id);
      if (ficha) setSeleccionado(ficha);
    } finally {
      setSeleccionando(null);
    }
  };

  return (
    <div className={styles.libraryPage}>
      <header className={styles.libraryHeader}>
        <Link href="/portal-v2/entrenamiento" className={styles.iconButton} aria-label="Volver a entrenamiento">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <span>Entrenamiento</span>
          <h1>Biblioteca de ejercicios</h1>
        </div>
        <span className={styles.libraryCount}>{ejercicios.length}</span>
      </header>

      <section className={styles.libraryIntro}>
        <Dumbbell size={22} />
        <div>
          <strong>Aprende antes de cargar peso</strong>
          <p>Consulta ejecución, equipo y errores frecuentes. Tu rutina asignada no se modifica desde aquí.</p>
        </div>
      </section>

      <label className={styles.librarySearch}>
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Buscar ejercicio</span>
        <input
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar ejercicio, músculo o equipo"
          autoComplete="off"
        />
        {busqueda ? <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda"><X size={16} /></button> : null}
      </label>

      <div className={styles.libraryFilters} aria-label="Filtrar por grupo muscular">
        <button type="button" className={grupo === "todos" ? styles.libraryFilterActive : ""} onClick={() => setGrupo("todos")}>Todos</button>
        {grupos.map((item) => (
          <button type="button" key={item} className={grupo === item ? styles.libraryFilterActive : ""} onClick={() => setGrupo(item)}>
            {ETIQUETAS_GRUPO_MUSCULAR[item]}
          </button>
        ))}
      </div>

      <div className={styles.libraryResultsHeader}>
        <strong>{filtrados.length} {filtrados.length === 1 ? "ejercicio" : "ejercicios"}</strong>
        <span>Catálogo VIP Fitness</span>
      </div>

      {filtrados.length ? (
        <section className={styles.libraryGrid} aria-label="Resultados de ejercicios">
          {filtrados.map((ejercicio, indice) => {
            const foto = fotoDe(ejercicio);
            return (
              <button type="button" className={styles.libraryCard} key={ejercicio.id} onClick={() => void abrirFicha(ejercicio)} disabled={seleccionando === ejercicio.id}>
                <span className={styles.libraryCardMedia}>
                  {foto ? <ImagenV2Segura src={foto} fallbackSrc={respaldoDe(ejercicio)} alt="" fill sizes="(max-width: 460px) 46vw, 210px" loading={indice < 2 ? "eager" : "lazy"} /> : <Dumbbell size={28} />}
                  {ejercicio.videoCloudflareEstado === "listo" ? <span className={styles.libraryVideoMark}><Play size={11} fill="currentColor" /></span> : null}
                </span>
                <span className={styles.libraryCardCopy}>
                  <strong>{seleccionando === ejercicio.id ? "Abriendo ficha…" : ejercicio.nombre}</strong>
                  <span>{ETIQUETAS_GRUPO_MUSCULAR[ejercicio.grupoMuscular]} · {EQUIPOS[ejercicio.equipo]}</span>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </section>
      ) : (
        <section className={styles.libraryEmpty}>
          <Search size={25} />
          <strong>No encontramos ese ejercicio</strong>
          <p>Prueba con el músculo, el equipo o una parte del nombre.</p>
          <button type="button" onClick={() => { setBusqueda(""); setGrupo("todos"); }}>Limpiar filtros</button>
        </section>
      )}

      {seleccionado ? (
        <div className={styles.libraryModalBackdrop} role="presentation" onClick={cerrarFicha}>
          <article className={styles.librarySheet} role="dialog" aria-modal="true" aria-labelledby="library-detail-title" onClick={(evento) => evento.stopPropagation()}>
            <button type="button" className={styles.libraryClose} onClick={cerrarFicha} aria-label="Cerrar ficha"><X size={19} /></button>
            <div className={styles.libraryDetailMedia}>
              {fotoDe(seleccionado) ? <ImagenV2Segura src={seleccionado.fotoCompletaUrl ?? fotoDe(seleccionado)!} fallbackSrc={fotoDe(seleccionado)} alt={`Demostración de ${seleccionado.nombre}`} fill sizes="460px" /> : <Dumbbell size={40} />}
              {seleccionado.videoCloudflareEstado === "listo" && puedeVerVideos ? (
                <button type="button" className={styles.libraryPlay} onClick={() => setVideoAbierto(true)}><Play size={16} fill="currentColor" /> Ver demostración</button>
              ) : null}
            </div>
            <div className={styles.libraryDetailBody}>
              <span className={styles.libraryEyebrow}>{ETIQUETAS_GRUPO_MUSCULAR[seleccionado.grupoMuscular]}</span>
              <h2 id="library-detail-title">{seleccionado.nombre}</h2>
              <div className={styles.libraryFacts}>
                <span>{EQUIPOS[seleccionado.equipo]}</span><span>{NIVELES[seleccionado.nivel]}</span>
              </div>
              {seleccionado.descripcionCorta ? <p className={styles.libraryDescription}>{seleccionado.descripcionCorta}</p> : null}
              {seleccionado.tecnica ? <section><h3>Técnica</h3><p>{seleccionado.tecnica}</p></section> : null}
              {seleccionado.consejos.length ? <section><h3>Claves de ejecución</h3><ul>{seleccionado.consejos.map((consejo) => <li key={consejo}>{consejo}</li>)}</ul></section> : null}
              {seleccionado.erroresComunes.length ? <section><h3>Evita esto</h3><ul>{seleccionado.erroresComunes.map((error) => <li key={error}>{error}</li>)}</ul></section> : null}
              <aside className={styles.librarySafety}><ShieldCheck size={17} /><span>Respeta la técnica y el rango indicado por tu entrenador. Detente ante dolor agudo.</span></aside>
            </div>
          </article>
        </div>
      ) : null}

      {videoAbierto && seleccionado?.videoCloudflareEstado === "listo" && puedeVerVideos ? (
        <ModalVideoCloudflare ejercicioId={seleccionado.id} nombre={seleccionado.nombre} onCerrar={() => setVideoAbierto(false)} />
      ) : null}
    </div>
  );
}
