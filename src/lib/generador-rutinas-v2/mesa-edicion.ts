import type { ResultadoMotorDosisV2 } from "@/lib/generador-rutinas-v2/dosis";
import type {
  DiaSemanaV2,
  EjercicioSemanaV2,
  ResultadoConstructorSemanalV2,
} from "@/lib/generador-rutinas-v2/constructor-semanal";
import { GRUPOS_DOSIS_V2, type GrupoDosisV2 } from "@/lib/generador-rutinas-v2/tipos";

export const VERSION_MESA_EDICION_VIP_2 = 1 as const;

export type AuditoriaGrupoMesaV2 = {
  grupo: GrupoDosisV2;
  objetivoSeries: number;
  seriesEditadas: number;
  objetivoFrecuencia: number;
  frecuenciaEditada: number;
  cumpleSeries: boolean;
  cumpleFrecuencia: boolean;
};

export type AuditoriaDiaMesaV2 = {
  numero: number;
  nombre: string;
  ejercicios: number;
  series: number;
  minutosEstimados: number;
  minutosPermitidos: number | null;
  cumpleTiempo: boolean;
};

export type ResultadoMesaEdicionV2 = {
  version: typeof VERSION_MESA_EDICION_VIP_2;
  estado: "sin_borrador" | "bloqueada_revision" | "requiere_ajustes" | "lista_para_aprobar";
  alertasBloqueantes: string[];
  advertencias: string[];
  cambiosRespectoAlBorrador: number;
  seriesObjetivo: number;
  seriesEditadas: number;
  porGrupo: AuditoriaGrupoMesaV2[];
  porDia: AuditoriaDiaMesaV2[];
  puedeAprobar: boolean;
};

export type CambioPrescripcionMesaV2 = Partial<Pick<EjercicioSemanaV2, "series" | "repeticiones" | "rir" | "descansoSegundos">>;

function clonarDias(dias: DiaSemanaV2[]): DiaSemanaV2[] {
  return dias.map((dia) => ({
    ...dia,
    enfoque: [...dia.enfoque],
    ejercicios: dia.ejercicios.map((ejercicio) => ({
      ...ejercicio,
      sustituciones: ejercicio.sustituciones.map((sustitucion) => ({ ...sustitucion })),
    })),
  }));
}

function normalizarOrdenes(dias: DiaSemanaV2[]): DiaSemanaV2[] {
  return dias.map((dia, indiceDia) => {
    const ejercicios = dia.ejercicios.map((ejercicio, indice) => ({ ...ejercicio, orden: indice + 1 }));
    const enfoque = [...new Set(ejercicios.map((ejercicio) => ejercicio.grupoDosis))];
    return {
      ...dia,
      numero: indiceDia + 1,
      enfoque,
      seriesDirectas: ejercicios.reduce((total, ejercicio) => total + ejercicio.series, 0),
      minutosEstimados: estimarMinutosDiaVipV2(ejercicios),
      ejercicios,
    };
  });
}

export function estimarMinutosDiaVipV2(ejercicios: EjercicioSemanaV2[]): number {
  if (ejercicios.length === 0) return 0;
  const segundos = ejercicios.reduce(
    (total, ejercicio) => total + ejercicio.series * (45 + ejercicio.descansoSegundos),
    0,
  );
  return Math.ceil(10 + segundos / 60 + Math.max(0, ejercicios.length - 1));
}

export function actualizarPrescripcionMesaV2(
  dias: DiaSemanaV2[],
  diaNumero: number,
  orden: number,
  cambio: CambioPrescripcionMesaV2,
): DiaSemanaV2[] {
  const copia = clonarDias(dias);
  const dia = copia.find((item) => item.numero === diaNumero);
  const indice = dia?.ejercicios.findIndex((item) => item.orden === orden) ?? -1;
  if (!dia || indice < 0) return copia;
  dia.ejercicios[indice] = { ...dia.ejercicios[indice], ...cambio };
  return normalizarOrdenes(copia);
}

export function reemplazarEjercicioMesaV2(
  dias: DiaSemanaV2[],
  diaNumero: number,
  orden: number,
  reemplazo: Pick<EjercicioSemanaV2, "ejercicioId" | "nombre" | "grupoDosis" | "patron" | "motivo" | "sustituciones">,
): DiaSemanaV2[] {
  const copia = clonarDias(dias);
  const dia = copia.find((item) => item.numero === diaNumero);
  const indice = dia?.ejercicios.findIndex((item) => item.orden === orden) ?? -1;
  if (!dia || indice < 0) return copia;
  dia.ejercicios[indice] = { ...dia.ejercicios[indice], ...reemplazo };
  return normalizarOrdenes(copia);
}

