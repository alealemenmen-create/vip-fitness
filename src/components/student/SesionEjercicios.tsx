"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, ChevronRight, List, LockKeyhole, X } from "lucide-react";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import { SesionGrupoCard } from "@/components/student/SesionGrupoCard";
import { resolverGrupoTecnica, tamanoGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import type { EjercicioSesion } from "@/app/alumno/entrenar/data";

/**
 * Parte la lista de ejercicios en grupos consecutivos de la misma familia de
 * técnica (superserie/biserie/triserie/circuito, ver `resolverGrupoTecnica`),
 * acotados por el tamaño del grupo (ver `tamanoGrupoTecnica`: la numeración
 * "(n/total)" si el entrenador la escribió, si no el default de la familia)
 * para no fusionar dos biseries seguidas en una de 4. Un ejercicio suelto es
 * un "grupo" de 1.
 *
 * Único punto donde se calculan los límites de grupo — tanto `calcularActivo`
 * como el render de abajo parten de acá, para que nunca puedan desincronizarse
 * entre sí sobre dónde empieza y termina cada biserie.
 */
function agruparPorTecnica(ejercicios: EjercicioSesion[]): EjercicioSesion[][] {
  const grupos: EjercicioSesion[][] = [];
  let i = 0;
  while (i < ejercicios.length) {
    const familia = resolverGrupoTecnica(ejercicios[i].tecnicaTipo)?.etiqueta ?? null;
    let j = i;
    if (familia) {
      // `tamanoGrupoTecnica` cae al default de la familia (bi=2, tri=3,
      // super=2) cuando el "(n/total)" no viene escrito — sin esto, dos
      // biseries seguidas sin numerar se fusionaban en un grupo de 4.
      const total = tamanoGrupoTecnica(ejercicios[i].tecnicaTipo);
      while (
        j + 1 < ejercicios.length &&
        resolverGrupoTecnica(ejercicios[j + 1].tecnicaTipo)?.etiqueta === familia &&
        (total === null || j - i + 1 < total)
      ) {
        j++;
      }
    }
    grupos.push(ejercicios.slice(i, j + 1));
    i = j + 1;
  }
  return grupos;
}

/**
 * Cuál ejercicio está "activo" ahora — el que se abre solo y lleva el
 * resplandor de "te toca acá".
 *
 * Para un ejercicio suelto es el de siempre: el primero sin completar, en el
 * orden de la rutina. Pero en una superserie/biserie/triserie/circuito se
 * alterna DE VERDAD entre los ejercicios del grupo, serie por serie: el que
 * tiene menos series hechas hasta ahora es el que toca (empate = el primero
 * del grupo) — así después de una serie de "Aperturas (1/2)" el turno pasa
 * solo a "Pullover (2/2)", en vez de pedir el ejercicio entero antes de pasar
 * al siguiente.
 */
function calcularActivo(ejercicios: EjercicioSesion[]): string | null {
  for (const grupo of agruparPorTecnica(ejercicios)) {
    const pendientes = grupo.filter((e) => !e.completado);
    if (pendientes.length === 0) continue;
    if (grupo.length === 1) return pendientes[0].sesionEjercicioId;
    // Grupo real (2 o más): el que tiene menos series hechas manda — empate
    // lo gana el que aparece primero en `pendientes` (orden de la rutina),
    // porque `reduce` solo reemplaza con `<`, nunca con `<=`.
    const elegido = pendientes.reduce((mejor, actual) =>
      actual.series.filter((s) => s.realizada).length < mejor.series.filter((s) => s.realizada).length
        ? actual
        : mejor
    );
    return elegido.sesionEjercicioId;
  }
  return null;
}

/**
 * Lista de ejercicios de la sesión + un único botón "Guardar progreso"
 * general (en vez de uno por ejercicio) y "Finalizar entrenamiento" debajo.
 * El guardado automático por ejercicio (cuando terminan los descansos de
 * todas sus series) sigue funcionando igual — este botón es el respaldo
 * manual para guardar todo de una vez.
 *
 * Cualquier técnica encadenada (biserie, triserie, giant set — 2 o más
 * ejercicios seguidos de la misma familia, ver `resolverGrupoTecnica`) se
 * muestra como una sola tarjeta combinada con las series intercaladas —
 * ver `SesionGrupoCard`.
 */
export function SesionEjercicios({
  ejercicios,
  sesionId,
  tituloSesion,
  soloLectura,
  completados,
  total,
  modoCorreccion = false,
}: {
  ejercicios: EjercicioSesion[];
  sesionId: string;
  tituloSesion?: string;
  soloLectura: boolean;
  /**
   * Corrigiendo un registro cerrado (migración 0077): se edita, pero **toda la
   * rutina se muestra en lista**, no de a un ejercicio por vez.
   *
   * `soloLectura` decidía dos cosas a la vez —si se puede escribir Y si se ve
   * uno o todos— y por eso corregir caía en el modo enfocado del
   * entrenamiento: para arreglar un kilo del ejercicio 6 había que tocar
   * "Siguiente" cinco veces. Alejandro: "que cuando entre a la pantalla de
   * corregir me arroje la rutina en lista para verla mejor y corregirla muy
   * rápido". Son dos preguntas distintas y ahora son dos props distintas.
   *
   * También apaga `activo` en todas las tarjetas: en una sesión abandonada o
   * incompleta quedan ejercicios sin terminar, y sin esto el primero de ellos
   * arrancaría los descansos y los temporizadores. Corregir no es entrenar —
   * acá no corre ningún reloj.
   */
  modoCorreccion?: boolean;
  completados: number;
  total: number;
}) {
  const handles = useRef(new Map<string, SesionEjercicioCardHandle>());
  const ejercicioActivoId = calcularActivo(ejercicios);
  const grupos = agruparPorTecnica(ejercicios);
  const indiceActivo = Math.max(
    0,
    grupos.findIndex((grupo) => grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId))
  );
  const [indiceVisible, setIndiceVisible] = useState(indiceActivo);
  const [mostrarRutina, setMostrarRutina] = useState(false);
  const [gruposDesbloqueados, setGruposDesbloqueados] = useState<Set<string>>(
    () => new Set(grupos[indiceActivo]?.[0] ? [grupos[indiceActivo][0].sesionEjercicioId] : [])
  );
  const [toquesDesbloqueo, setToquesDesbloqueo] = useState(0);
  useEffect(() => {
    if (!tituloSesion) return;
    window.dispatchEvent(new CustomEvent("vip:titulo-rutina", { detail: tituloSesion }));
  }, [tituloSesion]);

  /**
   * Cambiar de ejercicio guarda lo que haya cargado en el que se deja.
   *
   * Solo se monta la tarjeta que se está mirando, así que moverse la desmonta:
   * sin esto, unos kilos escritos y no confirmados con "Listo" solo quedaban
   * en el respaldo del teléfono. Ahora cada movimiento por la barra los manda
   * también al servidor — y ese es el reemplazo real del botón "Guardar" que
   * se sacó, sin pedirle al alumno que se acuerde de nada.
   */
  const irA = (indice: number) => {
    handles.current.forEach((handle) => handle.guardar());
    if (indice < indiceVisible) {
      const claveAnterior = grupos[indice]?.[0]?.sesionEjercicioId;
      if (claveAnterior) setGruposDesbloqueados((actuales) => new Set(actuales).add(claveAnterior));
    }
    setIndiceVisible(indice);
    setToquesDesbloqueo(0);
  };

  const avanzarDesdeEncuesta = (grupo: EjercicioSesion[]) => {
    const indice = grupos.findIndex((actual) => actual[0].sesionEjercicioId === grupo[0].sesionEjercicioId);
    if (indice >= 0 && indice < grupos.length - 1) irA(indice + 1);
  };

  const renderizarGrupo = (grupo: EjercicioSesion[]) => {
    if (grupo.length >= 2) {
      const activo = !modoCorreccion && (
        grupo.some((ej) => ej.sesionEjercicioId === ejercicioActivoId) || gruposDesbloqueados.has(grupo[0].sesionEjercicioId)
      );
      return (
        <SesionGrupoCard
          key={grupo[0].sesionEjercicioId}
          ref={(handle) => {
            for (const ej of grupo) {
              if (handle) handles.current.set(ej.sesionEjercicioId, handle);
              else handles.current.delete(ej.sesionEjercicioId);
            }
          }}
          ejercicios={grupo}
          sesionId={sesionId}
          soloLectura={soloLectura}
          activo={activo}
          modoEnfocado={!soloLectura && !modoCorreccion}
          onDificultadRespondida={() => avanzarDesdeEncuesta(grupo)}
        />
      );
    }

    return (
      <SesionEjercicioCard
        key={grupo[0].sesionEjercicioId}
        ref={(handle) => {
          if (handle) handles.current.set(grupo[0].sesionEjercicioId, handle);
          else handles.current.delete(grupo[0].sesionEjercicioId);
        }}
        ejercicio={grupo[0]}
        sesionId={sesionId}
        soloLectura={soloLectura}
        activo={!modoCorreccion && (
          grupo[0].sesionEjercicioId === ejercicioActivoId || gruposDesbloqueados.has(grupo[0].sesionEjercicioId)
        )}
        modoEnfocado={!soloLectura && !modoCorreccion}
        onDificultadRespondida={() => avanzarDesdeEncuesta(grupo)}
      />
    );
  };

  const grupoVisible = grupos[indiceVisible] ?? grupos[0];
  const grupoAnterior = grupos[indiceVisible - 1] ?? null;
  const grupoSiguiente = grupos[indiceVisible + 1] ?? null;
  const claveGrupoVisible = grupoVisible?.[0]?.sesionEjercicioId ?? "";
  const grupoVisibleBloqueado = !!claveGrupoVisible && !gruposDesbloqueados.has(claveGrupoVisible);
  const tocarParaDesbloquear = () => {
    const siguienteConteo = toquesDesbloqueo + 1;
    if (siguienteConteo < 3) {
      setToquesDesbloqueo(siguienteConteo);
      return;
    }
    setGruposDesbloqueados((actuales) => new Set(actuales).add(claveGrupoVisible));
    setToquesDesbloqueo(0);
  };
  const indiceEjercicioVisible = Math.max(0, ejercicios.findIndex((ejercicio) => ejercicio.sesionEjercicioId === grupoVisible?.[0]?.sesionEjercicioId));

  return (
    <>
      {/* Dos motivos distintos para ver la rutina entera de una: mirarla sin
          poder tocarla (`soloLectura`) y corregirla (`modoCorreccion`). La
          diferencia está adentro de las tarjetas, que en corrección siguen
          siendo editables. */}
      {soloLectura || modoCorreccion ? (
        grupos.map(renderizarGrupo)
      ) : grupoVisible ? (
        <section className="modo-entrenamiento-enfocado" aria-label="Ejercicio actual">
          <header className="cabecera-sesion-foco">
            <p>{tituloSesion}</p>
            <div className="progreso-sesion-foco" aria-label={`Ejercicio ${indiceEjercicioVisible + 1} de ${ejercicios.length}`}>
              <span>
                <i style={{ width: `${((indiceEjercicioVisible + 1) / Math.max(1, ejercicios.length)) * 100}%` }} />
              </span>
              <strong>{indiceEjercicioVisible + 1}/{ejercicios.length}</strong>
            </div>
          </header>
          <button
            type="button"
            onClick={() => setMostrarRutina(true)}
            className="boton-ver-rutina-foco"
            aria-label="Ver toda la rutina"
          >
            <List size={18} />
            <span>Rutina</span>
          </button>

          <div className="contenedor-grupo-bloqueable" data-bloqueado={grupoVisibleBloqueado ? "true" : "false"}>
            {renderizarGrupo(grupoVisible)}
            {grupoVisibleBloqueado && (
              <button
                type="button"
                className="bloqueo-ejercicio-siguiente"
                onClick={tocarParaDesbloquear}
                aria-label={`Ejercicio bloqueado. ${3 - toquesDesbloqueo} ${3 - toquesDesbloqueo === 1 ? "toque" : "toques"} para habilitarlo`}
              >
                <span><LockKeyhole size={16} /></span>
                <span className="texto-bloqueo-ejercicio">
                  <strong>Registro bloqueado</strong>
                  <small>{toquesDesbloqueo === 0 ? "Toca 3 veces para habilitar" : `${3 - toquesDesbloqueo} ${3 - toquesDesbloqueo === 1 ? "toque más" : "toques más"}`}</small>
                </span>
              </button>
            )}
          </div>

          <div className="navegacion-ejercicios-foco">
            <button type="button" onClick={() => irA(indiceVisible - 1)} disabled={!grupoAnterior}>
              <ArrowLeft size={22} />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              onClick={() => irA(indiceVisible + 1)}
              disabled={!grupoSiguiente}
              aria-label={grupoSiguiente ? `Ver siguiente ejercicio: ${grupoSiguiente.map((ejercicio) => ejercicio.nombre).join(" + ")}` : "No hay otro ejercicio"}
            >
              <span>
                <strong>{grupoSiguiente ? "Siguiente ejercicio" : "Último ejercicio"}</strong>
                <small>{grupoSiguiente?.map((ejercicio) => ejercicio.nombre).join(" + ") ?? "Fin de la rutina"}</small>
              </span>
              <ArrowRight size={23} />
            </button>
          </div>

        </section>
      ) : null}

      {mostrarRutina && createPortal(
        <div className="fondo-mapa-rutina" role="dialog" aria-modal="true" aria-label="Toda la rutina">
          <button type="button" className="cerrar-fondo-mapa" onClick={() => setMostrarRutina(false)} aria-label="Cerrar vista de rutina" />
          <section className="mapa-rutina-activa">
            <header>
              <div>
                <p>Entrenamiento actual</p>
                <h2>Toda la rutina</h2>
              </div>
              <button type="button" onClick={() => setMostrarRutina(false)} aria-label="Cerrar">
                <X size={20} />
              </button>
            </header>
            <div className="lista-mapa-rutina">
              {grupos.map((grupo, indice) => {
                const completa = grupo.every((ejercicio) => ejercicio.completado);
                const totalSeriesGrupo = grupo.reduce((totalGrupo, ejercicio) => totalGrupo + ejercicio.seriesProgramadas, 0);
                const hechasGrupo = grupo.reduce(
                  (totalGrupo, ejercicio) => totalGrupo + ejercicio.series.filter((serie) => serie.realizada).length,
                  0
                );
                return (
                  <button
                    key={grupo[0].sesionEjercicioId}
                    type="button"
                    onClick={() => {
                      irA(indice);
                      setMostrarRutina(false);
                    }}
                    data-estado={completa ? "completa" : indice === indiceActivo ? "actual" : "pendiente"}
                    aria-current={indice === indiceVisible ? "step" : undefined}
                  >
                    <span className="numero-mapa-rutina">{completa ? <Check size={15} /> : indice + 1}</span>
                    <span className="texto-mapa-rutina">
                      <strong>{grupo.map((ejercicio) => ejercicio.nombre).join(" + ")}</strong>
                      <small>{hechasGrupo}/{totalSeriesGrupo} series · {completa ? "Hecho" : indice === indiceActivo ? "Te toca ahora" : "Pendiente"}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
            </div>
          </section>
        </div>,
        document.body
      )}

      {/* Ni barra de navegación ni "Finalizar entrenamiento" en una
          corrección: no hay ejercicio "en curso" que seguir ni entrenamiento
          que cerrar. De la corrección se sale con "Listo, terminé de
          corregir", que la pantalla pone arriba de las opciones. */}
      {!soloLectura && !modoCorreccion && (
        <>
          {/* "Guardar" suelto ya no existe: guardar y completar el ejercicio
              eran dos toques para una sola intención, y el segundo casi nunca
              llegaba. Ahora "Completar y guardar" (dentro de cada tarjeta)
              hace las dos cosas, y las series se siguen guardando solas al
              terminar cada descanso. */}
          <div className="flex flex-col gap-2">
            {indiceVisible === grupos.length - 1 && (
              <FinalizarEntrenamiento sesionId={sesionId} completados={completados} total={total} compacto />
            )}
          </div>
          {/* Reserva suficiente recorrido al final del scroll para que
              Guardar, Finalizar y los paneles de nota/molestia puedan subir
              completamente por encima de las dos barras fijas. */}
          <div className="h-16" aria-hidden="true" />
        </>
      )}
    </>
  );
}
