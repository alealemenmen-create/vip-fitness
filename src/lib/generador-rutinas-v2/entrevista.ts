import { calcularEdad } from "@/lib/date";
import {
  crearEntrevistaVipV2,
  type ContextoEspecial,
  type DivisionCompetitivaV2,
  type EntrevistaVipV2,
  type EstadoSeguridadV2,
  type NivelExperienciaV2,
  type ObjetivoVipV2,
  type PerfilActualParaV2,
  type ResultadoEntrevistaVipV2,
} from "@/lib/generador-rutinas-v2/tipos";

const MAPA_OBJETIVOS: Record<string, ObjetivoVipV2> = {
  hipertrofia: "hipertrofia",
  fuerza: "fuerza",
  recomposicion: "recomposicion",
  perdida_grasa: "perdida_grasa",
  condicion_fisica: "salud",
  rendimiento: "rendimiento",
  mantencion: "salud",
};

const MAPA_DIVISIONES: Record<string, DivisionCompetitivaV2> = {
  mens_physique: "mens_physique",
  classic_physique: "classic_physique",
  bodybuilding_open: "mens_open",
  bikini: "bikini",
  wellness: "wellness",
  womens_physique: "womens_physique",
};

function etapaPorEdad(edad: number | null): EntrevistaVipV2["persona"]["etapaVida"] {
  if (edad !== null && edad < 18) return "joven";
  if (edad !== null && edad >= 65) return "adulto_mayor";
  return "adulto";
}

