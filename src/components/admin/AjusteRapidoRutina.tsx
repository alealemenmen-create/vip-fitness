"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Check, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ajustarNumerosRutina, type CambioNumeros, type RutinaNumeros } from "@/app/admin/rutinas-generadas/actions";

/**
 * Cambiar SOLO los números de una rutina ya publicada: series, repeticiones y
 * descanso. Nada de ejercicios, técnicas ni días — para eso está "Abrir", que
 * republica como copia.
 *
 * Existe por un caso concreto: un alumno pide bajar de 4 series a 3 en toda la
 * rutina y hacerlo por la mesa de trabajo completa es rehacerla entera. Acá son
 * dos toques ("aplicar a todos" + guardar) y, sobre todo, se edita la rutina
 * que ya está — así el alumno no pierde su progresión de Impulso VIP, que
 * cuelga de la fila del ejercicio (ver `ajustarNumerosRutina`).
 */

type Edicion = { series: string; reps: string; descanso: string };

function aTexto(valor: number | null): string {
  return valor === null ? "" : String(valor);
}

export function AjusteRapidoRutina({
  rutina,
  alumnoNombre,
  onVolver,
  onGuardado,
}: {
  rutina: RutinaNumeros;
  alumnoNombre: string;
  onVolver: () => void;
  onGuardado: () => void;
}) {
  const inicial = useMemo(() => {
    const mapa = new Map<string, Edicion>();
    for (const dia of rutina.dias) {
      for (const ej of dia.ejercicios) {
        mapa.set(ej.id, {
          series: String(ej.series),
          reps: ej.reps,
          descanso: aTexto(ej.descansoSegundos),
        });
      }
    }
    return mapa;
  }, [rutina]);

  // Estado y no memo: al guardar, lo recién guardado pasa a ser el nuevo punto
  // de comparación, así el contador de cambios vuelve a cero sin recargar.
  const [originales, setOriginales] = useState<Map<string, Edicion>>(() => new Map(inicial));
  const [ediciones, setEediciones] = useState<Map<string, Edicion>>(() => new Map(inicial));
  const [seriesParaTodos, setSeriesParaTodos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [guardando, iniciar] = useTransition();

  const editar = (id: string, campo: keyof Edicion, valor: string) => {
    setGuardado(false);
    setEediciones((previo) => {
      const copia = new Map(previo);
      const actual = copia.get(id);
      if (actual) copia.set(id, { ...actual, [campo]: valor });
      return copia;
    });
  };

  const aplicarSeriesATodos = () => {
    const valor = seriesParaTodos.trim();
    if (!valor) return;
    setGuardado(false);
    setEediciones((previo) => {
      const copia = new Map(previo);
      for (const [id, edicion] of copia) copia.set(id, { ...edicion, series: valor });
      return copia;
    });
  };

  const cambiados = useMemo(() => {
    const lista: string[] = [];
    for (const [id, edicion] of ediciones) {
      const original = originales.get(id);
      if (!original) continue;
      if (
        edicion.series !== original.series
        || edicion.reps !== original.reps
        || edicion.descanso !== original.descanso
      ) {
        lista.push(id);
      }
    }
    return lista;
  }, [ediciones, originales]);

  const guardar = () => {
    setError(null);
    const cambios: CambioNumeros[] = [];
    for (const id of cambiados) {
      const edicion = ediciones.get(id)!;
      const series = Number(edicion.series);
      if (!Number.isInteger(series) || series < 1) {
        return setError("Hay un número de series que no es válido.");
      }
      const descansoTexto = edicion.descanso.trim();
      const descanso = descansoTexto === "" ? null : Number(descansoTexto);
      if (descanso !== null && (!Number.isInteger(descanso) || descanso < 0)) {
        return setError("Hay un descanso que no es válido.");
      }
      cambios.push({ id, series, reps: edicion.reps.trim(), descansoSegundos: descanso });
    }

    iniciar(async () => {
      const resultado = await ajustarNumerosRutina(rutina.rutinaId, cambios);
      if (!resultado.ok) return setError(resultado.error);
      setOriginales(new Map(ediciones));
      setGuardado(true);
      onGuardado();
    });
  };

  const bloqueado = rutina.sesionEnProgreso;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#8fb7d8]"
        >
          <ArrowLeft size={13} /> Volver a sus rutinas
        </button>
        <p className="text-caption min-w-0 flex-1 truncate font-semibold text-text">{alumnoNombre}</p>
      </div>

      <Card padding="p-3" className="space-y-2">
        <div>
          <p className="text-secondary font-medium text-text">Ajuste rápido · {rutina.nombre}</p>
          <p className="text-micro mt-0.5 leading-snug text-text-tertiary">
            Cambia series, repeticiones y descanso sobre esta misma rutina. No crea una rutina nueva:
            el alumno conserva su progresión de Impulso VIP y todo su historial. Para cambiar
            ejercicios o técnicas, usa “Abrir”.
          </p>
        </div>

        {bloqueado && (
          <p className="text-caption rounded-xl border border-warning/40 bg-warning/10 px-2.5 py-2 font-semibold text-warning">
            {alumnoNombre} tiene un entrenamiento abierto ahora mismo. Espera a que lo cierre para no
            cambiarle los números mientras entrena.
          </p>
        )}

        {!bloqueado && (
          <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-2.5 py-2">
            <Wand2 size={14} className="shrink-0 text-vip" />
            <span className="text-micro shrink-0 text-text-secondary">Todos a</span>
            <input
              value={seriesParaTodos}
              onChange={(e) => setSeriesParaTodos(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="3"
              aria-label="Series para todos los ejercicios"
              className="text-caption radius-control w-12 border border-border bg-surface px-2 py-1 text-center text-text outline-none"
            />
            <span className="text-micro shrink-0 text-text-secondary">series</span>
            <button
              type="button"
              onClick={aplicarSeriesATodos}
              disabled={!seriesParaTodos.trim()}
              className="text-micro ml-auto shrink-0 font-semibold text-[#4f83b7] disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        )}
      </Card>

      {rutina.dias.map((dia) => (
        <Card key={dia.id} padding="p-3" className="space-y-1.5">
          <p className="text-caption font-semibold text-text">{dia.nombre}</p>
          <div className="text-micro flex items-center gap-2 px-1 text-text-tertiary">
            <span className="min-w-0 flex-1">Ejercicio</span>
            <span className="w-12 shrink-0 text-center">Series</span>
            <span className="w-16 shrink-0 text-center">Reps</span>
            <span className="w-14 shrink-0 text-center">Desc.</span>
          </div>
          {dia.ejercicios.map((ej) => {
            const edicion = ediciones.get(ej.id);
            if (!edicion) return null;
            const cambiado = cambiados.includes(ej.id);
            return (
              <div
                key={ej.id}
                className={`radius-control flex items-center gap-2 border px-2 py-1.5 ${
                  cambiado ? "border-vip/50 bg-vip/5" : "border-border bg-surface-2"
                }`}
              >
                <span className="text-caption min-w-0 flex-1 truncate text-text">
                  {ej.nombre}
                  {ej.tecnicaTipo && (
                    <span className="text-micro block truncate text-text-tertiary">{ej.tecnicaTipo}</span>
                  )}
                </span>
                <input
                  value={edicion.series}
                  onChange={(e) => editar(ej.id, "series", e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={bloqueado}
                  inputMode="numeric"
                  aria-label={`Series de ${ej.nombre}`}
                  className="text-caption radius-control w-12 shrink-0 border border-border bg-surface px-1 py-1 text-center text-text outline-none disabled:opacity-50"
                />
                <input
                  value={edicion.reps}
                  onChange={(e) => editar(ej.id, "reps", e.target.value)}
                  disabled={bloqueado}
                  aria-label={`Repeticiones de ${ej.nombre}`}
                  className="text-caption radius-control w-16 shrink-0 border border-border bg-surface px-1 py-1 text-center text-text outline-none disabled:opacity-50"
                />
                <input
                  value={edicion.descanso}
                  onChange={(e) => editar(ej.id, "descanso", e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={bloqueado}
                  inputMode="numeric"
                  placeholder="—"
                  aria-label={`Descanso de ${ej.nombre} en segundos`}
                  className="text-caption radius-control w-14 shrink-0 border border-border bg-surface px-1 py-1 text-center text-text outline-none disabled:opacity-50"
                />
              </div>
            );
          })}
        </Card>
      ))}

      {error && <p className="text-caption text-error">{error}</p>}

      {/* Barra sólida y no translúcida: queda flotando sobre la lista de
          ejercicios, y con fondo transparente el texto del botón se leía
          encima del nombre de un ejercicio. */}
      <div className="sticky bottom-2 z-10 space-y-1.5 rounded-2xl border border-border bg-surface p-2 shadow-lg">
        {guardado && cambiados.length === 0 && (
          <p className="text-caption flex items-center justify-center gap-1 rounded-xl border border-success/40 bg-success/15 py-2 font-semibold text-success">
            <Check size={13} /> Guardado. El alumno ya lo ve así.
          </p>
        )}
        <button
          type="button"
          onClick={guardar}
          disabled={bloqueado || guardando || cambiados.length === 0}
          className="radius-control flex h-11 w-full items-center justify-center gap-2 border border-vip/40 bg-vip/20 font-bold text-vip disabled:opacity-40"
        >
          {guardando
            ? "Guardando…"
            : cambiados.length === 0
              ? "Sin cambios"
              : `Guardar ${cambiados.length} ${cambiados.length === 1 ? "cambio" : "cambios"}`}
        </button>
      </div>
    </div>
  );
}
