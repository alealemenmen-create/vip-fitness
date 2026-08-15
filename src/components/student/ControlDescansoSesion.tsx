"use client";

import { useState, useTransition } from "react";
import { Timer, X } from "lucide-react";
import { actualizarTemporizadorDescansoAlumno } from "@/app/alumno/entrenar/actions";

/** Ajuste voluntario y global de los descansos para la sesión actual. Mantiene
 * los segundos que programó el entrenador como guía; lo único opcional es el
 * reloj y, por lo tanto, la penalización por pasarse de ese tiempo. */
export function ControlDescansoSesion({
  temporizadorActivo,
  descansoPersonalizadoSegundos,
  onCambio,
}: {
  temporizadorActivo: boolean;
  descansoPersonalizadoSegundos: number | null;
  onCambio: (modo: "libre" | "entrenador" | 40 | 60 | 90 | 120) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(temporizadorActivo);
  const [modo, setModo] = useState<"libre" | "entrenador" | 40 | 60 | 90 | 120>(
    temporizadorActivo
      ? ([40, 60, 90, 120].includes(descansoPersonalizadoSegundos ?? 0)
          ? (descansoPersonalizadoSegundos as 40 | 60 | 90 | 120)
          : "entrenador")
      : "libre"
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  const cambiar = (siguiente: "libre" | "entrenador" | 40 | 60 | 90 | 120) => {
    if (siguiente === modo || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await actualizarTemporizadorDescansoAlumno(siguiente);
      if (!resultado.ok) {
        setError(resultado.error ?? "No fue posible ajustar el descanso.");
        return;
      }
      setModo(siguiente);
      setActivo(siguiente !== "libre");
      onCambio(siguiente);
      setAbierto(false);
    });
  };

  return (
    <div className="control-descanso-sesion">
      <button
        type="button"
        onClick={() => {
          setError(null);
          setAbierto((visible) => !visible);
        }}
        className="control-descanso-sesion-enlace"
        aria-expanded={abierto}
      >
        <Timer size={11} strokeWidth={1.8} aria-hidden />
        {activo ? `Descanso ${typeof modo === "number" ? `${modo}s` : "del entrenador"}` : "Descanso libre"}
      </button>

      {abierto && (
        <div className="control-descanso-sesion-panel" role="dialog" aria-label="Ajustar descanso">
          <div className="control-descanso-sesion-titulo">
            <span>Control de descanso</span>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar ajuste de descanso">
              <X size={13} />
            </button>
          </div>
          <p>
            {activo
              ? "Elige el tiempo del entrenador o un reloj fijo para toda esta sesión."
              : "Descanso libre: no hay reloj ni descuento por tiempo; tus 50 puntos siguen disponibles al finalizar."}
          </p>
          <div className="control-descanso-sesion-opciones" role="group" aria-label="Modo de descanso">
            <button type="button" data-activo={modo === "entrenador" ? "true" : "false"} disabled={pendiente} onClick={() => cambiar("entrenador")}>
              Tiempo entrenador
            </button>
            <button
              type="button"
              data-activo={modo === "libre" ? "true" : "false"}
              disabled={pendiente}
              onClick={() => cambiar("libre")}
            >
              Descanso libre
            </button>
          </div>
          <div className="control-descanso-sesion-opciones control-descanso-sesion-segundos" role="group" aria-label="Duración del descanso">
            {[40, 60, 90, 120].map((segundos) => (
              <button
                key={segundos}
                type="button"
                data-activo={modo === segundos ? "true" : "false"}
                disabled={pendiente}
                onClick={() => cambiar(segundos as 40 | 60 | 90 | 120)}
              >
                {segundos}s
              </button>
            ))}
          </div>
          {error && <p className="control-descanso-sesion-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
