"use client";

import { useActionState } from "react";
import { BrainCircuit, Play, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  actualizarConfiguracionReconocimientos,
  generarReconocimientosAhora,
  type ConfiguracionState,
} from "@/app/admin/configuracion/actions";
import type { ConfiguracionReconocimientos } from "@/lib/ai/reconocimientosSemanales";
import type { ConfiguracionSupervision } from "@/lib/configuracion/supervision";

const inicial: ConfiguracionState = { ok: false, mensaje: "" };

function Check({
  name,
  label,
  detalle,
  defaultChecked,
}: {
  name: string;
  label: string;
  detalle: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4"
        style={{ accentColor: "var(--color-vip)" }}
      />
      <span>
        <span className="block text-body font-medium text-text">{label}</span>
        <span className="text-caption text-text-tertiary">{detalle}</span>
      </span>
    </label>
  );
}

export function ConfiguracionReconocimientos({
  config,
  supervision,
}: {
  config: ConfiguracionReconocimientos;
  supervision: ConfiguracionSupervision;
}) {
  const [guardarState, guardarAction, guardando] = useActionState(
    actualizarConfiguracionReconocimientos,
    inicial
  );
  const [generarState, generarAction, generando] = useActionState(
    generarReconocimientosAhora,
    inicial
  );

  return (
    <div className="space-y-4">
      <Card className="border border-border p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vip/10 text-vip">
            <BrainCircuit size={20} />
          </span>
          <div>
            <p className="text-card-title text-text">Reconocimientos semanales</p>
            <p className="text-secondary mt-0.5 text-text-secondary">
              Analiza la semana terminada y publica solamente méritos respaldados por actividad real.
            </p>
          </div>
        </div>

        <form action={guardarAction} className="space-y-4">
          <Check
            name="activos"
            label="Publicación automática activa"
            detalle="El proceso semanal puede publicar noticias sin intervención manual."
            defaultChecked={config.activos}
          />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-secondary text-text-secondary">
              Máximo por semana
              <Input
                name="maxPorSemana"
                type="number"
                min={1}
                max={5}
                defaultValue={config.maxPorSemana}
                className="mt-1"
              />
            </label>
            <label className="text-secondary text-text-secondary">
              Mérito mínimo
              <Input
                name="minPuntaje"
                type="number"
                min={0}
                max={100}
                defaultValue={config.minPuntaje}
                className="mt-1"
              />
            </label>
          </div>

          <div>
            <p className="text-caption mb-2 flex items-center gap-2 text-text-tertiary">
              <SlidersHorizontal size={14} /> SEMÁFORO DE SUPERVISIÓN
            </p>
            <p className="text-caption mb-3 text-text-tertiary">
              Define cuándo un alumno aparece como “Atención” o “Destacado” en tu lista.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-secondary text-text-secondary">
                Días sin entrenar
                <Input
                  name="diasSinEntrenar"
                  type="number"
                  min={1}
                  max={30}
                  defaultValue={supervision.diasSinEntrenarAlerta}
                  className="mt-1"
                />
              </label>
              <label className="text-secondary text-text-secondary">
                Atención entrenamiento %
                <Input
                  name="pctAtencion"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={supervision.pctEntrenamientoAtencion}
                  className="mt-1"
                />
              </label>
              <label className="text-secondary text-text-secondary">
                Destacado entrenamiento %
                <Input
                  name="pctDestacado"
                  type="number"
                  min={1}
                  max={200}
                  defaultValue={supervision.pctEntrenamientoDestacado}
                  className="mt-1"
                />
              </label>
              <label className="text-secondary text-text-secondary">
                Atención comidas / 7
                <Input
                  name="comidasAtencion"
                  type="number"
                  min={0}
                  max={6}
                  defaultValue={supervision.diasComidaAtencion}
                  className="mt-1"
                />
              </label>
              <label className="text-secondary col-span-2 text-text-secondary">
                Destacado comidas / 7
                <Input
                  name="comidasDestacado"
                  type="number"
                  min={1}
                  max={7}
                  defaultValue={supervision.diasComidaDestacado}
                  className="mt-1"
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-caption mb-2 flex items-center gap-2 text-text-tertiary">
              <SlidersHorizontal size={14} /> SEÑALES QUE PUEDE CONSIDERAR
            </p>
            <div className="space-y-2">
              <Check
                name="entrenamiento"
                label="Entrenamiento"
                detalle="Sesiones realizadas y mejora frente a la semana anterior."
                defaultChecked={config.incluirEntrenamiento}
              />
              <Check
                name="alimentacion"
                label="Alimentación"
                detalle="Seguimiento constante del plan, sin publicar calorías ni comidas."
                defaultChecked={config.incluirAlimentacion}
              />
              <Check
                name="ranking"
                label="Ranking"
                detalle="Rendimiento integral y puntos de la semana."
                defaultChecked={config.incluirRanking}
              />
              <Check
                name="constancia"
                label="Constancia"
                detalle="Seguimientos y uso útil de las funciones de progreso."
                defaultChecked={config.incluirConstancia}
              />
            </div>
          </div>

          {guardarState.mensaje && (
            <p className={`text-caption ${guardarState.ok ? "text-success" : "text-error"}`}>
              {guardarState.mensaje}
            </p>
          )}
          <Button type="submit" variant="secondary" loading={guardando} className="w-full">
            Guardar configuración
          </Button>
        </form>
      </Card>

      <Card className="border border-border p-4">
        <p className="text-card-title flex items-center gap-2 text-text">
          <Play size={18} className="text-vip" /> Prueba controlada
        </p>
        <p className="text-secondary mb-3 mt-1 text-text-secondary">
          Analiza la última semana cerrada ahora. Si ya fue publicada, no crea duplicados.
        </p>
        <form action={generarAction}>
          <Button type="submit" variant="accion" loading={generando} className="w-full">
            Analizar semana con IA
          </Button>
        </form>
        {generarState.mensaje && (
          <p className={`text-caption mt-2 ${generarState.ok ? "text-success" : "text-error"}`}>
            {generarState.mensaje}
          </p>
        )}
      </Card>

      <div className="radius-card flex gap-3 border border-border p-4">
        <ShieldCheck size={20} className="shrink-0 text-success" />
        <p className="text-caption text-text-secondary">
          Claude recibe candidatos anónimos. Los nombres se agregan dentro del servidor únicamente
          después de redactar la noticia. Nunca se envían peso, calorías ni datos médicos.
        </p>
      </div>
    </div>
  );
}