export function moverEjercicioMesaV2(
  dias: DiaSemanaV2[],
  diaNumero: number,
  orden: number,
  direccion: -1 | 1,
): DiaSemanaV2[] {
  const copia = clonarDias(dias);
  const dia = copia.find((item) => item.numero === diaNumero);
  const indice = dia?.ejercicios.findIndex((item) => item.orden === orden) ?? -1;
  const destino = indice + direccion;
  if (!dia || indice < 0 || destino < 0 || destino >= dia.ejercicios.length) return copia;
  [dia.ejercicios[indice], dia.ejercicios[destino]] = [dia.ejercicios[destino], dia.ejercicios[indice]];
  return normalizarOrdenes(copia);
}

export function eliminarEjercicioMesaV2(dias: DiaSemanaV2[], diaNumero: number, orden: number): DiaSemanaV2[] {
  const copia = clonarDias(dias);
  const dia = copia.find((item) => item.numero === diaNumero);
  if (!dia) return copia;
  dia.ejercicios = dia.ejercicios.filter((item) => item.orden !== orden);
  return normalizarOrdenes(copia);
}

export function agregarEjercicioMesaV2(dias: DiaSemanaV2[], diaNumero: number, ejercicio: EjercicioSemanaV2): DiaSemanaV2[] {
  const copia = clonarDias(dias);
  const dia = copia.find((item) => item.numero === diaNumero);
  if (!dia) return copia;
  dia.ejercicios.push({ ...ejercicio, orden: dia.ejercicios.length + 1 });
  return normalizarOrdenes(copia);
}

export function moverDiaMesaV2(dias: DiaSemanaV2[], diaNumero: number, direccion: -1 | 1): DiaSemanaV2[] {
  const copia = clonarDias(dias);
  const indice = copia.findIndex((dia) => dia.numero === diaNumero);
  const destino = indice + direccion;
  if (indice < 0 || destino < 0 || destino >= copia.length) return copia;
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return normalizarOrdenes(copia);
}

function firmaEjercicio(ejercicio: EjercicioSemanaV2): string {
  return [
    ejercicio.ejercicioId,
    ejercicio.series,
    ejercicio.repeticiones,
    ejercicio.rir,
    ejercicio.descansoSegundos,
  ].join("|");
}

function contarCambios(base: DiaSemanaV2[], editados: DiaSemanaV2[]): number {
  let cambios = Math.abs(base.length - editados.length);
  const cantidadDias = Math.max(base.length, editados.length);
  for (let indiceDia = 0; indiceDia < cantidadDias; indiceDia += 1) {
    const original = base[indiceDia];
    const editado = editados[indiceDia];
    if (!original || !editado) continue;
    if (original.nombre !== editado.nombre) cambios += 1;
    const cantidadEjercicios = Math.max(original.ejercicios.length, editado.ejercicios.length);
    for (let indice = 0; indice < cantidadEjercicios; indice += 1) {
      const ejercicioOriginal = original.ejercicios[indice];
      const ejercicioEditado = editado.ejercicios[indice];
      if (!ejercicioOriginal || !ejercicioEditado || firmaEjercicio(ejercicioOriginal) !== firmaEjercicio(ejercicioEditado)) cambios += 1;
    }
  }
  return cambios;
}

function validarPrescripciones(dias: DiaSemanaV2[]): string[] {
  const alertas: string[] = [];
  for (const dia of dias) {
    if (dia.ejercicios.length === 0) alertas.push(`Día ${dia.numero}: no puede quedar sin ejercicios.`);
    const vistos = new Set<string>();
    for (const ejercicio of dia.ejercicios) {
      const prefijo = `Día ${dia.numero} · ${ejercicio.nombre}`;
      if (!Number.isInteger(ejercicio.series) || ejercicio.series < 1 || ejercicio.series > 8) alertas.push(`${prefijo}: las series deben estar entre 1 y 8.`);
      if (!ejercicio.repeticiones.trim() || ejercicio.repeticiones.length > 30) alertas.push(`${prefijo}: revisa el rango de repeticiones.`);
      if (!ejercicio.rir.trim() || ejercicio.rir.length > 12) alertas.push(`${prefijo}: revisa el RIR.`);
      if (!Number.isInteger(ejercicio.descansoSegundos) || ejercicio.descansoSegundos < 30 || ejercicio.descansoSegundos > 300) alertas.push(`${prefijo}: el descanso debe estar entre 30 y 300 segundos.`);
      if (vistos.has(ejercicio.ejercicioId)) alertas.push(`Día ${dia.numero}: ${ejercicio.nombre} aparece duplicado.`);
      vistos.add(ejercicio.ejercicioId);
    }
  }
  return alertas;
}

