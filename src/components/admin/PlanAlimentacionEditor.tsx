"use client";

import { useEffect, useState } from "react";
import { Check, AlertTriangle, CircleHelp, Search } from "lucide-react";
import {
  guardarPlanAlimentacion,
  recalcularAlimento,
  type AnalizarPlanState,
} from "@/app/admin/archivos/actions";
import { buscarAlimentosAction } from "@/app/alumno/comer/actions";
import type { AlimentoCatalogo } from "@/app/alumno/comer/data";
import type { PlanResuelto, AlimentoResuelto } from "@/lib/alimentos/emparejar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const redondear = (n: number) => Math.round(n);

function sumarComida(alimentos: AlimentoResuelto[]) {
  return alimentos.reduce(
    (acc, a) => ({
      kcal: acc.kcal + a.aporte.kcal,
      prot: acc.prot + a.aporte.prot,
      carb: acc.carb + a.aporte.carb,
      grasa: acc.grasa + a.aporte.grasa,
    }),
    { kcal: 0, prot: 0, carb: 0, grasa: 0 }
  );
}

/**
 * Revisión de la meta antes de publicarla. Los números NO los inventa la IA:
 * salen de la tabla de alimentos del gimnasio, la misma con la que el alumno
 * registra lo que come. La IA solo aportó qué alimento y cuánto.
 */
