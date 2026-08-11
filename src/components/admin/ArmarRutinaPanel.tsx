"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, PencilRuler, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RutinaDraftEditor, type TecnicaOpcion } from "@/components/admin/RutinaDraftEditor";
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
  /** Lo que el alumno escribió en "Mi entrenamiento". */
  ficha: {
    experiencia: string | null;
    equipo: string | null;
    molestias: string | null;
    lesiones: string | null;
    operaciones: string | null;
    condiciones: string | null;
    noDeseados: string | null;
    preferidos: string | null;
  };
};

/** La ficha del alumno, delante del entrenador MIENTRAS arma — no antes.
 *
 * El motor de reglas no puede leer "me molesta la rodilla al bajar escaleras":
 * es texto libre, no una columna. Y la auditoría de IA que sí lo lee tarda dos
 * minutos y llega al final. El que puede actuar sobre eso en el momento es el
 * entrenador, y para eso tiene que estar viéndolo mientras elige ejercicios.
 *
 * Lo delicado (molestias, lesiones, operaciones, condiciones) va en amarillo y
 * primero. Lo demás es contexto. */
function FichaDelAlumno({ alumno, compacta = false }: { alumno: AlumnoArmado; compacta?: boolean }) {
  const f = alumno.ficha;
  const cuidados = [
    f.molestias ? { titulo: "Molestias", texto: f.molestias } : null,
    f.lesiones ? { titulo: "Lesiones", texto: f.lesiones } : null,
    f.operaciones ? { titulo: "Operaciones", texto: f.operaciones } : null,
    f.condiciones ? { titulo: "Condiciones médicas", texto: f.condiciones } : null,
    f.noDeseados ? { titulo: "No quiere hacer", texto: f.noDeseados } : null,
  ].filter((x): x is { titulo: string; texto: string } => x !== null);

  const contexto = [
    f.experiencia ? `Nivel ${f.experiencia}` : null,
    f.equipo ? `Prefiere ${f.equipo}` : null,
    f.preferidos ? `Le gustan: ${f.preferidos}` : null,
  ].filter(Boolean);

  const sinFicha = cuidados.length === 0 && contexto.length === 0;

  return (
    <div className={compacta ? "radius-control border border-border bg-surface-2 p-2" : "space-y-1.5"}>
      {sinFicha ? (
        <p className="text-micro text-text-tertiary">
          {alumno.nombre} todavía no completó “Mi entrenamiento”. Armá con tu criterio: no hay antecedentes cargados
          que revisar.
        </p>
      ) : (
        <>
          {cuidados.length > 0 && (
            <div className="radius-control border border-warning/40 bg-warning/5 p-2">
              <p className="text-micro font-semibold text-warning">TENER EN CUENTA AL ELEGIR EJERCICIOS</p>
              {cuidados.map((c) => (
                <p key={c.titulo} className="text-micro mt-0.5 text-text-secondary">
                  <strong className="text-text">{c.titulo}:</strong> {c.texto}
                </p>
              ))}
            </div>
          )}
          {contexto.length > 0 && <p className="text-micro text-text-tertiary">{contexto.join(" · ")}</p>}
        </>
      )}
    </div>
  );
}

const MINUTOS = [30, 45, 60, 75, 90, 120];
const DIAS = [1, 2, 3, 4, 5, 6, 7];
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
  tecnicas,
}: {
  alumnos: AlumnoArmado[];
  ejercicios: { id: string; nombre: string; grupo: string; equipo: string }[];
  tecnicas: TecnicaOpcion[];
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
    // Una sola línea, no una tarjeta con instrucciones: una vez que la base
    // está armada, el alto de la pantalla es para la rutina.
    return (
      <div className="space-y-2">
        <p className="text-micro flex items-center gap-1.5 text-text-tertiary">
          <PencilRuler size={13} className="shrink-0 text-vip" />
          {alumno.nombre} · {NIVELES_ARMADO[nivel].etiqueta}
        </p>
        {/* La ficha queda arriba de la mesa de trabajo, no en la pantalla
            anterior: sirve mientras se eligen los ejercicios. */}
        <FichaDelAlumno alumno={alumno} compacta />
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
          tecnicas={tecnicas}
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
        {alumno && <FichaDelAlumno alumno={alumno} />}
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

        {/* Botones, no campos de escribir: es un toque en el celular en vez
            de abrir el teclado. "Que yo no tenga que escribir mucho". */}
        <div>
          <p className="text-micro text-text-tertiary">DÍAS POR SEMANA</p>
          <div className="mt-1 flex gap-1">
            {DIAS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDias(d)}
                aria-pressed={dias === d}
                className={`radius-control flex-1 py-2 text-caption font-semibold ${
                  dias === d ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-micro text-text-tertiary">MINUTOS POR SESIÓN</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {MINUTOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutos(m)}
                aria-pressed={minutos === m}
                className={`radius-control flex-1 py-2 text-caption font-semibold ${
                  minutos === m ? "bg-vip text-black" : "bg-surface-2 text-text-secondary"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
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
