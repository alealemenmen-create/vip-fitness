"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { obtenerRutinaComoTexto } from "@/app/admin/alumnos/rutinaTexto";

/** Sacar la rutina de un alumno en texto para pegarla en otro.
 *
 * El camino es a propósito manual: se copia el texto, se pega en Documentos →
 * Pegar texto, y ahí cae en el editor de borrador para revisarla contra la
 * persona nueva antes de publicar. Copiar directo de alumno a alumno sería más
 * rápido y peor: terminaría con dos fichas distintas compartiendo la misma
 * rutina sin que nadie la haya mirado. */
export function CopiarRutinaAlumno({ rutinaId, nombreRutina }: { rutinaId: string; nombreRutina: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraer = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await obtenerRutinaComoTexto(rutinaId);
      if (!r.ok) return setError(r.error);
      setTexto(r.texto);
      // El portapapeles puede fallar (permisos, contexto no seguro): si pasa,
      // el texto queda igual visible abajo para copiarlo a mano.
      try {
        await navigator.clipboard.writeText(r.texto);
        setCopiado(true);
      } catch {
        setCopiado(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo extraer la rutina.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Card>
      <p className="text-caption text-text-tertiary">REUTILIZAR ESTA RUTINA</p>
      <p className="text-caption mt-0.5 text-text-secondary">
        Extrae “{nombreRutina}” como texto para pegarla en otro alumno y ajustarla antes de publicar.
      </p>

      {!texto && (
        <Button variant="secondary" size="xs" onClick={extraer} loading={cargando} className="mt-2">
          <Copy size={14} /> {cargando ? "Extrayendo…" : "Extraer rutina como texto"}
        </Button>
      )}

      {error && <p className="text-caption mt-2 text-error">{error}</p>}

      {texto && (
        <div className="mt-2 space-y-2">
          {copiado ? (
            <p className="text-caption flex items-center gap-1 text-success">
              <Check size={14} /> Copiada al portapapeles.
            </p>
          ) : (
            <p className="text-caption text-text-tertiary">Selecciona el texto y cópialo:</p>
          )}
          <textarea
            readOnly
            value={texto}
            onFocus={(e) => e.currentTarget.select()}
            rows={8}
            className="radius-control w-full bg-surface-2 p-2 text-micro text-text-secondary"
          />
          <Link
            href="/admin/documentos"
            className="text-caption block font-medium text-vip underline"
          >
            Ir a Documentos → Pegar texto y elegir al alumno nuevo
          </Link>
        </div>
      )}
    </Card>
  );
}
