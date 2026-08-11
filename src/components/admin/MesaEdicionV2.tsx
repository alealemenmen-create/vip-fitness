"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileCheck2,
  GitCompareArrows,
  History,
  LoaderCircle,
  Plus,
  Replace,
  Rocket,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import type { ResultadoMotorDosisV2 } from "@/lib/generador-rutinas-v2/dosis";
import {
  grupoDosisDelEjercicioV2,
  obtenerCatalogoElegibleVipV2,
  type DiaSemanaV2,
  type EjercicioConstructorV2,
  type EjercicioSemanaV2,
  type ResultadoConstructorSemanalV2,
} from "@/lib/generador-rutinas-v2/constructor-semanal";
import type { EntrevistaVipV2, GrupoDosisV2 } from "@/lib/generador-rutinas-v2/tipos";
import {
  actualizarPrescripcionMesaV2,
  agregarEjercicioMesaV2,
  auditarMesaEdicionVipV2,
  copiarDiasMesaV2,
  eliminarEjercicioMesaV2,
  moverDiaMesaV2,
  moverEjercicioMesaV2,
  reemplazarEjercicioMesaV2,
} from "@/lib/generador-rutinas-v2/mesa-edicion";
import {
  guardarBorradorVersionadoV2,
  publicarBorradorVersionadoV2,
  revertirRutinaVersionadaV2,
  type ResultadoGuardarVersionV2,
  type ResultadoPublicarVersionV2,
  type ResultadoRevertirVersionV2,
} from "@/app/admin/generador-v2/actions";

const NOMBRE_GRUPO: Record<GrupoDosisV2, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  brazos: "Brazos",
  cuadriceps: "Cuádriceps",
  femorales: "Femorales",
  gluteos: "Glúteos",
  pantorrillas: "Pantorrillas",
  core: "Core",
};

const RIR_OPCIONES = ["0", "0–1", "1–2", "2–3", "3–4", "4–5"];
const CAMPO = "w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-sm text-text outline-none transition focus:border-vip/60 focus:ring-2 focus:ring-vip/10";

type Props = {
  alumnoId: string;
  entrevista: EntrevistaVipV2;
  dosis: ResultadoMotorDosisV2;
  borrador: ResultadoConstructorSemanalV2;
  catalogo: EjercicioConstructorV2[];
};

type Confirmaciones = { seleccion: boolean; orden: boolean; tiempo: boolean };
type GuardadoMesa = { version: 1; alumnoId: string; dias: DiaSemanaV2[] };

function claveMesa(alumnoId: string) {
  return `vip:mesa-edicion-v2:v1:${alumnoId}`;
}

function esGuardadoMesa(valor: unknown, alumnoId: string): valor is GuardadoMesa {
  if (!valor || typeof valor !== "object") return false;
  const guardado = valor as Partial<GuardadoMesa>;
  return guardado.version === 1
    && guardado.alumnoId === alumnoId
    && Array.isArray(guardado.dias)
    && guardado.dias.every((dia) => dia && typeof dia === "object" && Array.isArray(dia.ejercicios)
      && dia.ejercicios.every((ejercicio) => ejercicio && typeof ejercicio === "object" && Array.isArray(ejercicio.sustituciones)));
}

function descansoMedio(rango: readonly [number, number] | null, respaldo: number) {
  if (!rango) return respaldo;
  return Math.round((rango[0] + rango[1]) / 2 / 15) * 15;
}

