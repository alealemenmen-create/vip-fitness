import type { DiaSemanaV2 } from "@/lib/generador-rutinas-v2/constructor-semanal";

export const VERSION_PUBLICACION_VIP_2 = 1 as const;

export type RutinaPublicableV2 = {
  version: typeof VERSION_PUBLICACION_VIP_2;
  nombreRutina: string;
  dias: DiaSemanaV2[];
};

export type RutinaActivaComparacionV2 = {
  id: string;
  nombre: string;
  version: number;
  createdAt: string;
  dias: Array<{
    numero: number;
    nombre: string;
    ejercicios: Array<{
      ejercicioId: string | null;
      nombre: string;
      series: number;
    }>;
  }>;
};

export type ResumenRutinaV2 = {
  dias: number;
  ejercicios: number;
  series: number;
};

export type ComparacionPublicacionV2 = {
  esPrimeraVersion: boolean;
  versionPropuesta: number;
  activa: RutinaActivaComparacionV2 | null;
  resumenActivo: ResumenRutinaV2;
  resumenPropuesto: ResumenRutinaV2;
  ejerciciosAgregados: string[];
  ejerciciosRetirados: string[];
};

function claveEjercicio(ejercicioId: string | null, nombre: string) {
  return ejercicioId ?? nombre.trim().toLocaleLowerCase("es");
}

function resumirDias(dias: Array<{ ejercicios: Array<{ series: number }> }>): ResumenRutinaV2 {
  return {
    dias: dias.length,
    ejercicios: dias.reduce((total, dia) => total + dia.ejercicios.length, 0),
    series: dias.reduce(
      (total, dia) => total + dia.ejercicios.reduce((subtotal, ejercicio) => subtotal + ejercicio.series, 0),
      0,
    ),
  };
}

function diferenciaMulticonjunto(
  origen: Array<{ ejercicioId: string | null; nombre: string }>,
  destino: Array<{ ejercicioId: string | null; nombre: string }>,
) {
  const disponibles = new Map<string, number>();
  for (const ejercicio of origen) {
    const clave = claveEjercicio(ejercicio.ejercicioId, ejercicio.nombre);
    disponibles.set(clave, (disponibles.get(clave) ?? 0) + 1);
  }

  const diferencia: string[] = [];
  for (const ejercicio of destino) {
    const clave = claveEjercicio(ejercicio.ejercicioId, ejercicio.nombre);
    const cantidad = disponibles.get(clave) ?? 0;
    if (cantidad > 0) disponibles.set(clave, cantidad - 1);
    else diferencia.push(ejercicio.nombre);
  }
  return diferencia;
}

export function compararRutinasV2(
  activa: RutinaActivaComparacionV2 | null,
  propuesta: RutinaPublicableV2,
  versionPropuesta: number,
): ComparacionPublicacionV2 {
  const ejerciciosActivos = activa?.dias.flatMap((dia) => dia.ejercicios) ?? [];
  const ejerciciosPropuestos = propuesta.dias.flatMap((dia) =>
    dia.ejercicios.map((ejercicio) => ({
      ejercicioId: ejercicio.ejercicioId,
      nombre: ejercicio.nombre,
    })),
  );

  return {
    esPrimeraVersion: activa === null,
    versionPropuesta,
    activa,
    resumenActivo: activa ? resumirDias(activa.dias) : { dias: 0, ejercicios: 0, series: 0 },
    resumenPropuesto: resumirDias(propuesta.dias),
    ejerciciosAgregados: diferenciaMulticonjunto(ejerciciosActivos, ejerciciosPropuestos),
    ejerciciosRetirados: diferenciaMulticonjunto(ejerciciosPropuestos, ejerciciosActivos),
  };
}

export function nombreRutinaVersionadaV2(
  nombreAlumno: string,
  objetivo: string | null,
  version: number,
) {
  const objetivoLegible = (objetivo ?? "entrenamiento")
    .replaceAll("_", " ")
    .replace(/^./, (letra) => letra.toUpperCase());
  return `Plan ${objetivoLegible} — ${nombreAlumno.trim() || "Alumno"} — v${version}`;
}