export function auditarMesaEdicionVipV2(
  diasEditados: DiaSemanaV2[],
  dosis: ResultadoMotorDosisV2,
  borradorBase: ResultadoConstructorSemanalV2,
): ResultadoMesaEdicionV2 {
  if (borradorBase.estado === "no_disponible" || dosis.estado === "no_disponible") {
    return {
      version: VERSION_MESA_EDICION_VIP_2,
      estado: "sin_borrador",
      alertasBloqueantes: ["Todavía no existe una semana utilizable para editar."],
      advertencias: [],
      cambiosRespectoAlBorrador: 0,
      seriesObjetivo: 0,
      seriesEditadas: 0,
      porGrupo: [],
      porDia: [],
      puedeAprobar: false,
    };
  }

  const dias = normalizarOrdenes(clonarDias(diasEditados));
  const alertas = validarPrescripciones(dias);
  const minutosPermitidos = dosis.estructura.minutosPorSesion;
  const porDia: AuditoriaDiaMesaV2[] = dias.map((dia) => {
    const minutosEstimados = estimarMinutosDiaVipV2(dia.ejercicios);
    const cumpleTiempo = minutosPermitidos === null || minutosEstimados <= minutosPermitidos;
    if (!cumpleTiempo) alertas.push(`Día ${dia.numero}: estima ${minutosEstimados} minutos y supera el límite de ${minutosPermitidos}.`);
    return {
      numero: dia.numero,
      nombre: dia.nombre,
      ejercicios: dia.ejercicios.length,
      series: dia.ejercicios.reduce((total, ejercicio) => total + ejercicio.series, 0),
      minutosEstimados,
      minutosPermitidos,
      cumpleTiempo,
    };
  });

  if (dias.length !== dosis.estructura.diasRecomendados) {
    alertas.push(`La dosis recomienda ${dosis.estructura.diasRecomendados} días y la mesa contiene ${dias.length}.`);
  }

  const porGrupo: AuditoriaGrupoMesaV2[] = dosis.dosisPorGrupo.map((objetivo) => {
    const diasGrupo = dias.filter((dia) => dia.ejercicios.some((ejercicio) => ejercicio.grupoDosis === objetivo.grupo));
    const seriesEditadas = diasGrupo.reduce(
      (total, dia) => total + dia.ejercicios
        .filter((ejercicio) => ejercicio.grupoDosis === objetivo.grupo)
        .reduce((suma, ejercicio) => suma + ejercicio.series, 0),
      0,
    );
    const cumpleSeries = seriesEditadas === objetivo.seriesDirectasSemanales.objetivo;
    const cumpleFrecuencia = diasGrupo.length === objetivo.frecuenciaSemanal;
    if (!cumpleSeries) alertas.push(`${objetivo.grupo}: ${seriesEditadas} series editadas; la dosis objetivo indica ${objetivo.seriesDirectasSemanales.objetivo}.`);
    if (!cumpleFrecuencia) alertas.push(`${objetivo.grupo}: frecuencia ${diasGrupo.length}×; la dosis objetivo indica ${objetivo.frecuenciaSemanal}×.`);
    for (const dia of diasGrupo) {
      const seriesDia = dia.ejercicios
        .filter((ejercicio) => ejercicio.grupoDosis === objetivo.grupo)
        .reduce((total, ejercicio) => total + ejercicio.series, 0);
      if (seriesDia > objetivo.maximoPorSesion) {
        alertas.push(`Día ${dia.numero} · ${objetivo.grupo}: ${seriesDia} series superan el máximo de ${objetivo.maximoPorSesion} por sesión.`);
      }
    }
    return {
      grupo: objetivo.grupo,
      objetivoSeries: objetivo.seriesDirectasSemanales.objetivo,
      seriesEditadas,
      objetivoFrecuencia: objetivo.frecuenciaSemanal,
      frecuenciaEditada: diasGrupo.length,
      cumpleSeries,
      cumpleFrecuencia,
    };
  });

  const alertasUnicas = [...new Set(alertas)];
  const bloqueadaRevision = borradorBase.estado === "provisional_revision" || dosis.estado === "provisional_revision";
  const estado = bloqueadaRevision
    ? "bloqueada_revision"
    : alertasUnicas.length > 0
      ? "requiere_ajustes"
      : "lista_para_aprobar";
  const seriesObjetivo = dosis.dosisPorGrupo.reduce((total, grupo) => total + grupo.seriesDirectasSemanales.objetivo, 0);
  const seriesEditadas = GRUPOS_DOSIS_V2.reduce(
    (total, grupo) => total + (porGrupo.find((item) => item.grupo === grupo)?.seriesEditadas ?? 0),
    0,
  );

  return {
    version: VERSION_MESA_EDICION_VIP_2,
    estado,
    alertasBloqueantes: alertasUnicas,
    advertencias: [
      ...(bloqueadaRevision ? ["La adaptación funcional o de seguridad pendiente debe resolverse antes de aprobar."] : []),
      "La aprobación de esta mesa es local y todavía no publica la rutina al alumno.",
    ],
    cambiosRespectoAlBorrador: contarCambios(borradorBase.dias, dias),
    seriesObjetivo,
    seriesEditadas,
    porGrupo,
    porDia,
    puedeAprobar: estado === "lista_para_aprobar",
  };
}

export function copiarDiasMesaV2(dias: DiaSemanaV2[]): DiaSemanaV2[] {
  return normalizarOrdenes(clonarDias(dias));
}