function crearEjercicioAgregado(
  candidato: EjercicioConstructorV2,
  grupo: GrupoDosisV2,
  dias: DiaSemanaV2[],
  dosis: ResultadoMotorDosisV2,
  opcionesGrupo: EjercicioConstructorV2[],
): EjercicioSemanaV2 {
  const referencia = dias.flatMap((dia) => dia.ejercicios).find((ejercicio) => ejercicio.grupoDosis === grupo);
  const compuesto = candidato.posicionSesion === "principal" || ["empuje", "traccion", "pierna", "full_body"].includes(candidato.categoria);
  const rir = (compuesto ? dosis.intensidad.rirCompuestos : dosis.intensidad.rirAislamientos)?.join("–") ?? "2–3";
  const descanso = compuesto
    ? descansoMedio(dosis.intensidad.descansoCompuestosSegundos, 120)
    : descansoMedio(dosis.intensidad.descansoAislamientosSegundos, 75);
  return {
    orden: 0,
    ejercicioId: candidato.id,
    nombre: candidato.nombre,
    grupoDosis: grupo,
    patron: candidato.patron,
    series: referencia?.series ?? 3,
    repeticiones: referencia?.repeticiones ?? (compuesto ? "6–10" : "10–15"),
    rir: referencia?.rir ?? rir,
    descansoSegundos: referencia?.descansoSegundos ?? descanso,
    motivo: "Añadido por el entrenador desde el catálogo compatible de esta persona.",
    sustituciones: opcionesGrupo
      .filter((item) => item.id !== candidato.id)
      .sort((a, b) => Number(b.patron === candidato.patron) - Number(a.patron === candidato.patron) || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 2)
      .map((item) => ({ ejercicioId: item.id, nombre: item.nombre, patron: item.patron })),
  };
}

