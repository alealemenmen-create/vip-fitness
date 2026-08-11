"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Search, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { otorgarPuntosManual } from "@/app/admin/puntos/actions";

/** Atajos para lo que de verdad pasa: reponer lo que un bug se comió, o
 * premiar algo puntual. Escribir el número a mano sigue estando. */
const ATAJOS = [50, 100, 300];

export function OtorgarPuntosPanel({ alumnos }: { alumnos: { id: string; nombre: string }[] }) {
  const [alumnoId, setAlumnoId] = useState("");
  const [puntos, setPuntos] = useState(300);
  const [motivo, setMotivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const visibles = useMemo(
    () => alumnos.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 40),
    [alumnos, busqueda]
  );
  const alumno = alumnos.find((a) => a.id === alumnoId) ?? null;

  const otorgar = () => {
    setError(null);
    setHecho(null);
    iniciar(async () => {
      const r = await otorgarPuntosManual({ alumnoId, puntos, motivo });
      if (!r.ok) return setError(r.error);
      setHecho(`${r.puntos > 0 ? "+" : ""}${r.puntos} puntos para ${alumno?.nombre ?? "el alumno"}.`);
      setMotivo("");
    });
  };

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div>
          <p className="text-secondary font-medium text-text">1. ¿A quién?</p>
          <div className="relative mt-2">
            <Search size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alumno…"
              className="pl-9"
            />
          </div>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
            {visibles.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAlumnoId(a.id)}
                className={`radius-control block w-full truncate px-2.5 py-2 text-left text-caption font-medium ${
                  a.id === alumnoId ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
                }`}
              >
                {a.nombre}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-secondary font-medium text-text">2. ¿Cuántos puntos?</p>
        <div className="flex gap-1.5">
          {ATAJOS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPuntos(n)}
              className={`radius-control flex-1 py-2 text-caption font-semibold ${
                puntos === n ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
              }`}
            >
              +{n}
            </button>
          ))}
        </div>
        <Input
          type="number"
          value={puntos}
          onChange={(e) => setPuntos(Number(e.target.value))}
          aria-label="Cantidad de puntos"
        />
        <p className="text-micro text-text-tertiary">
          En negativo también descuenta. Máximo 1000 por ajuste.
        </p>

        <div>
          <p className="text-secondary font-medium text-text">3. ¿Por qué?</p>
          <p className="text-micro mb-1.5 text-text-tertiary">
            Esto lo lee el alumno en su historial de puntos. Escribilo como se lo dirías a él.
          </p>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Ej: Acá están tus 300 puntos del entrenamiento de ayer, se perdieron por una falla de la app."
          />
        </div>
      </Card>

      {error && <p className="text-caption text-error">{error}</p>}
      {hecho && (
        <Card padding="p-3" className="border border-success">
          <p className="text-caption flex items-center gap-2 text-success">
            <CheckCircle2 size={16} /> {hecho} Ya cuentan en el ranking.
          </p>
        </Card>
      )}

      <Button onClick={otorgar} loading={pendiente} disabled={!alumnoId} disabledReason="Elegí un alumno">
        <Sparkles size={18} />
        {pendiente ? "Otorgando…" : "Otorgar los puntos"}
      </Button>
    </div>
  );
}