export function PlanAlimentacionEditor({
  alumnoId,
  documentoId,
  analisis,
  onDescartar,
}: {
  alumnoId: string;
  documentoId: string | null;
  analisis: AnalizarPlanState;
  onDescartar: () => void;
}) {
  const [plan, setPlan] = useState<PlanResuelto>(analisis.plan!);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const reemplazar = async (iComida: number, iAlimento: number, alimentoId: string) => {
    const actual = plan.comidas[iComida].alimentos[iAlimento];
    const nuevo = await recalcularAlimento(alimentoId, actual.cantidad);
    if (!nuevo) return;

    setPlan((prev) => {
      const comidas = prev.comidas.map((c, i) => {
        if (i !== iComida) return c;
        const alimentos = c.alimentos.map((a, j) =>
          j === iAlimento ? { ...nuevo, nombrePdf: a.nombrePdf, unidadPdf: a.unidadPdf } : a
        );
        return { ...c, alimentos, aporte: sumarComida(alimentos) };
      });
      const todos = comidas.flatMap((c) => c.alimentos);
      return {
        comidas,
        total: sumarComida(todos),
        sinEmparejar: todos.filter((a) => a.alimentoId === null).length,
        sinCantidad: todos.filter((a) => a.alimentoId !== null && a.cantidad === null).length,
      };
    });
  };

  const publicar = async () => {
    setGuardando(true);
    setError(null);
    const resultado = await guardarPlanAlimentacion(
      alumnoId,
      {
        kcalObjetivo: redondear(plan.total.kcal) || null,
        protObjetivo: redondear(plan.total.prot) || null,
        carbObjetivo: redondear(plan.total.carb) || null,
        grasaObjetivo: redondear(plan.total.grasa) || null,
        comidas: plan.comidas.map((c) => ({
          nombre: c.nombre,
          hora: c.hora,
          kcal: redondear(c.aporte.kcal) || null,
          descripcion: c.descripcion,
        })),
      },
      documentoId
    );
    setGuardando(false);
    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }
    setGuardado(true);
  };

  if (guardado) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-success">
          <Check size={20} />
          <p className="text-card-title">Meta publicada</p>
        </div>
        <p className="text-body mt-2 text-text-secondary">
          El alumno ya la ve en Inicio y en Alimentación.
        </p>
        <Button variant="secondary" onClick={onDescartar} className="mt-4">
          Cerrar
        </Button>
      </Card>
    );
  }

  const difiereDeclarado =
    analisis.kcalDeclarada !== null && Math.abs(analisis.kcalDeclarada - plan.total.kcal) > 50;

  return (
    <Card>
      <p className="text-caption mb-1 text-text-tertiary">META CALCULADA CON TUS ALIMENTOS</p>
      <p className="text-secondary mb-4 text-text-secondary">
        La IA leyó del PDF qué come y cuánto. Las calorías salen de tu tabla de alimentos, para que
        coincidan con lo que el alumno registra.
      </p>

      {analisis.notaLectura && (
        <p className="text-caption mb-3 text-text-tertiary">{analisis.notaLectura}</p>
      )}

      {(plan.sinEmparejar > 0 || plan.sinCantidad > 0) && (
        <div className="radius-control mb-4 flex gap-2.5 border border-vip p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vip" />
          <div>
            <p className="text-secondary font-semibold text-text">Faltan datos para el cálculo</p>
            <p className="text-caption mt-1 text-text-secondary">
              {plan.sinEmparejar > 0 &&
                `${plan.sinEmparejar} alimento(s) del PDF no están en tu tabla — búscalos abajo o agrégalos primero en Alimentos. `}
              {plan.sinCantidad > 0 &&
                `${plan.sinCantidad} alimento(s) no traen cantidad en el PDF, así que suman 0.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 text-center">
        <Total valor={redondear(plan.total.kcal)} etiqueta="KCAL" destacado />
        <Total valor={redondear(plan.total.prot)} etiqueta="PROT" sufijo="g" />
        <Total valor={redondear(plan.total.carb)} etiqueta="CARB" sufijo="g" />
        <Total valor={redondear(plan.total.grasa)} etiqueta="GRASA" sufijo="g" />
      </div>

      {difiereDeclarado && (
        <p className="text-caption mt-3 text-vip">
          El PDF declara {analisis.kcalDeclarada} kcal y con tu tabla dan {redondear(plan.total.kcal)}.
          Revisa las cantidades o los alimentos emparejados.
        </p>
      )}

      <p className="text-caption mb-2 mt-5 text-text-tertiary">COMIDAS</p>
      <div className="space-y-3">
        {plan.comidas.length === 0 && (
          <p className="text-secondary text-text-tertiary">El PDF no traía comidas reconocibles.</p>
        )}

        {plan.comidas.map((c, i) => (
          <div key={i} className="radius-control border border-border p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-body font-medium text-text">{c.nombre}</p>
              <p className="text-caption text-text-tertiary">
                {c.hora ?? "sin hora"} · {redondear(c.aporte.kcal)} kcal
              </p>
            </div>

            <div className="mt-2 space-y-1.5">
              {c.alimentos.map((a, j) => (
                <FilaAlimento
                  key={j}
                  alimento={a}
                  onElegir={(id) => reemplazar(i, j, id)}
                />
              ))}
              {c.alimentos.length === 0 && (
                <p className="text-caption text-text-tertiary">
                  Sin alimentos detectados en esta comida.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-caption mt-3 text-error">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={onDescartar} className="flex-1">
          Descartar
        </Button>
        <Button onClick={publicar} loading={guardando} className="flex-1">
          {guardando ? "Publicando…" : "Publicar meta"}
        </Button>
      </div>
    </Card>
  );
}

function Total({
  valor,
  etiqueta,
  sufijo = "",
  destacado = false,
}: {
  valor: number;
  etiqueta: string;
  sufijo?: string;
  destacado?: boolean;
}) {
  return (
    <div className="radius-control bg-surface-2 py-2.5">
      <p className={`text-h3 ${destacado ? "text-vip" : "text-text"}`}>
        {valor}
        {sufijo}
      </p>
      <p className="text-caption text-text-tertiary">{etiqueta}</p>
    </div>
  );
}

/** Buscador contra la tabla del gimnasio, para reemplazar el alimento que la
 * app emparejó (o no pudo emparejar). */
function BuscadorAlimento({ onElegir }: { onElegir: (id: string) => void }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<AlimentoCatalogo[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;

    let vigente = true;
    const id = setTimeout(async () => {
      const encontrados = await buscarAlimentosAction(q);
      if (!vigente) return;
      setResultados(encontrados);
      setBuscando(false);
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
  }, [texto]);

  return (
    <div className="mt-2">
      <div className="radius-control flex items-center gap-2 border border-border bg-surface-2 px-3 py-2">
        <Search size={16} className="text-text-secondary" />
        <input
          value={texto}
          onChange={(e) => {
            const valor = e.target.value;
            setTexto(valor);
            const corta = valor.trim().length < 2;
            setBuscando(!corta);
            if (corta) setResultados([]);
          }}
          placeholder="Buscar en mi tabla de alimentos…"
          className="flex-1 bg-transparent text-secondary text-text outline-none"
        />
      </div>
      {buscando && <p className="text-caption mt-1 text-text-tertiary">Buscando…</p>}
      {resultados.length > 0 && (
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
          {resultados.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onElegir(r.id);
                setTexto("");
                setResultados([]);
              }}
              className="text-secondary radius-control block w-full px-2 py-1.5 text-left text-text hover:bg-surface-2"
            >
              {r.nombre}
              <span className="text-caption ml-1 text-text-tertiary">
                ({r.kcal} kcal / {r.porcionBase} {r.unidad})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilaAlimento({
  alimento,
  onElegir,
}: {
  alimento: AlimentoResuelto;
  onElegir: (id: string) => void;
}) {
  const [cambiando, setCambiando] = useState(false);
  const cantidadTexto =
    alimento.cantidad === null
      ? "sin cantidad"
      : `${alimento.cantidad}${alimento.unidadPdf ? ` ${alimento.unidadPdf}` : ""}`;

  if (!alimento.alimentoId) {
    return (
      <div className="radius-control border border-error/50 p-2.5">
        <p className="text-secondary text-text">
          {alimento.nombrePdf} <span className="text-text-tertiary">({cantidadTexto})</span>
        </p>
        <p className="text-caption mt-0.5 text-error">No está en tu tabla de alimentos</p>
        <BuscadorAlimento onElegir={onElegir} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-secondary truncate text-text">
            {alimento.nombreCatalogo}{" "}
            <span className="text-text-tertiary">({cantidadTexto})</span>
          </p>
          {alimento.confianza === "media" && (
            <p className="text-caption flex items-center gap-1 text-vip">
              <CircleHelp size={12} /> Emparejado con &quot;{alimento.nombrePdf}&quot; del PDF
            </p>
          )}
          {alimento.unidadDudosa && (
            <p className="text-caption text-vip">
              El PDF dice {alimento.unidadPdf} y tu tabla usa {alimento.unidadCatalogo}
            </p>
          )}
          {alimento.cantidad === null && (
            <p className="text-caption text-error">Sin cantidad en el PDF — suma 0</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-caption text-text-tertiary">{redondear(alimento.aporte.kcal)} kcal</p>
          <button
            onClick={() => setCambiando((v) => !v)}
            className="text-caption text-text-tertiary underline"
          >
            {cambiando ? "cancelar" : "cambiar"}
          </button>
        </div>
      </div>
      {cambiando && (
        <BuscadorAlimento
          onElegir={(id) => {
            onElegir(id);
            setCambiando(false);
          }}
        />
      )}
    </div>
  );
}
