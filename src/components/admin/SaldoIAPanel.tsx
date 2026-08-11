"use client";

import { useActionState } from "react";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cargarSaldoIA } from "@/app/admin/configuracion/actions";
import { NOMBRE_HERRAMIENTA, type SaldoIA } from "@/lib/asistente/saldo-tipos";

const inicial = { ok: false, mensaje: "" };

function usd(monto: number): string {
  return `US$${monto.toFixed(2)}`;
}

/**
 * Contador de consumo y saldo de IA.
 *
 * El saldo se escribe a mano: la API de Anthropic no lo expone. Lo que sí es
 * automático es el gasto — cada llamada queda anotada con su costo real,
 * incluida la caché (ver `lib/ai/consumo.ts`), que es la parte que antes no se
 * contaba y hacía que el número mostrado fuera menor al de verdad.
 *
 * El desglose por herramienta está para responder la pregunta que él va a
 * hacer apenas lo vea: "¿en qué se me va?". Hoy la respuesta es la revisión de
 * rutinas, ~US$0,24 cada una.
 */
export function SaldoIAPanel({ saldo }: { saldo: SaldoIA }) {
  const [estado, accion, pendiente] = useActionState(cargarSaldoIA, inicial);

  if (!saldo.disponible) {
    return (
      <Card className="space-y-1">
        <p className="text-secondary flex items-center gap-2 font-semibold text-text">
          <Wallet size={16} className="text-vip" /> Saldo de IA
        </p>
        <p className="text-caption text-text-tertiary">
          Falta aplicar la migración <strong>0065_saldo_y_consumo_ia.sql</strong> en Supabase. Hasta entonces el
          consumo se sigue registrando, pero no se puede cargar el saldo.
        </p>
      </Card>
    );
  }

  const pct = saldo.cargadoUsd > 0 ? Math.min(100, (saldo.gastadoDesdeCargaUsd / saldo.cargadoUsd) * 100) : 0;

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-secondary flex items-center gap-2 font-semibold text-text">
          <Wallet size={16} className="text-vip" /> Saldo de IA
        </p>
        <p className="text-caption mt-0.5 text-text-tertiary">
          Anthropic no informa el saldo de la cuenta: se carga a mano y desde ahí se descuenta lo que se gasta.
        </p>
      </div>

      <div className="radius-control border border-border bg-surface-2 p-3">
        <div className="flex items-end justify-between gap-2">
          <span>
            <span className="text-micro block text-text-tertiary">QUEDA</span>
            <strong className="text-h3 tabular-nums text-vip">{usd(saldo.restanteUsd)}</strong>
          </span>
          <span className="text-caption text-right text-text-tertiary">
            Gastado {usd(saldo.gastadoDesdeCargaUsd)}
            <br />
            de {usd(saldo.cargadoUsd)}
          </span>
        </div>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-bg">
          <span
            className="block h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: pct > 85 ? "var(--color-error)" : "var(--color-vip)" }}
          />
        </span>
        {saldo.cargadoEn && (
          <p className="text-micro mt-1.5 text-text-tertiary">
            Cargado el {new Date(saldo.cargadoEn).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        )}
      </div>

      {saldo.desglose.length > 0 && (
        <div className="space-y-1">
          <p className="text-micro text-text-tertiary">EN QUÉ SE FUE</p>
          {saldo.desglose.map((fila) => (
            <p key={fila.herramienta} className="text-caption flex items-baseline justify-between gap-2 text-text-secondary">
              <span className="min-w-0 truncate">
                {NOMBRE_HERRAMIENTA[fila.herramienta] ?? fila.herramienta}
                <span className="text-micro ml-1 text-text-tertiary">×{fila.usos}</span>
              </span>
              <span className="shrink-0 tabular-nums">{usd(fila.usd)}</span>
            </p>
          ))}
        </div>
      )}

      <form action={accion} className="flex items-end gap-2 border-t border-border pt-3">
        <label className="min-w-0 flex-1">
          <span className="text-micro mb-1 block text-text-tertiary">CARGUÉ (US$)</span>
          <Input
            name="saldo"
            type="number"
            step="0.01"
            min="0"
            defaultValue={saldo.cargadoUsd || ""}
            placeholder="20.00"
            className="py-2"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary" loading={pendiente}>
          Guardar
        </Button>
      </form>
      {estado.mensaje && (
        <p className={`text-caption ${estado.ok ? "text-success" : "text-error"}`}>{estado.mensaje}</p>
      )}
      <p className="text-micro text-text-tertiary">
        Guardar reinicia la cuenta: el gasto se empieza a descontar desde este momento.
      </p>
    </Card>
  );
}
