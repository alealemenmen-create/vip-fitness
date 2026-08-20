import type { SeguimientoHoy } from "@/app/alumno/inicio/data";

export type PreparacionDiariaAlejandro = {
  estado: "sin_checkin" | "estable" | "precaucion" | "proteccion";
  titulo: string;
  detalle: string;
  maximoMomentos: number | null;
};

/**
 * El check-in no diagnostica ni reemplaza al entrenador. Su única función
 * automática es poner un techo conservador a los retos extra de Alejandro;
 * nunca modifica la rutina base ni prescribe ante dolor.
 */
export function evaluarPreparacionDiariaAlejandro(seguimiento: SeguimientoHoy): PreparacionDiariaAlejandro {
  if (!seguimiento) {
    return {
      estado: "sin_checkin",
      titulo: "Sin check-in de hoy",
      detalle: "Impulso VIP conserva la programación, pero no intensifica con señales de recuperación incompletas.",
      maximoMomentos: 1,
    };
  }

  if (seguimiento.molestias?.trim()) {
    return {
      estado: "proteccion",
      titulo: "Progresión protegida",
      detalle: "Hay una molestia reportada. Los retos extra quedan pausados y el entrenador recibe el aviso.",
      maximoMomentos: 0,
    };
  }

  const sueno = seguimiento.horas_sueno;
  const energia = seguimiento.energia;
  if ((sueno !== null && sueno < 5) || (energia !== null && energia <= 2)) {
    return {
      estado: "proteccion",
      titulo: "Recuperación baja",
      detalle: "Hoy se mantiene la rutina base sin técnicas intensivas adicionales.",
      maximoMomentos: 0,
    };
  }

  if ((sueno !== null && sueno < 6.5) || energia === 3) {
    return {
      estado: "precaucion",
      titulo: "Exigencia controlada",
      detalle: "Impulso VIP limita la sesión a un solo momento estratégico.",
      maximoMomentos: 1,
    };
  }

  return {
    estado: "estable",
    titulo: "Preparación estable",
    detalle: "Las señales de hoy permiten mantener los momentos planificados.",
    maximoMomentos: null,
  };
}

export function limitarMomentosPorPreparacion<T>(momentos: T[], preparacion: PreparacionDiariaAlejandro) {
  return preparacion.maximoMomentos === null ? momentos : momentos.slice(0, preparacion.maximoMomentos);
}
