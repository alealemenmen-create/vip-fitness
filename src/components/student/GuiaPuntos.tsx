"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Utensils,
  Scale,
  Camera,
  LogIn,
  TrendingUp,
  Timer,
  Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PUNTOS_VIP } from "@/lib/ranking/reglas";

type Fila = {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  puntos: string;
  positivo: boolean;
};

const FILAS: Fila[] = [
  {
    icono: <Dumbbell size={16} />,
    titulo: "Completar tu entrenamiento",
    detalle: "Proporcional a cuántos ejercicios del día terminaste — completarlo entero da el máximo.",
    puntos: `hasta +${PUNTOS_VIP.entrenamientoMaximo}`,
    positivo: true,
  },
  {
    icono: <Utensils size={16} />,
    titulo: "Cumplir tu meta de calorías",
    detalle: "Se evalúa al cerrar el día — cuanto más cerca de tu meta, más puntos.",
    puntos: `hasta +${PUNTOS_VIP.alimentacionMaximo}`,
    positivo: true,
  },
  {
    icono: <LogIn size={16} />,
    titulo: "Entrar a la app cada día",
    detalle: "Se suma una sola vez por día, la primera vez que abres la app.",
    puntos: `+${PUNTOS_VIP.ingresoDiario}`,
    positivo: true,
  },
  {
    icono: <Scale size={16} />,
    titulo: "Registrar tu peso",
    detalle: "Una vez por semana.",
    puntos: `+${PUNTOS_VIP.pesoSemanal}`,
    positivo: true,
  },
  {
    icono: <Camera size={16} />,
    titulo: "Subir una foto de progreso",
    detalle: "Una vez cada 15 días.",
    puntos: `+${PUNTOS_VIP.fotoQuincenal}`,
    positivo: true,
  },
  {
    icono: <TrendingUp size={16} />,
    titulo: "Cumplir la meta de Impulso VIP",
    detalle: "Un bono chico por cada ejercicio con progresión automática donde cumples o superas lo sugerido — tope por sesión.",
    puntos: `hasta +${PUNTOS_VIP.impulsoMaximoPorSesion}`,
    positivo: true,
  },
  {
    icono: <Trophy size={16} />,
    titulo: "Ganar una competencia de Arena VIP",
    detalle: "Los puntos en juego los define tu entrenador al crear cada competencia.",
    puntos: "variable",
    positivo: true,
  },
  {
    icono: <Utensils size={16} />,
    titulo: "No registrar ninguna comida en el día",
    detalle: "Penalización al cerrar un día sin ningún alimento cargado.",
    puntos: `${PUNTOS_VIP.alimentacionSinRegistro}`,
    positivo: false,
  },
  {
    icono: <Timer size={16} />,
    titulo: "Descansar de más entre series",
    detalle: `Se descuentan puntos por cada ${PUNTOS_VIP.descansoSegundosPorTramo}s de más sobre el descanso indicado, con un tope por serie.`,
    puntos: `hasta -${PUNTOS_VIP.descansoPenalizacionMaxima}`,
    positivo: false,
  },
];

/** Guía visible de cómo se ganan (y se pierden) los Puntos VIP — pedido
 * explícito para que cualquier alumno pueda ver, sin preguntar, de dónde
 * sale cada número del ranking. Plegada por defecto: es información de
 * referencia, no algo que haya que leer cada vez que se entra a Ranked. */
export function GuiaPuntos() {
  const [abierta, setAbierta] = useState(false);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="ranked-casino-card radius-control flex w-full items-center justify-between px-4 py-3"
      >
        <div className="text-left">
          <p className="text-secondary font-semibold text-text">¿Cómo se ganan los puntos?</p>
          <p className="text-caption mt-0.5 text-text-tertiary">Toda la guía de Puntos VIP</p>
        </div>
        {abierta ? (
          <ChevronUp size={18} className="shrink-0 text-text-secondary" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-text-secondary" />
        )}
      </button>

      {abierta && (
        <div className="space-y-1.5">
          {FILAS.map((fila) => (
            <Card key={fila.titulo} padding="p-3" className="ranked-casino-card flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  fila.positivo ? "bg-vip/15 text-vip" : "bg-error/15 text-error"
                }`}
              >
                {fila.icono}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-secondary font-semibold text-text">{fila.titulo}</p>
                  <span
                    className={`text-caption shrink-0 font-bold ${fila.positivo ? "text-vip" : "text-error"}`}
                  >
                    {fila.puntos}
                  </span>
                </div>
                <p className="text-caption mt-0.5 text-text-secondary">{fila.detalle}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