function tieneTexto(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function entrevistaDesdePerfilActual(perfil: PerfilActualParaV2): EntrevistaVipV2 {
  const entrevista = crearEntrevistaVipV2(perfil.alumnoId);
  const edad = perfil.fechaNacimiento ? calcularEdad(perfil.fechaNacimiento) : null;
  entrevista.persona.edad = edad;
  entrevista.persona.etapaVida = etapaPorEdad(edad);
  entrevista.objetivo.principal = perfil.objetivoPrincipal ? MAPA_OBJETIVOS[perfil.objetivoPrincipal] ?? null : null;
  entrevista.objetivo.noSacrificar = perfil.objetivoSecundario ?? "";
  entrevista.recursos.diasReales = perfil.diasDisponibles;
  entrevista.recursos.minutosSesion = perfil.minutosSesion;
  entrevista.preferencias.ejerciciosPreferidos = perfil.ejerciciosPreferidos ?? "";
  entrevista.preferencias.ejerciciosNoDeseados = perfil.ejerciciosNoDeseados ?? "";
  entrevista.recuperacion.actividadConcurrente = perfil.actividadesAdicionales ?? "";

  if (perfil.preferenciaEquipo === "maquinas" || perfil.preferenciaEquipo === "peso_libre") {
    entrevista.recursos.equipo = perfil.preferenciaEquipo;
  } else if (perfil.preferenciaEquipo === "indistinto") {
    entrevista.recursos.equipo = "gimnasio_completo";
  }

  if (perfil.experiencia === "intermedio" || perfil.experiencia === "avanzado") {
    entrevista.experiencia.nivelDeclarado = perfil.experiencia;
  }

  if (tieneTexto(perfil.molestias)) entrevista.seguridad.dolorActual = "si";
  if (tieneTexto(perfil.operacionesPrevias)) entrevista.seguridad.cirugiaReciente = "si";
  if (perfil.autorizacionMedica) entrevista.seguridad.altaProfesionalSiAplica = "si";
  if (tieneTexto(perfil.condicionesMedicas) || tieneTexto(perfil.lesionesDiagnosticadas) || tieneTexto(perfil.medicamentosRelevantes)) {
    entrevista.seguridad.requiereCoordinacionProfesional = "si";
  }
  entrevista.seguridad.detalle = [
    perfil.molestias,
    perfil.lesionesDiagnosticadas,
    perfil.operacionesPrevias,
    perfil.condicionesMedicas,
    perfil.medicamentosRelevantes,
  ].filter(tieneTexto).join(" · ");

  const division = perfil.categoriaCompetencia ? MAPA_DIVISIONES[perfil.categoriaCompetencia] : null;
  if (division) {
    entrevista.competencia.division = division;
    entrevista.competencia.compite = perfil.categoriaCompetencia === "ninguna" ? "no" : "sin_responder";
  }
  return entrevista;
}

export function calcularNivelExperiencia(entrevista: EntrevistaVipV2): NivelExperienciaV2 {
  const meses = entrevista.experiencia.practicaConsistenteMeses ?? 0;
  const tecnica = entrevista.experiencia.tecnicaReproducible === "si";
  const rir = entrevista.experiencia.estimaRir === "si";
  const registro = entrevista.experiencia.registraCargas === "si";
  const autorregula = entrevista.experiencia.autorregula === "si";

  if (meses >= 48 && tecnica && rir && registro && autorregula && entrevista.experiencia.nivelDeclarado === "elite_profesional") {
    return "elite_profesional";
  }
  if (meses >= 24 && tecnica && rir && registro && autorregula) return "avanzado";
  if (meses >= 6 && tecnica && rir) return "intermedio";
  return "novato";
}

export function evaluarSeguridad(entrevista: EntrevistaVipV2): { estado: EstadoSeguridadV2; razones: string[] } {
  const s = entrevista.seguridad;
  const obligatorias = [s.sintomasAlarma, s.condicionInestable, s.dolorActual, s.cirugiaReciente, s.caidasRecientes, s.requiereCoordinacionProfesional];
  if (obligatorias.some((respuesta) => respuesta === "sin_responder")) {
    return { estado: "incompleto", razones: ["Falta completar el cribado de seguridad."] };
  }

  const bloqueos: string[] = [];
  if (s.sintomasAlarma === "si") bloqueos.push("Hay síntomas de alarma declarados.");
  if (s.condicionInestable === "si") bloqueos.push("Hay una condición inestable declarada.");
  if (s.cirugiaReciente === "si" && s.altaProfesionalSiAplica !== "si") bloqueos.push("Hay cirugía reciente sin alta confirmada.");
  if (bloqueos.length > 0) return { estado: "bloqueado", razones: bloqueos };

  const revisiones: string[] = [];
  if (s.dolorActual === "si") revisiones.push("Existe dolor actual y requiere adaptación explícita.");
  if (s.caidasRecientes === "si") revisiones.push("Se declararon caídas recientes.");
  if (s.requiereCoordinacionProfesional === "si") revisiones.push("La persona requiere coordinación o revisión profesional.");
  if (entrevista.persona.contextos.some((contexto) => contexto === "embarazo_posparto" || contexto === "fragilidad_riesgo_caida")) {
    revisiones.push("El contexto seleccionado requiere revisión antes de calcular la dosis.");
  }
  return revisiones.length > 0 ? { estado: "requiere_revision", razones: revisiones } : { estado: "habilitado", razones: [] };
}

function requiereFuncionDetallada(contextos: ContextoEspecial[]): boolean {
  return contextos.some((contexto) =>
    ["discapacidad_fisica", "discapacidad_sensorial", "discapacidad_intelectual", "fragilidad_riesgo_caida", "deporte_adaptado"].includes(contexto)
  );
}

export function preguntasPendientes(entrevista: EntrevistaVipV2): string[] {
  const pendientes: string[] = [];
  const s = entrevista.seguridad;
  if ([s.sintomasAlarma, s.condicionInestable, s.dolorActual, s.cirugiaReciente, s.caidasRecientes, s.requiereCoordinacionProfesional].includes("sin_responder")) {
    pendientes.push("Completar la puerta de seguridad.");
  }
  if (s.cirugiaReciente === "si" && s.altaProfesionalSiAplica === "sin_responder") pendientes.push("Confirmar si existe alta posterior a la cirugía.");

  if (requiereFuncionDetallada(entrevista.persona.contextos)) {
    const valoresFuncion = Object.entries(entrevista.funcion).filter(([campo]) => campo !== "ayudasTecnicas").map(([, valor]) => valor);
    if (valoresFuncion.some((valor) => valor === "sin_responder")) pendientes.push("Describir función, acceso y ayudas relevantes.");
  } else if (entrevista.funcion.movilidad === "sin_responder" || entrevista.funcion.estabilidad === "sin_responder" || entrevista.funcion.rangoActivo === "sin_responder") {
    pendientes.push("Confirmar movilidad, estabilidad y rango tolerado.");
  }

  if (entrevista.experiencia.practicaConsistenteMeses === null || entrevista.experiencia.tecnicaReproducible === "sin_responder" || entrevista.experiencia.estimaRir === "sin_responder") {
    pendientes.push("Demostrar el nivel técnico y la capacidad de estimar RIR.");
  }
  if (!entrevista.objetivo.principal) pendientes.push("Definir un objetivo principal medible.");
  if (entrevista.competencia.compite === "sin_responder") pendientes.push("Confirmar si compite o no.");
  if (entrevista.competencia.compite === "si") {
    if (!entrevista.competencia.division) pendientes.push("Elegir la división competitiva.");
    if (!entrevista.competencia.fase) pendientes.push("Indicar la fase competitiva.");
    if (!entrevista.competencia.fechaEvento) pendientes.push("Registrar la fecha del evento.");
  }
  if (entrevista.dosisReciente.estadoHistorial === "sin_responder") {
    pendientes.push("Confirmar si existe historial reciente, es novato o está retornando.");
  } else if (entrevista.dosisReciente.estadoHistorial === "con_historial" && entrevista.dosisReciente.semanasObservadas < 4) {
    pendientes.push("Registrar al menos cuatro semanas de entrenamiento reciente.");
  }
  if (entrevista.recuperacion.sueno === null || entrevista.recuperacion.energia === null || entrevista.recuperacion.estres === null || entrevista.recuperacion.doms === null) {
    pendientes.push("Completar el estado de recuperación.");
  }
  if (!entrevista.recursos.diasReales || !entrevista.recursos.minutosSesion || entrevista.recursos.equipo === "sin_responder" || entrevista.recursos.supervision === "sin_responder") {
    pendientes.push("Confirmar días, tiempo, equipo y supervisión reales.");
  }
  if (entrevista.medicion.metricas.length === 0 || !entrevista.medicion.revisionCadaSemanas) pendientes.push("Definir cómo y cuándo se revisará la rutina.");
  return pendientes;
}

export function evaluarEntrevistaVipV2(entrevista: EntrevistaVipV2): ResultadoEntrevistaVipV2 {
  const seguridad = evaluarSeguridad(entrevista);
  const pendientes = preguntasPendientes(entrevista);
  const nivel = calcularNivelExperiencia(entrevista);
  const historialSuficiente = entrevista.dosisReciente.estadoHistorial === "novato_sin_historial"
    || entrevista.dosisReciente.estadoHistorial === "retorno_sin_historial"
    || (entrevista.dosisReciente.estadoHistorial === "con_historial" && entrevista.dosisReciente.semanasObservadas >= 4);
  const puedeCalcularDosis = seguridad.estado !== "bloqueado" && seguridad.estado !== "incompleto" && historialSuficiente && entrevista.objetivo.principal !== null;
  const puedeConstruirSemana = puedeCalcularDosis && pendientes.length === 0;
  const confianza = puedeConstruirSemana ? "alta" : puedeCalcularDosis ? "media" : "baja";
  return {
    estadoSeguridad: seguridad.estado,
    razonesSeguridad: seguridad.razones,
    nivelExperienciaCalculado: nivel,
    preguntasPendientes: pendientes,
    puedeCalcularDosis,
    puedeConstruirSemana,
    confianza,
  };
}
