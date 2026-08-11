"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ListChecks, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { descartarHallazgo, penalizarHallazgo, type FormState } from "@/app/admin/auditoria/actions";
import type { HallazgoAuditoria } from "@/lib/auditoria/data";

const SEVERIDAD_LABEL: Record<HallazgoAuditoria["severidad"], { texto: string; tone: "error" | "neutral" }> = {
  alta: { texto: "Revisar pronto", tone: "error" },
  // "Sospecha" acusaba de algo que casi nunca pasó: la app es nueva y la
  // mayoría de estos avisos son de gente aprendiendo a usarla, no de gente
  // haciendo trampa. El panel informa, no imputa.
  media: { texto: "Solo para mirar", tone: "neutral" },
};

const initialState: FormState = { error: null, ok: false };

function PenalizarForm({ hallazgo, onCancelar }: { hallazgo: HallazgoAuditoria; onCancelar: () => void }) {
  const [state, formAction, pending] = useActionState(penalizarHallazgo, initialState);

  useEffect(() => {
    if (state.ok) onCancelar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-2 border-t border-border pt-2">
      <input type="hidden" name="tipo" value={hallazgo.tipo} />
      <input type="hidden" name="referencia_id" value={hallazgo.referenciaId} />
      <input type="hidden" name="alumno_id" value={hallazgo.alumnoId} />
      <input type="hidden" name="fecha" value={hallazgo.fecha} />

      <div>
        <label className="text-[9px] mb-0.5 block text-text-tertiary">PUNTOS A DESCONTAR</label>
        <Input type="number" name="puntos" min={1} required defaultValue={100} className="!py-1.5 text-caption" />
      </div>
      <div>
        <label className="text-[9px] mb-0.5 block text-text-tertiary">EXPLICACIÓN QUE VA A VER EL ALUMNO</label>
        <Textarea
          name="nota"
          required
          rows={2}
          placeholder="Explicá con claridad qué se encontró — el alumno la va a leer."
          className="!py-1.5 text-caption"
        />
      </div>
      {state.error && <p className="text-caption text-error">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="xsAuto" className="flex-1" onClick={onCancelar} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" size="xsAuto" className="flex-1" loading={pending} disabled={pending}>
          Confirmar y notificar
        </Button>
      </div>
    </form>
  );
}

function HallazgoCard({ hallazgo }: { hallazgo: HallazgoAuditoria }) {
  const [penalizando, setPenalizando] = useState(false);
  const severidad = SEVERIDAD_LABEL[hallazgo.severidad];

  return (
    <Card padding="p-3" className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/admin/alumnos/${hallazgo.alumnoId}`}
            className="text-caption font-semibold text-text underline underline-offset-2"
          >
            {hallazgo.alumnoNombre}
          </Link>
          <p className="text-caption text-text">{hallazgo.titulo}</p>
          <p className="text-[9px] text-text-tertiary">{hallazgo.fecha}</p>
        </div>
        <Pill tone={severidad.tone}>{severidad.texto}</Pill>
      </div>

      <p className="text-caption text-text-secondary">{hallazgo.detalle}</p>

      {hallazgo.tipo === "rutina_activa_deficiente" ? (
        <div className="border-t border-border pt-2">
          <Link
            href={`/admin/generador?alumno=${hallazgo.alumnoId}#selector-alumnos`}
            className="block"
          >
            <Button type="button" size="xsAuto" className="w-full">
              Crear reemplazo
            </Button>
          </Link>
        </div>
      ) : penalizando ? (
        <PenalizarForm hallazgo={hallazgo} onCancelar={() => setPenalizando(false)} />
      ) : (
        <div className="flex gap-2 border-t border-border pt-2">
          <form action={descartarHallazgo} className="flex-1">
            <input type="hidden" name="tipo" value={hallazgo.tipo} />
            <input type="hidden" name="referencia_id" value={hallazgo.referenciaId} />
            <input type="hidden" name="alumno_id" value={hallazgo.alumnoId} />
            <Button type="submit" variant="secondary" size="xsAuto" className="w-full">
              Descartar
            </Button>
          </form>
          <Button
            type="button"
            variant="destructive"
            size="xsAuto"
            className="flex-1"
            onClick={() => setPenalizando(true)}
          >
            Penalizar
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * Lista de sospechas pendientes de revisión (ver `obtenerHallazgosPendientes`
 * en `lib/auditoria/data.ts`). Nunca actúa sola: cada tarjeta espera que el
 * entrenador decida "Descartar" (falso positivo, no pasa nada) o "Penalizar"
 * (resta puntos y le deja una nota importante al alumno explicando por qué —
 * nunca en silencio).
 */
export function AuditoriaHallazgos({ hallazgos }: { hallazgos: HallazgoAuditoria[] }) {
  if (hallazgos.length === 0) {
    return (
      <Card padding="p-4" className="flex flex-col items-center gap-2 text-center">
        <Search size={24} className="text-text-tertiary" />
        <p className="text-caption text-text-secondary">
          No hay sospechas pendientes en los últimos 90 días.
        </p>
      </Card>
    );
  }

  // Las rutinas deficientes NO se pueden descartar (a propósito: se corrigen
  // reemplazándolas, ver `registrarRevision`). Mezcladas con el resto hacían
  // que la lista nunca pudiera llegar a cero — con 36 de ellas encima, lo que
  // sí requiere una decisión rápida quedaba enterrado y el panel se volvía
  // algo que no se abre. Van aparte y plegadas.
  const paraDecidir = hallazgos.filter((h) => h.tipo !== "rutina_activa_deficiente");
  const rutinasPorRehacer = hallazgos.filter((h) => h.tipo === "rutina_activa_deficiente");

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div className="flex items-center gap-1.5 text-caption text-text-tertiary">
          <AlertTriangle size={14} />
          {paraDecidir.length === 0
            ? "Nada pendiente de decisión"
            : `${paraDecidir.length} ${paraDecidir.length === 1 ? "hallazgo espera" : "hallazgos esperan"} tu decisión`}
        </div>
        {paraDecidir.length === 0 ? (
          <Card padding="p-4" className="flex flex-col items-center gap-2 text-center">
            <Search size={24} className="text-text-tertiary" />
            <p className="text-caption text-text-secondary">
              Nada que descartar ni penalizar en los últimos 90 días.
            </p>
          </Card>
        ) : (
          paraDecidir.map((h) => <HallazgoCard key={`${h.tipo}:${h.referenciaId}`} hallazgo={h} />)
        )}
      </section>

      {rutinasPorRehacer.length > 0 && (
        <details className="space-y-2">
          <summary className="text-caption cursor-pointer text-text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={14} />
              {rutinasPorRehacer.length} rutinas activas con observaciones · no se descartan, se
              reemplazan
            </span>
          </summary>
          <p className="text-micro mb-2 mt-2 text-text-tertiary">
            Estas no son sospechas sobre el alumno: son avisos sobre cómo quedó armada su rutina.
            Solo desaparecen cuando publicas una nueva para esa persona.
          </p>
          <div className="space-y-2">
            {rutinasPorRehacer.map((h) => (
              <HallazgoCard key={`${h.tipo}:${h.referenciaId}`} hallazgo={h} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