export function MesaEdicionV2({ alumnoId, entrevista, dosis, borrador, catalogo }: Props) {
  const [dias, setDias] = useState(() => copiarDiasMesaV2(borrador.dias));
  const [confirmaciones, setConfirmaciones] = useState<Confirmaciones>({ seleccion: false, orden: false, tiempo: false });
  const [aprobada, setAprobada] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [publicacion, setPublicacion] = useState<Extract<ResultadoGuardarVersionV2, { ok: true }> | null>(null);
  const [resultadoPublicado, setResultadoPublicado] = useState<Extract<ResultadoPublicarVersionV2, { ok: true }> | null>(null);
  const [resultadoReversion, setResultadoReversion] = useState<Extract<ResultadoRevertirVersionV2, { ok: true }> | null>(null);
  const [confirmacionPublicar, setConfirmacionPublicar] = useState("");
  const [confirmacionRevertir, setConfirmacionRevertir] = useState("");
  const [errorPublicacion, setErrorPublicacion] = useState("");
  const [pendiente, iniciarTransicion] = useTransition();
  const elegibles = useMemo(() => obtenerCatalogoElegibleVipV2(entrevista, dosis, catalogo), [entrevista, dosis, catalogo]);
  const porGrupo = useMemo(() => {
    const mapa = new Map<GrupoDosisV2, EjercicioConstructorV2[]>();
    for (const candidato of elegibles) {
      const grupo = grupoDosisDelEjercicioV2(candidato);
      if (!grupo) continue;
      const lista = mapa.get(grupo) ?? [];
      lista.push(candidato);
      mapa.set(grupo, lista);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return mapa;
  }, [elegibles]);
  const auditoria = useMemo(() => auditarMesaEdicionVipV2(dias, dosis, borrador), [dias, dosis, borrador]);
  const confirmacionCompleta = confirmaciones.seleccion && confirmaciones.orden && confirmaciones.tiempo;

  if (borrador.estado === "no_disponible") {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-vip/10 p-2 text-vip"><SlidersHorizontal size={20} /></span><div><h2 className="font-bold text-text">Mesa de Edición VIP 2.0</h2><p className="mt-1 text-sm text-text-secondary">Se habilitará cuando exista una semana para editar.</p></div></div>
      </section>
    );
  }

  const aplicar = (transformar: (actual: DiaSemanaV2[]) => DiaSemanaV2[]) => {
    setDias((actual) => transformar(actual));
    setAprobada(false);
    setMensaje("");
    setPublicacion(null);
    setResultadoPublicado(null);
    setResultadoReversion(null);
    setConfirmacionPublicar("");
    setConfirmacionRevertir("");
    setErrorPublicacion("");
  };

  const reemplazar = (diaNumero: number, ejercicio: EjercicioSemanaV2, candidatoId: string) => {
    const opciones = porGrupo.get(ejercicio.grupoDosis) ?? [];
    const candidato = opciones.find((item) => item.id === candidatoId);
    if (!candidato) return;
    aplicar((actual) => reemplazarEjercicioMesaV2(actual, diaNumero, ejercicio.orden, {
      ejercicioId: candidato.id,
      nombre: candidato.nombre,
      grupoDosis: ejercicio.grupoDosis,
      patron: candidato.patron,
      motivo: "Reemplazado por el entrenador con una opción compatible del mismo grupo objetivo.",
      sustituciones: opciones
        .filter((item) => item.id !== candidato.id)
        .sort((a, b) => Number(b.patron === candidato.patron) - Number(a.patron === candidato.patron) || a.nombre.localeCompare(b.nombre, "es"))
        .slice(0, 2)
        .map((item) => ({ ejercicioId: item.id, nombre: item.nombre, patron: item.patron })),
    }));
  };

  const agregar = (diaNumero: number, candidatoId: string) => {
    const candidato = elegibles.find((item) => item.id === candidatoId);
    const grupo = candidato ? grupoDosisDelEjercicioV2(candidato) : null;
    if (!candidato || !grupo) return;
    const ejercicio = crearEjercicioAgregado(candidato, grupo, dias, dosis, porGrupo.get(grupo) ?? []);
    aplicar((actual) => agregarEjercicioMesaV2(actual, diaNumero, ejercicio));
  };

  const guardar = () => {
    const guardado: GuardadoMesa = { version: 1, alumnoId, dias };
    window.localStorage.setItem(claveMesa(alumnoId), JSON.stringify(guardado));
    setMensaje("Edición guardada en este dispositivo.");
  };

  const recuperar = () => {
    try {
      const raw = window.localStorage.getItem(claveMesa(alumnoId));
      const guardado: unknown = raw ? JSON.parse(raw) : null;
      if (!esGuardadoMesa(guardado, alumnoId)) {
        setMensaje("No hay una edición guardada compatible para esta persona.");
        return;
      }
      setDias(copiarDiasMesaV2(guardado.dias));
      setAprobada(false);
      setMensaje("Edición recuperada y reauditada.");
    } catch {
      setMensaje("No fue posible recuperar esa edición.");
    }
  };

  const reiniciar = () => {
    setDias(copiarDiasMesaV2(borrador.dias));
    setConfirmaciones({ seleccion: false, orden: false, tiempo: false });
    setAprobada(false);
    setPublicacion(null);
    setResultadoPublicado(null);
    setResultadoReversion(null);
    setConfirmacionPublicar("");
    setConfirmacionRevertir("");
    setErrorPublicacion("");
    setMensaje("Se restauró el borrador generado por el motor.");
  };

  const guardarVersion = () => {
    if (!aprobada || pendiente) return;
    setErrorPublicacion("");
    iniciarTransicion(async () => {
      const resultado = await guardarBorradorVersionadoV2({ alumnoId, entrevista, dias });
      if (!resultado.ok) {
        setErrorPublicacion(resultado.error);
        return;
      }
      setPublicacion(resultado);
      setResultadoPublicado(null);
      setResultadoReversion(null);
      setConfirmacionPublicar("");
      setMensaje("Borrador versionado guardado y comparado con la rutina activa.");
    });
  };

  const publicarVersion = () => {
    if (!publicacion || confirmacionPublicar !== "PUBLICAR" || pendiente) return;
    setErrorPublicacion("");
    iniciarTransicion(async () => {
      const resultado = await publicarBorradorVersionadoV2(publicacion.borradorId, confirmacionPublicar);
      if (!resultado.ok) {
        setErrorPublicacion(resultado.error);
        return;
      }
      setResultadoPublicado(resultado);
      setConfirmacionPublicar("");
      setMensaje(`Versión ${resultado.version} publicada. La versión anterior permanece en el historial.`);
    });
  };

  const revertirVersion = () => {
    const destino = publicacion?.comparacion.activa;
    if (!destino || confirmacionRevertir !== "REVERTIR" || pendiente) return;
    setErrorPublicacion("");
    iniciarTransicion(async () => {
      const resultado = await revertirRutinaVersionadaV2(destino.id, confirmacionRevertir);
      if (!resultado.ok) {
        setErrorPublicacion(resultado.error);
        return;
      }
      setResultadoReversion(resultado);
      setConfirmacionRevertir("");
      setMensaje(`Versión ${resultado.version} restaurada sin borrar el historial.`);
    });
  };

  const estadoTexto = auditoria.estado === "lista_para_aprobar"
    ? "Auditoría correcta"
    : auditoria.estado === "bloqueada_revision"
      ? "Revisión profesional pendiente"
      : "Hay ajustes pendientes";
  const estadoClase = auditoria.estado === "lista_para_aprobar"
    ? "bg-success/10 text-success"
    : "bg-warning/10 text-warning";

  return (
    <section className="rounded-2xl border border-vip/25 bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-vip/10 p-2 text-vip"><SlidersHorizontal size={20} /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-vip">Proyecto aprobado</p>
            <h2 className="mt-0.5 font-bold text-text">Mesa de Edición VIP 2.0</h2>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">Corrige ejercicios y prescripciones. Cada movimiento vuelve a auditar dosis, frecuencia, máximos por sesión y tiempo.</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${estadoClase}`}>{estadoTexto}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={guardar} className="inline-flex items-center gap-2 rounded-xl bg-vip px-3 py-2 text-sm font-bold text-white"><Save size={15} /> Guardar edición</button>
        <button type="button" onClick={recuperar} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text"><Undo2 size={15} /> Recuperar</button>
        <button type="button" onClick={reiniciar} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-text-secondary hover:text-text"><RotateCcw size={15} /> Restaurar motor</button>
        {mensaje ? <p role="status" className="self-center text-sm text-text-secondary">{mensaje}</p> : null}
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Cambios manuales</dt><dd className="mt-1 font-bold text-text">{auditoria.cambiosRespectoAlBorrador}</dd></div>
        <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Series</dt><dd className={`mt-1 font-bold ${auditoria.seriesEditadas === auditoria.seriesObjetivo ? "text-success" : "text-warning"}`}>{auditoria.seriesEditadas}/{auditoria.seriesObjetivo}</dd></div>
        <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Alertas bloqueantes</dt><dd className={`mt-1 font-bold ${auditoria.alertasBloqueantes.length === 0 ? "text-success" : "text-warning"}`}>{auditoria.alertasBloqueantes.length}</dd></div>
        <div className="rounded-xl bg-bg p-3"><dt className="text-xs text-text-tertiary">Catálogo compatible</dt><dd className="mt-1 font-bold text-text">{elegibles.length} ejercicios</dd></div>
      </dl>

      {auditoria.alertasBloqueantes.length > 0 ? (
        <div className="mt-4 rounded-xl border border-warning/25 bg-warning/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-text"><AlertTriangle size={16} className="text-warning" /> Corrige esto antes de aprobar</p>
          <ul className="mt-2 grid gap-2 text-sm text-text-secondary lg:grid-cols-2">{auditoria.alertasBloqueantes.map((alerta) => <li key={alerta} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{alerta}</li>)}</ul>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm font-semibold text-success"><CheckCircle2 size={17} /> La edición conserva la dosis, frecuencia, máximos por sesión y tiempo.</p>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {dias.map((dia, indiceDia) => (
          <article key={`${dia.numero}-${dia.nombre}`} className="min-w-0 overflow-hidden rounded-2xl border border-border [content-visibility:auto]">
            <header className="bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-vip">Día {dia.numero}</p><h3 className="mt-0.5 font-bold text-text">{dia.nombre}</h3><p className="mt-1 text-xs text-text-secondary">{dia.ejercicios.reduce((total, ejercicio) => total + ejercicio.series, 0)} series · {auditoria.porDia.find((item) => item.numero === dia.numero)?.minutosEstimados ?? 0} min</p></div>
                <div className="flex gap-1">
                  <button type="button" disabled={indiceDia === 0} onClick={() => aplicar((actual) => moverDiaMesaV2(actual, dia.numero, -1))} aria-label={`Mover día ${dia.numero} hacia arriba`} className="rounded-lg border border-border p-2 text-text-secondary disabled:opacity-30"><ArrowUp size={15} /></button>
                  <button type="button" disabled={indiceDia === dias.length - 1} onClick={() => aplicar((actual) => moverDiaMesaV2(actual, dia.numero, 1))} aria-label={`Mover día ${dia.numero} hacia abajo`} className="rounded-lg border border-border p-2 text-text-secondary disabled:opacity-30"><ArrowDown size={15} /></button>
                </div>
              </div>
            </header>

            <ol className="divide-y divide-border">
              {dia.ejercicios.map((ejercicio, indiceEjercicio) => {
                const opciones = porGrupo.get(ejercicio.grupoDosis) ?? [];
                return (
                  <li key={`${dia.numero}-${ejercicio.orden}-${ejercicio.ejercicioId}`} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-vip/10 text-xs font-bold text-vip">{ejercicio.orden}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="font-semibold text-text">{ejercicio.nombre}</p><p className="mt-0.5 text-xs text-text-tertiary">{NOMBRE_GRUPO[ejercicio.grupoDosis]} · {ejercicio.patron.replaceAll("_", " ")}</p></div>
                          <div className="flex shrink-0 gap-1">
                            <button type="button" disabled={indiceEjercicio === 0} onClick={() => aplicar((actual) => moverEjercicioMesaV2(actual, dia.numero, ejercicio.orden, -1))} aria-label={`Subir ${ejercicio.nombre}`} className="rounded-lg border border-border p-1.5 text-text-secondary disabled:opacity-30"><ArrowUp size={14} /></button>
                            <button type="button" disabled={indiceEjercicio === dia.ejercicios.length - 1} onClick={() => aplicar((actual) => moverEjercicioMesaV2(actual, dia.numero, ejercicio.orden, 1))} aria-label={`Bajar ${ejercicio.nombre}`} className="rounded-lg border border-border p-1.5 text-text-secondary disabled:opacity-30"><ArrowDown size={14} /></button>
                            <button type="button" onClick={() => aplicar((actual) => eliminarEjercicioMesaV2(actual, dia.numero, ejercicio.orden))} aria-label={`Eliminar ${ejercicio.nombre}`} className="rounded-lg border border-error/20 p-1.5 text-error"><Trash2 size={14} /></button>
                          </div>
                        </div>

                        <label className="mt-3 block"><span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text-secondary"><Replace size={13} /> Reemplazar por</span><select aria-label={`Reemplazar ${ejercicio.nombre}`} className={CAMPO} value={ejercicio.ejercicioId} onChange={(event) => reemplazar(dia.numero, ejercicio, event.target.value)}>{opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.nombre}{opcion.patron === ejercicio.patron ? " · mismo patrón" : ""}</option>)}</select></label>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <label><span className="mb-1 block text-xs font-semibold text-text-secondary">Series</span><input aria-label={`Series de ${ejercicio.nombre}`} className={CAMPO} type="number" min={1} max={8} value={ejercicio.series} onChange={(event) => aplicar((actual) => actualizarPrescripcionMesaV2(actual, dia.numero, ejercicio.orden, { series: Number(event.target.value) }))} /></label>
                          <label><span className="mb-1 block text-xs font-semibold text-text-secondary">Repeticiones</span><input aria-label={`Repeticiones de ${ejercicio.nombre}`} className={CAMPO} value={ejercicio.repeticiones} onChange={(event) => aplicar((actual) => actualizarPrescripcionMesaV2(actual, dia.numero, ejercicio.orden, { repeticiones: event.target.value }))} /></label>
                          <label><span className="mb-1 block text-xs font-semibold text-text-secondary">RIR</span><select aria-label={`RIR de ${ejercicio.nombre}`} className={CAMPO} value={ejercicio.rir} onChange={(event) => aplicar((actual) => actualizarPrescripcionMesaV2(actual, dia.numero, ejercicio.orden, { rir: event.target.value }))}>{RIR_OPCIONES.includes(ejercicio.rir) ? null : <option value={ejercicio.rir}>{ejercicio.rir}</option>}{RIR_OPCIONES.map((rir) => <option key={rir} value={rir}>{rir}</option>)}</select></label>
                          <label><span className="mb-1 block text-xs font-semibold text-text-secondary">Descanso</span><select aria-label={`Descanso de ${ejercicio.nombre}`} className={CAMPO} value={ejercicio.descansoSegundos} onChange={(event) => aplicar((actual) => actualizarPrescripcionMesaV2(actual, dia.numero, ejercicio.orden, { descansoSegundos: Number(event.target.value) }))}>{Array.from({ length: 19 }, (_, indice) => 30 + indice * 15).map((segundos) => <option key={segundos} value={segundos}>{segundos} s</option>)}</select></label>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="border-t border-border bg-bg p-3">
              <label><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary"><Plus size={13} /> Añadir ejercicio compatible</span><select aria-label={`Añadir ejercicio al día ${dia.numero}`} className={CAMPO} value="" onChange={(event) => agregar(dia.numero, event.target.value)}><option value="">Seleccionar ejercicio…</option>{elegibles.filter((opcion) => !dia.ejercicios.some((ejercicio) => ejercicio.ejercicioId === opcion.id)).map((opcion) => { const grupo = grupoDosisDelEjercicioV2(opcion); return <option key={opcion.id} value={opcion.id}>{grupo ? `${NOMBRE_GRUPO[grupo]} · ` : ""}{opcion.nombre}</option>; })}</select></label>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text">Auditoría después de editar</h3>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-bg text-xs uppercase tracking-wide text-text-tertiary"><tr><th className="px-3 py-2.5">Grupo</th><th className="px-3 py-2.5">Series</th><th className="px-3 py-2.5">Frecuencia</th><th className="px-3 py-2.5">Estado</th></tr></thead>
              <tbody className="divide-y divide-border">{auditoria.porGrupo.map((grupo) => { const cumple = grupo.cumpleSeries && grupo.cumpleFrecuencia; return <tr key={grupo.grupo}><th className="px-3 py-2.5 font-semibold text-text">{NOMBRE_GRUPO[grupo.grupo]}</th><td className="px-3 py-2.5 text-text-secondary">{grupo.objetivoSeries} → {grupo.seriesEditadas}</td><td className="px-3 py-2.5 text-text-secondary">{grupo.objetivoFrecuencia}× → {grupo.frecuenciaEditada}×</td><td className={`px-3 py-2.5 font-semibold ${cumple ? "text-success" : "text-warning"}`}>{cumple ? "Cumple" : "Revisar"}</td></tr>; })}</tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-bg p-4">
          <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-vip" /><h3 className="font-bold text-text">Control final del entrenador</h3></div>
          <div className="mt-4 space-y-2">{([
            ["seleccion", "Revisé ejercicios y reemplazos"],
            ["orden", "Revisé el orden técnico de cada sesión"],
            ["tiempo", "Confirmé que el tiempo es realista"],
          ] as const).map(([clave, etiqueta]) => <label key={clave} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-secondary"><input type="checkbox" checked={confirmaciones[clave]} onChange={(event) => { setConfirmaciones((actual) => ({ ...actual, [clave]: event.target.checked })); setAprobada(false); setPublicacion(null); setResultadoPublicado(null); setResultadoReversion(null); setErrorPublicacion(""); }} className="mt-0.5 h-4 w-4 accent-vip" />{etiqueta}</label>)}</div>
          <button type="button" disabled={!auditoria.puedeAprobar || !confirmacionCompleta} onClick={() => setAprobada(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35"><FileCheck2 size={17} /> Aprobar borrador editado</button>
          {aprobada ? <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm font-semibold text-success"><CheckCircle2 size={17} className="mt-0.5 shrink-0" /> Borrador aprobado localmente por el entrenador.</p> : null}
          <button type="button" disabled={!aprobada || pendiente} onClick={guardarVersion} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-vip px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{pendiente ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Guardar borrador versionado</button>
          <p className="mt-3 text-xs leading-relaxed text-text-tertiary">Guardar todavía no publica. El servidor repite la auditoría y prepara una comparación contra la versión activa.</p>
        </aside>
      </div>

      {errorPublicacion ? (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-error/25 bg-error/5 p-4 text-sm font-semibold text-error"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{errorPublicacion}</p>
      ) : null}

      {publicacion ? (
        <section className="mt-5 overflow-hidden rounded-2xl border border-vip/25 bg-bg">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-vip/5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-vip/10 p-2 text-vip"><GitCompareArrows size={20} /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-vip">Publicación Versionada VIP 2.0</p>
                <h3 className="mt-0.5 font-bold text-text">Comparación antes de publicar</h3>
                <p className="mt-1 text-sm text-text-secondary">{publicacion.nombreRutina}</p>
              </div>
            </div>
            <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-text-secondary">Borrador v{publicacion.comparacion.versionPropuesta} guardado</span>
          </header>

          <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0 space-y-4">
              {publicacion.comparacion.esPrimeraVersion ? (
                <p className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-text-secondary"><strong className="text-success">Primera versión.</strong> No existe una rutina activa que reemplazar.</p>
              ) : (
                <p className="rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">Se conservará <strong className="text-text">{publicacion.comparacion.activa?.nombre}</strong> como versión histórica y la nueva pasará a ser la activa.</p>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ["Días", publicacion.comparacion.resumenActivo.dias, publicacion.comparacion.resumenPropuesto.dias],
                  ["Ejercicios", publicacion.comparacion.resumenActivo.ejercicios, publicacion.comparacion.resumenPropuesto.ejercicios],
                  ["Series directas", publicacion.comparacion.resumenActivo.series, publicacion.comparacion.resumenPropuesto.series],
                ] as const).map(([etiqueta, anterior, nuevo]) => (
                  <div key={etiqueta} className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-xs text-text-tertiary">{etiqueta}</p>
                    <p className="mt-1 text-lg font-bold text-text"><span className="text-text-secondary">{anterior}</span> → {nuevo}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-surface p-4"><p className="text-sm font-bold text-text">Ejercicios incorporados</p>{publicacion.comparacion.ejerciciosAgregados.length ? <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">{publicacion.comparacion.ejerciciosAgregados.map((nombre, indice) => <li key={`${nombre}-${indice}`} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />{nombre}</li>)}</ul> : <p className="mt-2 text-sm text-text-tertiary">Sin incorporaciones.</p>}</div>
                <div className="rounded-xl border border-border bg-surface p-4"><p className="text-sm font-bold text-text">Ejercicios retirados</p>{publicacion.comparacion.ejerciciosRetirados.length ? <ul className="mt-2 space-y-1.5 text-sm text-text-secondary">{publicacion.comparacion.ejerciciosRetirados.map((nombre, indice) => <li key={`${nombre}-${indice}`} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{nombre}</li>)}</ul> : <p className="mt-2 text-sm text-text-tertiary">Sin retiros.</p>}</div>
              </div>
            </div>

            <aside className="rounded-2xl border border-border bg-surface p-4">
              {resultadoPublicado ? (
                <div>
                  <p role="status" className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm font-semibold text-success"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />Versión {resultadoPublicado.version} publicada correctamente.</p>
                  <Link href="/admin/rutinas-generadas" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-text-secondary hover:text-text"><History size={16} /> Ver historial de rutinas</Link>
                  {publicacion.comparacion.activa && !resultadoReversion ? (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="text-sm font-bold text-text">Reversión segura</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-tertiary">Para volver a la versión {publicacion.comparacion.activa.version}, escribe <strong className="text-text">REVERTIR</strong>. No se borra ninguna versión.</p>
                      <input aria-label="Confirmación para revertir" className={`${CAMPO} mt-3`} value={confirmacionRevertir} onChange={(event) => setConfirmacionRevertir(event.target.value.toUpperCase())} placeholder="REVERTIR" autoComplete="off" />
                      <button type="button" disabled={confirmacionRevertir !== "REVERTIR" || pendiente} onClick={revertirVersion} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-warning/30 px-4 py-2.5 text-sm font-bold text-warning disabled:opacity-35">{pendiente ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />} Restaurar versión {publicacion.comparacion.activa.version}</button>
                    </div>
                  ) : null}
                  {resultadoReversion ? <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-success/20 bg-success/5 p-3 text-sm font-semibold text-success"><CheckCircle2 size={17} className="mt-0.5 shrink-0" />Versión {resultadoReversion.version} restaurada. La publicación nueva quedó en el historial.</p> : null}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-vip" /><h4 className="font-bold text-text">Confirmación de publicación</h4></div>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">La operación es transaccional: si algo falla, la rutina activa no cambia.</p>
                  <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-text-secondary">Escribe PUBLICAR</span><input aria-label="Confirmación para publicar" className={CAMPO} value={confirmacionPublicar} onChange={(event) => setConfirmacionPublicar(event.target.value.toUpperCase())} placeholder="PUBLICAR" autoComplete="off" /></label>
                  <button type="button" disabled={confirmacionPublicar !== "PUBLICAR" || pendiente} onClick={publicarVersion} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-35">{pendiente ? <LoaderCircle size={16} className="animate-spin" /> : <Rocket size={16} />} Publicar versión {publicacion.comparacion.versionPropuesta}</button>
                  <p className="mt-3 text-xs leading-relaxed text-text-tertiary">Si otra pestaña cambió la rutina activa después de guardar este borrador, el servidor bloqueará la publicación y pedirá una comparación nueva.</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      ) : null}
    </section>
  );
}
