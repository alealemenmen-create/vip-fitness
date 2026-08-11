"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, PencilRuler, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { RutinaDraftEditor } from "@/components/admin/RutinaDraftEditor";
import { generarBorradorRutina } from "@/app/admin/generador/actions";
import { briefDesdeNivel, NIVELES_ARMADO, type NivelArmado } from "@/lib/generador-rutinas/niveles-armado";
import type { RutinaExtraida } from "@/lib/ai/extraerRutina";

export type AlumnoArmado = {
  id: string;
  nombre: string;
  perfilCompleto: boolean;
  requiereRevision: boolean;
  /** Lo que el alumno declaró en su propia ficha. */
  dias: number | null;
  minutos: number | null;
  /** Plan CONTRATADO. Manda sobre el autoreporte: el que paga tres días no
   * puede terminar con una rutina de cinco. */
  plan: { nombre: string; diasSemana: number } | null;
};

const MINUTOS = [30, 45, 60, 75, 90, 120];
const NIVELES: NivelArmado[] = ["estandar", "competitivo", "senior"];

/** Herramienta de armado manual: el entrenador elige alumno y nivel, el motor
 * le deja una base decente, y a partir de ahí la arma él sobre la vista previa
 * a pantalla completa.
 *
 * Es la contracara del generador: allá hay 7 gavetas para afinar cada detalle
 * ANTES de generar; acá hay dos decisiones y todo el trabajo fino se hace
 * DESPUÉS, sobre la rutina ya armada. Mismo motor, misma publicación, misma
 * revisión con IA — lo único distinto es por dónde entra el entrenador. */
export function ArmarRutinaPanel({
  alumnos,
  ejercicios,
}: {
  alumnos: AlumnoArmado[];
  ejercicios: { id: string; nombre: string; grupo: string; equipo: string }[];
}) {
  const [alumnoId, setAlumnoId] = useState("");
  const [nivel, setNivel] = useState<NivelArmado>("estandar");
  const [dias, setDias] = useState(3);
  const [minutos, setMinutos] = useState(60);
  const [busqueda, setBusqueda] = useState("");
  const [rutina, setRutina] = useState<RutinaExtraida | null>(null);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const alumno = alumnos.find((a) => a.id === alumnoId) ?? null;
  const visibles = useMemo(
    () => alumnos.filter((a) => a.nombre.toLowerCase().includes(busqueda.toLowerCase())),
    [alumnos, busqueda]
  );

  const elegir = (id: string) => {
    setAlumnoId(id);
    const elegido = alumnos.find((a) => a.id === id);
    if (!elegido) return;
    // El plan contratado gana sobre el autoreporte de la ficha; si no tiene
    // plan asignado, se cae a lo que declaró el alumno y, si tampoco hay, a 3.
    setDias(elegido.plan?.diasSemana ?? elegido.dias ?? 3);
    setMinutos(elegido.minutos ?? 60);
  };

  const armar = () => {
    setError(null);
    iniciar(async () => {
      const brief = briefDesdeNivel(nivel, { alumnoId, alumnoIds: [alumnoId], dias, minutosSesion: minutos });
      const r = await generarBorradorRutina(brief);
      if (!r.ok) return setError(r.error);
      setRutina(r.rutina);
      setAlertas(r.alertas);
    });
  };

  if (rutina && alumno) {
    return (
      <div className="space-y-3">
        <Card padding="p-3" className="border border-vip/30 bg-vip/5">
          <p className="text-caption flex items-center gap-2 font-medium text-text">
            <PencilRuler size={16} className="text-vip" />
            Base lista para {alumno.nombre} · {NIVELES_ARMADO[nivel].etiqueta}
          </p>
          <p className="text-micro mt-1 text-text-tertiary">
            De acá en adelante la armás vos: tocá el lápiz de cualquier ejercicio para cambiarlo, el “+” para insertar
            uno entre dos, y los botones de abajo para sumar o quitar días. Nada llega al alumno hasta que confirmes.
          </p>
        </Card>
        {alertas.map((a) => (
          <Card key={a} padding="p-3" className="border border-warning">
            <p className="text-caption flex gap-2">
              <AlertTriangle size={16} className="shrink-0 text-warning" />
              {a}
            </p>
          </Card>
        ))}
        <RutinaDraftEditor
          mesaDeTrabajo
          alumnoIds={[alumno.id]}
          draftInicial={rutina}
          onDescartar={() => setRutina(null)}
          ejercicios={ejercicios}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div>
          <p className="text-secondary font-medium text-text">1. ¿Para quién?</p>
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
                onClick={() => elegir(a.id)}
                className={`radius-control flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left ${
                  a.id === alumnoId ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
                }`}
              >
                <span className="text-caption min-w-0 flex-1 truncate font-medium">{a.nombre}</span>
                <span className="text-micro shrink-0 opacity-80">
                  {a.plan ? `${a.plan.nombre} · ${a.plan.diasSemana} días` : "Sin plan"}
                </span>
              </button>
            ))}
            {visibles.length === 0 && <p className="text-caption text-text-tertiary">Ningún alumno con ese nombre.</p>}
          </div>
        </div>

        {alumno && !alumno.plan && (
          <p className="text-caption flex items-start gap-1.5 text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {alumno.nombre} no tiene plan de entrenamiento asignado. Se usan los días de su ficha; asignale el plan
            desde Alumnos para que respete el cupo que paga.
          </p>
        )}
        {alumno?.requiereRevision && (
          <p className="text-caption flex items-start gap-1.5 text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            La ficha de {alumno.nombre} tiene antecedentes de salud pendientes de revisión.
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-secondary font-medium text-text">2. ¿Con qué exigencia?</p>
        <div className="space-y-1.5">
          {NIVELES.map((n) => {
            const activo = n === nivel;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setNivel(n)}
                className={`radius-control block w-full border px-3 py-2 text-left ${
                  activo ? "border-vip bg-vip/10" : "border-border"
                }`}
              >
                <p className={`text-caption font-semibold ${activo ? "text-vip" : "text-text"}`}>
                  {NIVELES_ARMADO[n].etiqueta}
                </p>
                <p className="text-micro mt-0.5 text-text-tertiary">{NIVELES_ARMADO[n].descripcion}</p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-micro text-text-tertiary">DÍAS POR SEMANA</span>
            <Input
              type="number"
              min={1}
              max={7}
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              aria-label="Días por semana"
            />
          </label>
          <label className="block">
            <span className="text-micro text-text-tertiary">MINUTOS POR SESIÓN</span>
            <Select value={minutos} onChange={(e) => setMinutos(Number(e.target.value))} aria-label="Minutos por sesión">
              {MINUTOS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </label>
        </div>
        {alumno?.plan && dias !== alumno.plan.diasSemana && (
          <p className="text-caption text-warning">
            El plan de {alumno.nombre} es de {alumno.plan.diasSemana} días por semana y estás armando {dias}.
          </p>
        )}
      </Card>

      {error && <p className="text-caption text-error">{error}</p>}
      <Button
        onClick={armar}
        loading={pendiente}
        disabled={!alumnoId}
        disabledReason="Elegí un alumno para armar la base"
      >
        <PencilRuler size={18} />
        {pendiente ? "Armando la base…" : "Armar la base y empezar a editar"}
      </Button>
    </div>
  );
}
