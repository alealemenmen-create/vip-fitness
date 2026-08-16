"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { FinalizarEntrenamiento } from "@/components/student/FinalizarEntrenamiento";
import { SesionEjercicioCard, type SesionEjercicioCardHandle } from "@/components/student/SesionEjercicioCard";
import { SesionGrupoCard } from "@/components/student/SesionGrupoCard";
import { ControlDescansoSesion } from "@/components/student/ControlDescansoSesion";
import { resolverGrupoTecnica, tamanoGrupoTecnica } from "@/lib/entrenamiento/tecnica-grupo";
import { calcularPuntosEntrenamiento } from "@/lib/ranking/reglas";
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
  accionCancelarSesion,
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
  /** Acción excepcional de sesión, ubicada junto al ejercicio en curso para
   * no dejar un bloque grande al final de la pantalla. */
  accionCancelarSesion?: ReactNode;
}) {
  const handles = useRef(new Map<string, SesionEjercicioCardHandle>());
  const seccionEnfocadaRef = useRef<HTMLElement>(null);
  const grupos = agruparPorTecnica(ejercicios);
  const [gruposTerminadosEnVista, setGruposTerminadosEnVista] = useState<Set<string>>(() => new Set());
  const indiceActivo = Math.max(
    0,
    grupos.findIndex((grupo) => grupo.some((ej) =>
      !ej.completado && !gruposTerminadosEnVista.has(ej.sesionEjercicioId)
    ))
  );
  const [indiceVisible, setIndiceVisible] = useState(indiceActivo);
  const [mostrarRutina, setMostrarRutina] = useState(false);
  const [avisoBloqueo, setAvisoBloqueo] = useState(false);
  const [avisandoSiguienteEjercicio, setAvisandoSiguienteEjercicio] = useState(false);
  const [preferenciaDescansoLocal, setPreferenciaDescansoLocal] = useState<
    "libre" | "entrenador" | 40 | 60 | 90 | 120 | null
  >(null);
  const avisoSiguienteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hayGrupoSiguienteRef = useRef(false);
  useEffect(() => {
    if (!tituloSesion) return;
    window.dispatchEvent(new CustomEvent("vip:titulo-rutina", { detail: tituloSesion }));
  }, [tituloSesion]);

  /**
   * Al montar, la tarjeta activa hace su propio `scrollIntoView({block:
   * "start"})` (ver SesionEjercicioCard) — corre en cada activación, también
   * en la primerísima. Si arriba de la tarjeta hay un aviso (ej.
   * AvisoSesionColgada, "esta rutina lleva días sin cerrarse"), ese scroll
   * inicial lo empuja detrás de la cabecera fija antes de que el alumno
   * llegue a leerlo. Solo pasa en el montaje: cada avance real entre
   * ejercicios sigue centrándose solo, como corresponde. Los efectos de los
   * hijos corren antes que este (orden hijo→padre en el montaje), así que
   * llega justo después y cancela cualquier scroll suave en curso.
   */
  useEffect(() => {
    const scroll = seccionEnfocadaRef.current?.closest<HTMLElement>(".pantalla-scroll");
    if (scroll) scroll.scrollTo({ top: 0, behavior: "auto" });
  }, []);

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
    // Solo navegar a OTRO ejercicio reposiciona la vista. Una serie, un
    // descanso o un refresco del formulario nunca deben subir la tarjeta por
    // debajo del progreso fijo.
    const scroll = seccionEnfocadaRef.current?.closest<HTMLElement>(".pantalla-scroll");
    if (scroll) scroll.scrollTo({ top: 0, behavior: "auto" });
    setIndiceVisible(indice);
    setAvisoBloqueo(false);
  };

  const avanzarDesdeEncuesta = (grupo: EjercicioSesion[]) => {
    const indice = grupos.findIndex((actual) => actual[0].sesionEjercicioId === grupo[0].sesionEjercicioId);
    if (indice >= 0 && indice < grupos.length - 1) {
      setGruposTerminadosEnVista((actuales) => {
        const copia = new Set(actuales);
        grupo.forEach((ejercicio) => copia.add(ejercicio.sesionEjercicioId));
        return copia;
      });
      irA(indice + 1);
    }
  };

  const marcarGrupoTerminadoEnVista = (grupo: EjercicioSesion[]) => {
    setGruposTerminadosEnVista((actuales) => {
      const copia = new Set(actuales);
      grupo.forEach((ejercicio) => copia.add(ejercicio.sesionEjercicioId));
      return copia;
    });
  };

  const renderizarGrupo = (grupo: EjercicioSesion[], conNavegacion = false) => {
    const grupoConDescansoElegido = preferenciaDescansoLocal === null
      ? grupo
      : grupo.map((ejercicio) => ({
          ...ejercicio,
          temporizadorDescanso: preferenciaDescansoLocal !== "libre",
          descansoPersonalizadoSegundos:
            typeof preferenciaDescansoLocal === "number" ? preferenciaDescansoLocal : null,
        }));
    if (grupoConDescansoElegido.length >= 2) {
      const indiceGrupo = grupos.findIndex((actual) => actual[0].sesionEjercicioId === grupo[0].sesionEjercicioId);
      const activo = !modoCorreccion && indiceGrupo === indiceActivo;
      return (
        <SesionGrupoCard
          key={grupoConDescansoElegido[0].sesionEjercicioId}
          ref={(handle) => {
            for (const ej of grupoConDescansoElegido) {
              if (handle) handles.current.set(ej.sesionEjercicioId, handle);
              else handles.current.delete(ej.sesionEjercicioId);
            }
          }}
          ejercicios={grupoConDescansoElegido}
          sesionId={sesionId}
          soloLectura={soloLectura}
          activo={activo}
          modoEnfocado={!soloLectura && !modoCorreccion}
          onDificultadRespondida={() => avanzarDesdeEncuesta(grupo)}
          onGrupoCompletado={() => marcarGrupoTerminadoEnVista(grupo)}
          esUltimoGrupoDeRutina={conNavegacion && indiceVisible === grupos.length - 1}
          onVerRutina={conNavegacion ? () => setMostrarRutina(true) : undefined}
        />
      );
    }

    return (
      <SesionEjercicioCard
        key={grupoConDescansoElegido[0].sesionEjercicioId}
        ref={(handle) => {
          if (handle) handles.current.set(grupoConDescansoElegido[0].sesionEjercicioId, handle);
          else handles.current.delete(grupoConDescansoElegido[0].sesionEjercicioId);
        }}
        ejercicio={grupoConDescansoElegido[0]}
        sesionId={sesionId}
        soloLectura={soloLectura}
        activo={!modoCorreccion && grupos.findIndex((actual) => actual[0].sesionEjercicioId === grupo[0].sesionEjercicioId) === indiceActivo}
          modoEnfocado={!soloLectura && !modoCorreccion}
          proximosNombres={grupos
          .slice(grupos.findIndex((g) => g[0].sesionEjercicioId === grupoConDescansoElegido[0].sesionEjercicioId) + 1)
          .map((g) => ({
            nombre: g.map((ej) => ej.nombre).join(" + "),
            fotoMiniaturaUrl: g[0].fotoMiniaturaUrl ?? g[0].fotoCompletaUrl ?? g[0].videoCloudflareMiniaturaUrl,
            ilustracionSlug: g[0].ilustracionSlug,
          }))}
        onDificultadRespondida={() => avanzarDesdeEncuesta(grupo)}
        onVerRutina={conNavegacion ? () => setMostrarRutina(true) : undefined}
        esUltimoEjercicioDeRutina={conNavegacion && indiceVisible === grupos.length - 1}
        accionesBajoNota={conNavegacion ? (
          <>
            {accionCancelarSesion && !soloLectura && !modoCorreccion && (
              <div className="accion-cancelar-sesion-cercana">{accionCancelarSesion}</div>
            )}
            <ControlDescansoSesion
              temporizadorActivo={
                preferenciaDescansoLocal === "libre"
                  ? false
                  : preferenciaDescansoLocal !== null
                    ? true
                    : (grupoConDescansoElegido[0]?.temporizadorDescanso ?? true)
              }
              descansoPersonalizadoSegundos={
                typeof preferenciaDescansoLocal === "number"
                  ? preferenciaDescansoLocal
                  : (grupoConDescansoElegido[0]?.descansoPersonalizadoSegundos ?? null)
              }
              onCambio={setPreferenciaDescansoLocal}
            />
          </>
        ) : undefined}
      />
    );
  };

  const grupoVisible = grupos[indiceVisible] ?? grupos[0];
  const grupoAnterior = grupos[indiceVisible - 1] ?? null;
  const grupoSiguiente = grupos[indiceVisible + 1] ?? null;
  // Se puede recorrer toda la sesión con las flechas, pero un ejercicio no se
  // registra hasta completar los grupos anteriores. La protección es visual y
  // no un candado de tres toques: sirve para mirar sin modificar por error.
  const grupoVisibleBloqueado = grupos
    .slice(0, indiceVisible)
    .some((grupo) => grupo.some((ejercicio) => !ejercicio.completado && !gruposTerminadosEnVista.has(ejercicio.sesionEjercicioId)));

  /* El RIR cambia de posición con el tamaño de pantalla y con el zoom. Las
     flechas del ejercicio individual se miden contra ese control real, no
     contra un porcentaje fijo del viewport. */
  /* A zoom normal un ejercicio individual no presenta un scroll vacío. Si el
     teléfono es bajo, o el alumno aumenta el tamaño, se conserva el scroll
     vertical para no cortar información. */
  useEffect(() => {
    const seccion = seccionEnfocadaRef.current;
    const scroll = seccion?.closest<HTMLElement>(".pantalla-scroll");
    if (!seccion || !scroll) return;
    let marco = 0;
    const actualizar = () => {
      window.cancelAnimationFrame(marco);
      marco = window.requestAnimationFrame(() => {
        const zoomNormal = document.documentElement.getAttribute("data-zoom-pantalla") === "1";
        const barraInferior = document.querySelector<HTMLElement>(".panel-aero-inferior");
        const limiteVisible = barraInferior
          ? barraInferior.getBoundingClientRect().top - 8
          : scroll.getBoundingClientRect().bottom - 8;
        /* No decidimos por scrollHeight: incluye el espacio de seguridad reservado
           para la barra inferior, aunque el ejercicio ya esté totalmente visible. */
        const cabe = seccion.getBoundingClientRect().bottom <= limiteVisible;
        /* Los grupos encadenados pueden crecer cuando avanza una ronda o se
           abre el descanso. Por eso solo un ejercicio individual se bloquea
           sin scroll; biseries, triseries y superseries siempre conservan su
           recorrido y el centrado del paso activo. */
        const esGrupo = Boolean(seccion.querySelector(".tarjeta-grupo-enfocada"));
        const ajustada = zoomNormal && !esGrupo && cabe;
        scroll.dataset.entrenamientoAjustado = ajustada ? "true" : "false";
        // Con una tarjeta que ya cabe no existe una posición útil distinta de
        // cero. Esto neutraliza tanto la restauración de scroll del navegador
        // como el anclaje que puede disparar el cambio de estado del descanso.
        if (ajustada && scroll.scrollTop !== 0) scroll.scrollTo({ top: 0, behavior: "auto" });
      });
    };
    const observador = new ResizeObserver(actualizar);
    observador.observe(seccion);
    observador.observe(scroll);
    const observadorHtml = new MutationObserver(actualizar);
    observadorHtml.observe(document.documentElement, { attributes: true, attributeFilter: ["data-zoom-pantalla", "style"] });
    actualizar();
    const restaurarVistaAjustada = () => {
      if (scroll.dataset.entrenamientoAjustado === "true" && scroll.scrollTop !== 0) {
        scroll.scrollTo({ top: 0, behavior: "auto" });
      }
    };
    scroll.addEventListener("scroll", restaurarVistaAjustada, { passive: true });
    // Las imágenes de referencia y la barra inferior terminan de medir luego
    // del primer frame; una segunda medición evita dejar un scroll residual.
    const revisionDiferida = window.setTimeout(actualizar, 260);
    // Safari y algunos WebViews restauran el scroll DESPUÉS de montar React.
    // Se corrige en tres momentos sin afectar las vistas que sí necesitan
    // desplazarse (zoom alto, biseries extensas, etc.).
    const revisionesRestauracion = [0, 350, 1100].map((demora) =>
      window.setTimeout(restaurarVistaAjustada, demora)
    );
    return () => {
      window.cancelAnimationFrame(marco);
      window.clearTimeout(revisionDiferida);
      revisionesRestauracion.forEach((id) => window.clearTimeout(id));
      scroll.removeEventListener("scroll", restaurarVistaAjustada);
      observador.disconnect();
      observadorHtml.disconnect();
      delete scroll.dataset.entrenamientoAjustado;
    };
  }, [indiceVisible, grupoVisible.length, grupoVisible[0]?.sesionEjercicioId]);

  useEffect(() => {
    hayGrupoSiguienteRef.current = Boolean(grupoSiguiente);
  }, [grupoSiguiente]);

  useEffect(() => {
    const mostrarAvisoSiguiente = () => {
      // En el último ejercicio no hay dirección a la cual guiar; la señal solo
      // aparece cuando la doble flecha derecha realmente puede llevar al paso
      // que continúa.
      if (!hayGrupoSiguienteRef.current) return;
      setAvisandoSiguienteEjercicio(true);
      if (avisoSiguienteTimeoutRef.current) clearTimeout(avisoSiguienteTimeoutRef.current);
      avisoSiguienteTimeoutRef.current = setTimeout(() => {
        setAvisandoSiguienteEjercicio(false);
        avisoSiguienteTimeoutRef.current = null;
      }, 4000);
    };
    window.addEventListener("vip:avisar-siguiente-ejercicio", mostrarAvisoSiguiente);
    return () => {
      window.removeEventListener("vip:avisar-siguiente-ejercicio", mostrarAvisoSiguiente);
      if (avisoSiguienteTimeoutRef.current) clearTimeout(avisoSiguienteTimeoutRef.current);
    };
  }, []);
  const avisarBloqueo = () => {
    setAvisoBloqueo(true);
    window.setTimeout(() => setAvisoBloqueo(false), 2200);
  };
  const indiceEjercicioVisible = Math.max(0, ejercicios.findIndex((ejercicio) => ejercicio.sesionEjercicioId === grupoVisible?.[0]?.sesionEjercicioId));
  // Mismo cálculo que usa el servidor al Finalizar (`calcularPuntosEntrenamiento`
  // en lib/ranking/reglas.ts): proporcional a ejercicios completados, no
  // todo-o-nada. Acá solo se PREVISUALIZA — los puntos reales se confirman
  // recién al finalizar la sesión.
  const puntosRankedPreparados = calcularPuntosEntrenamiento(completados, total);
  const porcentajeRutina = total > 0 ? Math.round((completados / total) * 100) : 0;

  // La corona de la cabecera (fuera de este árbol, en Logo.tsx) suma estos
  // puntos "preparados" a su saldo mientras dura la sesión, para que se vea
  // subir en vivo — igual que el título, que ya viaja por el mismo mecanismo.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("vip:puntos-en-vivo", { detail: puntosRankedPreparados }));
  }, [puntosRankedPreparados]);
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent("vip:puntos-en-vivo", { detail: 0 }));
    };
  }, []);

  return (
    <>
      {/* Dos motivos distintos para ver la rutina entera de una: mirarla sin
          poder tocarla (`soloLectura`) y corregirla (`modoCorreccion`). La
          diferencia está adentro de las tarjetas, que en corrección siguen
          siendo editables. */}
      {soloLectura || modoCorreccion ? (
        grupos.map((grupo) => renderizarGrupo(grupo))
      ) : grupoVisible ? (
        <section ref={seccionEnfocadaRef} className="modo-entrenamiento-enfocado" aria-label="Ejercicio actual">
          <header className="cabecera-sesion-foco">
            <p>{tituloSesion}</p>
            <div className="fila-progreso-y-menu">
              <div
                className="progreso-rutina-orientado"
                aria-label={`${grupoVisible.length > 1 ? `Bloque ${indiceVisible + 1} de ${grupos.length}` : `Ejercicio ${indiceEjercicioVisible + 1} de ${ejercicios.length}`}. Rutina completada al ${porcentajeRutina}%`}
              >
                <div className="linea-segmentos-progreso">
                  <div className="riel-progreso-onda" aria-hidden="true">
                    <span
                      className="relleno-progreso-onda"
                      style={{ width: `${porcentajeRutina}%` }}
                    >
                      <span className="onda-progreso-lenta" />
                    </span>
                  </div>
                  <small>{porcentajeRutina}%</small>
                </div>
              </div>
            </div>
          </header>

          <div className="contenedor-grupo-bloqueable" data-bloqueado={grupoVisibleBloqueado ? "true" : "false"}>
            {renderizarGrupo(grupoVisible, true)}
            {grupoVisibleBloqueado && (
              <button
                type="button"
                className="cristal-ejercicio-siguiente"
                onClick={avisarBloqueo}
                aria-label="Termina la serie anterior o márcala como hecha para registrar este ejercicio"
              />
            )}
            {grupoVisibleBloqueado && avisoBloqueo && (
              <p className="aviso-ejercicio-siguiente" role="status">
                Termina la serie anterior o márcala como hecha para registrar aquí.
              </p>
            )}
          </div>
          {grupoVisible.length >= 2 && <div className="acciones-excepcionales-sesion">
            {accionCancelarSesion && !soloLectura && !modoCorreccion && (
              <div className="accion-cancelar-sesion-cercana">{accionCancelarSesion}</div>
            )}
            <ControlDescansoSesion
              temporizadorActivo={
                preferenciaDescansoLocal === "libre"
                  ? false
                  : preferenciaDescansoLocal !== null
                    ? true
                    : (grupoVisible[0]?.temporizadorDescanso ?? true)
              }
              descansoPersonalizadoSegundos={
                typeof preferenciaDescansoLocal === "number"
                  ? preferenciaDescansoLocal
                  : (grupoVisible[0]?.descansoPersonalizadoSegundos ?? null)
              }
              onCambio={setPreferenciaDescansoLocal}
            />
          </div>}
          <nav className="navegacion-flotante-sesion" aria-label="Navegar entre ejercicios">
            <button
              type="button"
              onClick={() => irA(indiceVisible - 1)}
              disabled={!grupoAnterior}
              aria-label="Ejercicio anterior"
            >
              {/* strokeWidth más fino (pedido de Alejandro, 2026-08-16): la
                  elongación vertical vive en CSS (`.navegacion-flotante-sesion
                  svg { transform: scaleY(2.2) }`), no acá — así no hay que
                  tocar el `size` ni el layout del botón. */}
              <ChevronsLeft size={79} strokeWidth={0.32} />
            </button>
            <button
              type="button"
              onClick={() => irA(indiceVisible + 1)}
              disabled={!grupoSiguiente}
              aria-label="Siguiente ejercicio"
              data-aviso-siguiente={avisandoSiguienteEjercicio ? "true" : undefined}
            >
              <ChevronsRight size={79} strokeWidth={0.32} />
            </button>
          </nav>

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
      {/* "Guardar" suelto ya no existe: guardar y completar el ejercicio
          eran dos toques para una sola intención, y el segundo casi nunca
          llegaba. Ahora "Completar y guardar" (dentro de cada tarjeta)
          hace las dos cosas, y las series se siguen guardando solas al
          terminar cada descanso.

          El bloque entero (botón + recorrido de reserva) solo se dibuja en el
          ÚLTIMO ejercicio, que es cuando aparece "Finalizar entrenamiento".
          Antes se dibujaba siempre: en los otros seis ejercicios eran un div
          vacío y 64 px de aire que no mostraban nada y obligaban a hacer
          scroll en una pantalla que ya entraba entera (pedido de Alejandro,
          2026-08-16). El contenedor que hace scroll ya reserva por su cuenta
          el alto de la barra inferior (`pb-24`), así que los paneles de
          nota/molestia siguen pudiendo subir por encima de las barras fijas. */}
      {!soloLectura && !modoCorreccion && indiceVisible === grupos.length - 1 && (
        <>
          <div className="flex flex-col gap-2">
            <FinalizarEntrenamiento sesionId={sesionId} completados={completados} total={total} compacto />
          </div>
          <div className="h-16" aria-hidden="true" />
        </>
      )}
    </>
  );
}
