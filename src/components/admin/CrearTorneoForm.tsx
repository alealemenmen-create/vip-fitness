"use client";

import { useActionState, useState } from "react";
import { Swords } from "lucide-react";
import { crearTorneo, type FormState } from "@/app/admin/torneos/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import type { TorneoMetrica } from "@/lib/supabase/types";

const initialState: FormState = { error: null, ok: false };

function ListaLado({
  titulo,
  name,
  alumnos,
  seleccionado,
}: {
  titulo: string;
  name: string;
  alumnos: { id: string; nombre: string }[];
  seleccionado?: string;
}) {
  return (
    <div>
      <p className="text-caption mb-1 font-semibold text-vip">{titulo}</p>
      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-xl bg-surface-2 p-1.5">
        {alumnos.length === 0 ? (
          <p className="text-caption p-2 text-text-tertiary">Sin alumnos.</p>
        ) : (
          alumnos.map((a) => (
            <label key={a.id} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-caption text-text">
              <input type="checkbox" name={name} value={a.id} defaultChecked={a.id === seleccionado} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.nombre}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export type BorradorRetoIA = {
  nombre: string;
  descripcion: string;
  regla: string;
  modalidad: string;
  metrica: string;
  puntos: number;
  ladoA: string;
  ladoB: string;
  fechaInicio: string;
  fechaFin: string;
};

/**
 * Plantillas de competencia: elegir una llena de un saque nombre, descripción,
 * regla, métrica y unidad — pensadas para que se sientan de un gimnasio real
 * como VIP Fitness, no genéricas. El entrenador puede seguir editando
 * cualquier campo después de elegir una; esto es un punto de partida, no un
 * candado.
 */
type PlantillaCompetencia = {
  nombre: string;
  descripcion: string;
  regla: string;
  metrica: TorneoMetrica;
  unidad?: string;
  menorEsMejor?: boolean;
};

const PLANTILLAS: PlantillaCompetencia[] = [
  {
    nombre: "Reto de Sentadillas",
    descripcion:
      "Fuerza de piernas al límite: quién hace más repeticiones con buena técnica se lleva la bolsa.",
    regla:
      "Gana quien registre más repeticiones válidas de sentadilla con técnica correcta, verificadas por el entrenador, antes de que cierre el periodo.",
    metrica: "manual",
    unidad: "repeticiones",
  },
  {
    nombre: "Duelo de Banca",
    descripcion:
      "Cara a cara en el press de banca: el peso más pesado levantado con buena forma se lleva todo.",
    regla:
      "Gana quien levante el mayor peso en una repetición máxima (1RM) de press de banca, validado por el entrenador.",
    metrica: "manual",
    unidad: "kg",
  },
  {
    nombre: "Sprint del Peso Muerto",
    descripcion: "El clásico de fuerza total: quién saca más kilos del piso se corona campeón.",
    regla:
      "Gana quien levante el mayor peso en una repetición máxima (1RM) de peso muerto, validado por el entrenador.",
    metrica: "manual",
    unidad: "kg",
  },
  {
    nombre: "Reto de Dominadas",
    descripcion: "Tracción pura: la espalda y los brazos que más aguanten se llevan el premio.",
    regla:
      "Gana quien complete más dominadas estrictas en una sola serie, sin balanceo, validado por el entrenador.",
    metrica: "manual",
    unidad: "repeticiones",
  },
  {
    nombre: "Duelo de Plancha",
    descripcion: "Resistencia de core: quién aguanta más tiempo en plancha con la forma correcta gana.",
    regla:
      "Gana quien resista más tiempo en plancha abdominal con técnica correcta, sin perder la posición.",
    metrica: "manual",
    unidad: "segundos",
  },
  {
    nombre: "Maratón de Asistencia",
    descripcion:
      "El gimnasio se gana viniendo: quién pisa más días el gym durante el periodo se lleva la bolsa.",
    regla: "Gana quien registre más días de asistencia al gimnasio durante el periodo de la competencia.",
    metrica: "asistencia",
  },
  {
    nombre: "Copa Transformación",
    descripcion:
      "El cambio físico puesto a prueba: mayor porcentaje de bajada de peso corporal se lleva el premio.",
    regla:
      "Gana quien logre el mayor porcentaje de bajada de peso corporal respecto a su peso inicial, medido al cierre del periodo.",
    metrica: "peso_baja",
  },
  {
    nombre: "Copa Volumen",
    descripcion:
      "A ganar masa de forma controlada: quién sube más peso corporal durante el periodo se corona.",
    regla:
      "Gana quien logre la mayor subida de peso corporal de forma controlada durante el periodo de la competencia.",
    metrica: "peso_sube",
  },
  {
    nombre: "Copa de Constancia VIP",
    descripcion: "El que más entrena, más suma: quién acumule más Puntos VIP en el periodo se lleva la bolsa.",
    regla: "Gana quien acumule más Puntos VIP durante el periodo de la competencia.",
    metrica: "progreso_vip",
  },
  {
    nombre: "Reto Contrarreloj",
    descripcion: "Velocidad pura: quién complete el circuito o recorrido en menos tiempo se lleva el premio.",
    regla:
      "Gana quien complete el circuito o recorrido acordado en el menor tiempo posible, validado por el entrenador.",
    metrica: "manual",
    unidad: "minutos",
    menorEsMejor: true,
  },
];

/** Banco de reglas, para cuando la del nombre elegido no calza o para armar
 * una competencia personalizada sin escribir desde cero. Van sueltas de las
 * plantillas a propósito: la misma regla sirve para más de un nombre. */
const REGLAS_BANCO: string[] = [
  "Gana quien registre más repeticiones válidas del ejercicio, verificadas por el entrenador.",
  "Gana quien levante el mayor peso en una repetición máxima (1RM), validado por el entrenador.",
  "Gana quien complete más repeticiones estrictas en una sola serie, sin ayuda ni balanceo.",
  "Gana quien resista más tiempo en la posición acordada, sin perder la técnica.",
  "Gana quien registre más días de asistencia al gimnasio durante el periodo.",
  "Gana quien logre el mayor porcentaje de bajada de peso corporal respecto a su peso inicial.",
  "Gana quien logre la mayor subida de peso corporal de forma controlada durante el periodo.",
  "Gana quien acumule más Puntos VIP durante el periodo de la competencia.",
  "Gana quien complete el recorrido o circuito en el menor tiempo posible.",
  "Gana quien sume el mayor volumen total (peso × repeticiones) en el ejercicio acordado.",
  "Gana quien mejore más su marca personal respecto al inicio del periodo.",
  "En caso de empate, gana quien haya registrado el resultado primero.",
  "El resultado se valida únicamente con el entrenador presente o con video de respaldo.",
  "Gana quien complete el mayor número de series del plan asignado sin faltar ningún día.",
];

/** VIP Fitness aporta la bolsa entera, así que los montos son los que el
 * gimnasio ya maneja como referencia — no hace falta escribirlos a mano cada
 * vez. El campo sigue aceptando cualquier número para un monto fuera de lista. */
const PREMIOS_BANCO = [200, 500, 1000, 1500, 2000, 5000];

function puntosPorDefecto(modalidad: string): number {
  return modalidad === "duelo" ? 500 : modalidad === "reto_coach" ? 1000 : 2500;
}

/**
 * Chip reutilizable para las tres listas de plantillas (nombre, regla, premio).
 *
 * `ancho`: los de nombre y premio van en una fila que scrollea horizontal, así
 * que conviene que cada uno mida lo que mide su texto sin partirse
 * (`whitespace-nowrap`). Los de regla van en una lista que se va abajo,
 * apilada — recortar el texto ahí ("Gana quien registre más…") le escondía al
 * entrenador justo la parte que necesitaba leer para elegir la regla
 * correcta, así que esos van a ancho completo y con salto de línea normal.
 */
function Chip({
  activo,
  onClick,
  children,
  ancho = "auto",
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ancho?: "auto" | "completo";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-caption radius-control border px-3 py-1.5 text-left font-medium transition-colors ${
        ancho === "auto" ? "shrink-0 whitespace-nowrap" : "w-full"
      } ${activo ? "border-vip bg-vip/15 text-vip" : "border-border bg-surface-2 text-text-secondary"}`}
    >
      {children}
    </button>
  );
}

export function CrearTorneoForm({
  alumnos,
  borradorIA,
}: {
  alumnos: { id: string; nombre: string }[];
  borradorIA?: BorradorRetoIA | null;
}) {
  const [abierto, setAbierto] = useState(Boolean(borradorIA));
  const [modalidad, setModalidad] = useState(borradorIA?.modalidad ?? "duelo");
  const [metrica, setMetrica] = useState<TorneoMetrica>(
    (borradorIA?.metrica as TorneoMetrica) ?? "asistencia"
  );
  const [state, formAction, pending] = useActionState(crearTorneo, initialState);

  // Los tres campos que llenan las plantillas, ahora controlados: así un chip
  // puede escribirlos, y el entrenador los sigue pudiendo editar a mano
  // después sin que nada se los pise.
  const [nombre, setNombre] = useState(borradorIA?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(borradorIA?.descripcion ?? "");
  const [regla, setRegla] = useState(borradorIA?.regla ?? "");
  const [unidadManual, setUnidadManual] = useState("");
  const [menorEsMejor, setMenorEsMejor] = useState(false);
  const [puntos, setPuntos] = useState(borradorIA?.puntos ?? puntosPorDefecto(modalidad));

  // `null` = "Personalizada": ningún chip de nombre marcado, campos en blanco
  // para escribir desde cero (o lo que haya dejado el Asistente VIP).
  const [plantillaElegida, setPlantillaElegida] = useState<string | null>(null);

  const elegirPlantilla = (p: PlantillaCompetencia) => {
    setPlantillaElegida(p.nombre);
    setNombre(p.nombre);
    setDescripcion(p.descripcion);
    setRegla(p.regla);
    setMetrica(p.metrica);
    setUnidadManual(p.unidad ?? "");
    setMenorEsMejor(Boolean(p.menorEsMejor));
  };

  const elegirPersonalizada = () => {
    setPlantillaElegida(null);
    setNombre("");
    setDescripcion("");
    setRegla("");
    setUnidadManual("");
    setMenorEsMejor(false);
  };

  return (
    <div className="space-y-3">
      <Button onClick={() => setAbierto((v) => !v)}>
        <Swords size={18} /> {abierto ? "Cancelar" : "Crear competencia en Arena VIP"}
      </Button>

      {abierto && (
        <Card>
          {borradorIA && !state.ok && (
            <div className="mb-4 rounded-xl border border-vip/30 bg-vip/10 p-3">
              <p className="text-caption font-semibold text-vip">BORRADOR DEL ASISTENTE VIP</p>
              <p className="text-caption mt-1 text-text-secondary">
                Revisa participantes, fechas, regla y premio. La IA no puede publicarlo por ti.
              </p>
            </div>
          )}
          {state.ok ? (
            <div className="space-y-2 text-center">
              <p className="text-body text-text">
                Competencia publicada en Arena VIP. Los invitados ya pueden aceptar
                o rechazar desde su Inicio.
              </p>
              <button onClick={() => setAbierto(false)} className="text-secondary font-medium text-vip">
                Cerrar
              </button>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">MODALIDAD</label>
                <Select
                  name="modalidad"
                  value={modalidad}
                  onChange={(evento) => {
                    const nueva = evento.target.value;
                    setModalidad(nueva);
                    setPuntos(puntosPorDefecto(nueva));
                    if (nueva === "copa_constancia") setMetrica("progreso_vip");
                  }}
                >
                  <option value="duelo">Duelo VIP · exactamente 2 alumnos</option>
                  <option value="reto_coach">Reto del Coach · ejercicio o meta oficial</option>
                  <option value="copa_constancia">Copa de Constancia · varios alumnos</option>
                </Select>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">
                  NOMBRE DE LA COMPETENCIA
                </label>
                {/* Diez plantillas competitivas de gimnasio, listas para tocar. Cada
                    una llena nombre, descripción, regla y métrica de una — el
                    entrenador arma la competencia en un toque y ajusta si hace
                    falta, en vez de escribir todo desde cero. */}
                <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-1">
                  {PLANTILLAS.map((p) => (
                    <Chip key={p.nombre} activo={plantillaElegida === p.nombre} onClick={() => elegirPlantilla(p)}>
                      {p.nombre}
                    </Chip>
                  ))}
                  <Chip activo={plantillaElegida === null} onClick={elegirPersonalizada}>
                    Personalizada
                  </Chip>
                </div>
                <Input
                  name="nombre"
                  required
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    setPlantillaElegida(null);
                  }}
                  placeholder="Ej: Reto de sentadillas de agosto"
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">DESCRIPCIÓN (opcional)</label>
                <Textarea
                  name="descripcion"
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Reglas, premio, contexto…"
                />
                <p className="text-caption mt-1 text-text-tertiary">
                  Se llena sola al elegir una plantilla de nombre; edítala como quieras.
                </p>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">REGLA OFICIAL PARA GANAR</label>
                <Textarea
                  name="regla_publica"
                  rows={3}
                  required
                  value={regla}
                  onChange={(e) => setRegla(e.target.value)}
                  placeholder="Ej: Gana quien complete el mayor porcentaje de su rutina entre el lunes y el domingo."
                />
                <p className="text-caption mt-1 text-text-tertiary">
                  Todos la verán antes de aceptar y no podrá cambiarse después de comenzar.
                </p>
                {/* Banco aparte de la plantilla: la misma regla sirve para más de
                    un tipo de competencia, así que conviene poder elegirla suelta. */}
                <div className="mt-2 flex flex-col gap-1.5">
                  {REGLAS_BANCO.map((r) => (
                    <Chip key={r} activo={regla === r} onClick={() => setRegla(r)} ancho="completo">
                      {r}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">MÉTRICA</label>
                <Select
                  name="metrica"
                  value={metrica}
                  onChange={(e) => setMetrica(e.target.value as TorneoMetrica)}
                >
                  <option value="progreso_vip">Más Puntos VIP obtenidos en el periodo</option>
                  <option value="asistencia">Más asistencia al gimnasio</option>
                  <option value="peso_baja">Mayor bajada de peso corporal</option>
                  <option value="peso_sube">Mayor subida de peso corporal</option>
                  <option value="manual">
                    Otra (repeticiones, peso levantado…) — la cargas tú al final
                  </option>
                </Select>
              </div>

              {metrica === "manual" && (
                <div className="space-y-3 rounded-xl bg-surface-2 p-3">
                  <div>
                    <label className="text-caption mb-1.5 block text-text-tertiary">
                      UNIDAD (opcional, para mostrar)
                    </label>
                    <Input
                      name="unidad_manual"
                      value={unidadManual}
                      onChange={(e) => setUnidadManual(e.target.value)}
                      placeholder="Ej: repeticiones, kg, minutos…"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-secondary text-text">
                    <input
                      type="checkbox"
                      name="menor_es_mejor"
                      checked={menorEsMejor}
                      onChange={(e) => setMenorEsMejor(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Gana el número más bajo (ej. tiempo)
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">DESDE</label>
                  <Input name="fecha_inicio" type="date" defaultValue={borradorIA?.fechaInicio} required />
                </div>
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HORA (opcional)</label>
                  <Input name="hora_inicio" type="time" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HASTA</label>
                  <Input name="fecha_fin" type="date" defaultValue={borradorIA?.fechaFin} required />
                </div>
                <div>
                  <label className="text-caption mb-1.5 block text-text-tertiary">HORA (opcional)</label>
                  <Input name="hora_fin" type="time" />
                </div>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">BOLSA DE PREMIO VIP</label>
                {/* Los montos que el gimnasio ya maneja como referencia, para no
                    escribirlos a mano cada vez. El campo de abajo sigue
                    aceptando cualquier número si hace falta uno fuera de lista. */}
                <div className="flex flex-wrap gap-1.5">
                  {PREMIOS_BANCO.map((p) => (
                    <Chip key={p} activo={puntos === p} onClick={() => setPuntos(p)}>
                      {p.toLocaleString("es-CL")}
                    </Chip>
                  ))}
                </div>
                <Input
                  name="puntos_en_juego"
                  type="number"
                  min={1}
                  value={puntos}
                  onChange={(e) => setPuntos(Number(e.target.value))}
                  required
                  className="mt-2"
                />
                {/* Competir sigue sin costar nada. Lo que cambió es que el
                    público que NO compite puede apostar sus propios puntos
                    (ver 0069_torneo_apuestas.sql), y eso conviene decirlo acá:
                    al publicar la competencia le llega el aviso a todos. */}
                <p className="text-caption mt-1 text-text-tertiary">
                  VIP Fitness aporta la bolsa: los que compiten no arriesgan nada. El resto del
                  gimnasio recibe el aviso y puede apostar sus propios puntos por un favorito.
                </p>
              </div>

              <div>
                <label className="text-caption mb-1.5 block text-text-tertiary">
                  QUIÉN COMPITE — de un lado y del otro (contrincante)
                </label>
                <p className="text-caption mb-2 text-text-tertiary">
                  Cada alumno elegido recibe la invitación en su Inicio y tiene que aceptarla para
                  competir de verdad.{modalidad === "duelo" ? " Elige exactamente una persona en cada lado." : ""}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ListaLado titulo="LADO A" name="lado_a" alumnos={alumnos} seleccionado={borradorIA?.ladoA} />
                  <ListaLado titulo="CONTRINCANTE" name="lado_b" alumnos={alumnos} seleccionado={borradorIA?.ladoB} />
                </div>
              </div>

              {state.error && <p className="text-caption text-error">{state.error}</p>}

              <Button type="submit" variant="success" loading={pending}>
                {pending ? "Creando…" : "Publicar en Arena VIP"}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
