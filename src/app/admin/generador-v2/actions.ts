"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRol } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { obtenerBiblioteca } from "@/lib/ejercicios/data";
import { patronMovimiento } from "@/lib/rutinas/patrones";
import { evaluarEntrevistaVipV2 } from "@/lib/generador-rutinas-v2/entrevista";
import { calcularDosisVipV2 } from "@/lib/generador-rutinas-v2/dosis";
import {
  construirSemanaVipV2,
  grupoDosisDelEjercicioV2,
  obtenerCatalogoElegibleVipV2,
  type DiaSemanaV2,
  type EjercicioConstructorV2,
} from "@/lib/generador-rutinas-v2/constructor-semanal";
import { auditarMesaEdicionVipV2 } from "@/lib/generador-rutinas-v2/mesa-edicion";
import type { EntrevistaVipV2 } from "@/lib/generador-rutinas-v2/tipos";
import {
  compararRutinasV2,
  nombreRutinaVersionadaV2,
  VERSION_PUBLICACION_VIP_2,
  type ComparacionPublicacionV2,
  type RutinaActivaComparacionV2,
  type RutinaPublicableV2,
} from "@/lib/generador-rutinas-v2/publicacion";

type Db = SupabaseClient;

type MetaEjercicioV2 = {
  id: string;
  impacto: EjercicioConstructorV2["impacto"];
  requiere_salto: boolean;
  complejidad: EjercicioConstructorV2["complejidad"];
  requiere_supervision: boolean;
  posicion_sesion: EjercicioConstructorV2["posicionSesion"];
  etiquetas_precaucion: string[] | null;
};

export type ResultadoGuardarVersionV2 =
  | {
      ok: true;
      borradorId: string;
      nombreRutina: string;
      comparacion: ComparacionPublicacionV2;
      guardadoEn: string;
    }
  | { ok: false; error: string };

export type ResultadoPublicarVersionV2 =
  | { ok: true; rutinaId: string; version: number; nombre: string }
  | { ok: false; error: string };

export type ResultadoRevertirVersionV2 =
  | { ok: true; rutinaId: string; version: number; nombre: string }
  | { ok: false; error: string };

async function cargarCatalogoServidor(db: Db): Promise<EjercicioConstructorV2[]> {
  const [biblioteca, { data: metadatos, error }] = await Promise.all([
    obtenerBiblioteca(),
    db
      .from("ejercicios")
      .select("id, impacto, requiere_salto, complejidad, requiere_supervision, posicion_sesion, etiquetas_precaucion")
      .eq("activo", true),
  ]);
  if (error) throw new Error("No fue posible verificar la biblioteca de ejercicios.");

  const metaPorId = new Map(((metadatos ?? []) as MetaEjercicioV2[]).map((meta) => [meta.id, meta]));
  return biblioteca.map((ejercicio) => {
    const meta = metaPorId.get(ejercicio.id);
    return {
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      aliases: ejercicio.aliases,
      grupoMuscular: ejercicio.grupoMuscular,
      categoria: ejercicio.categoria,
      equipo: ejercicio.equipo,
      nivel: ejercicio.nivel,
      patron: ejercicio.patronMovimiento ?? patronMovimiento(ejercicio.nombre, ejercicio.grupoMuscular),
      impacto: meta?.impacto ?? "bajo",
      requiereSalto: meta?.requiere_salto ?? false,
      complejidad: meta?.complejidad ?? "media",
      requiereSupervision: meta?.requiere_supervision ?? false,
      posicionSesion: meta?.posicion_sesion ?? "accesorio",
      etiquetasPrecaucion: meta?.etiquetas_precaucion ?? [],
    };
  });
}

function textoSeguro(valor: unknown, maximo: number) {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) : "";
}

function normalizarDiasEnServidor(
  dias: DiaSemanaV2[],
  elegibles: EjercicioConstructorV2[],
): DiaSemanaV2[] {
  if (!Array.isArray(dias) || dias.length < 1 || dias.length > 7) {
    throw new Error("La semana debe tener entre 1 y 7 días.");
  }
  const elegiblePorId = new Map(elegibles.map((ejercicio) => [ejercicio.id, ejercicio]));

  return dias.map((dia, indiceDia) => {
    if (!dia || !Array.isArray(dia.ejercicios) || dia.ejercicios.length < 1 || dia.ejercicios.length > 20) {
      throw new Error(`El día ${indiceDia + 1} necesita entre 1 y 20 ejercicios.`);
    }
    const nombreDia = textoSeguro(dia.nombre, 80);
    if (!nombreDia) throw new Error(`El día ${indiceDia + 1} necesita un nombre.`);

    const ejercicios = dia.ejercicios.map((entrada, indiceEjercicio) => {
      const catalogo = elegiblePorId.get(textoSeguro(entrada?.ejercicioId, 80));
      if (!catalogo) throw new Error(`Hay un ejercicio que ya no es compatible o no está activo en el catálogo.`);
      const grupo = grupoDosisDelEjercicioV2(catalogo);
      if (!grupo) throw new Error(`“${catalogo.nombre}” no puede ocupar una dosis muscular directa.`);

      const series = Number(entrada.series);
      const descansoSegundos = Number(entrada.descansoSegundos);
      const repeticiones = textoSeguro(entrada.repeticiones, 32);
      const rir = textoSeguro(entrada.rir, 12);
      if (!Number.isInteger(series) || series < 1 || series > 8) {
        throw new Error(`“${catalogo.nombre}” necesita entre 1 y 8 series.`);
      }
      if (!repeticiones || !/^[0-9–—\-+ a-záéíóúüñ.]+$/iu.test(repeticiones)) {
        throw new Error(`Revisa las repeticiones de “${catalogo.nombre}”.`);
      }
      if (!/^(?:[0-5](?:[–-][0-5])?)$/.test(rir)) {
        throw new Error(`Revisa el RIR de “${catalogo.nombre}”.`);
      }
      if (!Number.isInteger(descansoSegundos) || descansoSegundos < 30 || descansoSegundos > 300) {
        throw new Error(`“${catalogo.nombre}” necesita un descanso entre 30 y 300 segundos.`);
      }

      return {
        orden: indiceEjercicio + 1,
        ejercicioId: catalogo.id,
        nombre: catalogo.nombre,
        grupoDosis: grupo,
        patron: catalogo.patron,
        series,
        repeticiones,
        rir,
        descansoSegundos,
        motivo: textoSeguro(entrada.motivo, 300) || "Selección confirmada por el entrenador.",
        sustituciones: [],
      };
    });

    return {
      numero: indiceDia + 1,
      nombre: nombreDia,
      enfoque: Array.from(new Set(ejercicios.map((ejercicio) => ejercicio.grupoDosis))),
      seriesDirectas: ejercicios.reduce((total, ejercicio) => total + ejercicio.series, 0),
      minutosEstimados: Math.max(1, Math.round(ejercicios.reduce(
        (total, ejercicio) => total + ejercicio.series * (45 + ejercicio.descansoSegundos),
        0,
      ) / 60)),
      ejercicios,
    };
  });
}

type RutinaAnidada = {
  id: string;
  nombre: string;
  version: number;
  created_at: string;
  rutina_dias: Array<{
    numero_dia: number;
    nombre: string;
    orden: number;
    rutina_dia_ejercicios: Array<{
      ejercicio_id: string | null;
      nombre: string;
      series_programadas: number;
      orden: number;
    }>;
  }>;
};

function mapearRutinaActiva(fila: RutinaAnidada | null): RutinaActivaComparacionV2 | null {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    version: fila.version,
    createdAt: fila.created_at,
    dias: (fila.rutina_dias ?? [])
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((dia) => ({
        numero: dia.numero_dia,
        nombre: dia.nombre,
        ejercicios: (dia.rutina_dia_ejercicios ?? [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((ejercicio) => ({
            ejercicioId: ejercicio.ejercicio_id,
            nombre: ejercicio.nombre,
            series: ejercicio.series_programadas,
          })),
      })),
  };
}

async function cargarRutinaActiva(db: Db, alumnoId: string) {
  const { data, error } = await db
    .from("rutinas")
    .select("id, nombre, version, created_at, rutina_dias(numero_dia, nombre, orden, rutina_dia_ejercicios(ejercicio_id, nombre, series_programadas, orden))")
    .eq("alumno_id", alumnoId)
    .eq("activa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No fue posible leer la rutina activa para compararla.");
  return mapearRutinaActiva(data as unknown as RutinaAnidada | null);
}

function mensajeRpc(error: { message?: string } | null, respaldo: string) {
  const mensaje = error?.message ?? "";
  if (mensaje.includes("cambió desde que guardaste")) return "La rutina activa cambió desde que guardaste este borrador. Vuelve a guardarlo para comparar otra vez.";
  if (mensaje.includes("confirmación")) return "Escribe la confirmación exacta antes de continuar.";
  if (mensaje.includes("borrador")) return "Ese borrador ya no está disponible para publicar.";
  if (mensaje.includes("migración")) return "La base de datos aún no tiene instalada la Publicación Versionada VIP 2.0.";
  return respaldo;
}

export async function guardarBorradorVersionadoV2(params: {
  alumnoId: string;
  entrevista: EntrevistaVipV2;
  dias: DiaSemanaV2[];
}): Promise<ResultadoGuardarVersionV2> {
  const sesion = await requireRol(["entrenador", "admin"]);
  if (!params?.alumnoId || params.entrevista?.alumnoId !== params.alumnoId) {
    return { ok: false, error: "La entrevista no corresponde a la persona seleccionada." };
  }
  if (JSON.stringify(params).length > 500_000) return { ok: false, error: "El borrador supera el tamaño permitido." };

  try {
    const supabase = await createClient();
    const db = supabase as unknown as Db;
    const [{ data: alumno, error: errorAlumno }, catalogo, activa, { data: ultimaVersion }] = await Promise.all([
      db.from("perfiles").select("id, nombre").eq("id", params.alumnoId).maybeSingle(),
      cargarCatalogoServidor(db),
      cargarRutinaActiva(db, params.alumnoId),
      db.from("rutinas").select("version").eq("alumno_id", params.alumnoId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (errorAlumno || !alumno) return { ok: false, error: "No tienes acceso a esa persona o su perfil ya no existe." };

    const evaluacion = evaluarEntrevistaVipV2(params.entrevista);
    const dosis = calcularDosisVipV2(params.entrevista);
    const constructor = construirSemanaVipV2(params.entrevista, dosis, catalogo);
    if (!evaluacion.puedeConstruirSemana || dosis.estado !== "calculado" || constructor.estado !== "borrador") {
      return { ok: false, error: "La entrevista todavía no habilita una publicación segura." };
    }

    const elegibles = obtenerCatalogoElegibleVipV2(params.entrevista, dosis, catalogo);
    const dias = normalizarDiasEnServidor(params.dias, elegibles);
    const auditoria = auditarMesaEdicionVipV2(dias, dosis, constructor);
    if (!auditoria.puedeAprobar || auditoria.alertasBloqueantes.length > 0) {
      return { ok: false, error: auditoria.alertasBloqueantes[0] ?? "La auditoría del servidor no aprobó este borrador." };
    }

    const versionPropuesta = Number(ultimaVersion?.version ?? 0) + 1;
    const rutina: RutinaPublicableV2 = {
      version: VERSION_PUBLICACION_VIP_2,
      nombreRutina: nombreRutinaVersionadaV2(alumno.nombre as string, params.entrevista.objetivo.principal, versionPropuesta),
      dias,
    };
    const guardadoEn = new Date().toISOString();
    const brief = {
      motor: "vip_2_0",
      publicacionVersion: VERSION_PUBLICACION_VIP_2,
      entrevistaVersion: params.entrevista.version,
      dosisVersion: dosis.version,
      constructorVersion: constructor.version,
      versionPropuesta,
      rutinaBaseId: activa?.id ?? null,
      rutinaBaseVersion: activa?.version ?? null,
    };

    const { data: borradorGuardado, error: errorGuardado } = await db
      .from("borradores_generador_rutinas")
      .insert({
        alumno_id: params.alumnoId,
        entrenador_id: sesion.userId,
        estado: "aprobado",
        brief,
        perfil_snapshot: params.entrevista,
        resultado: rutina,
        reglas_aplicadas: [...dosis.progresion, ...constructor.reglasAplicadas],
        alertas: [...dosis.alertas, ...constructor.alertas, ...auditoria.advertencias],
        origen: "manual",
        aprobado_en: guardadoEn,
        updated_at: guardadoEn,
      })
      .select("id")
      .single();
    if (errorGuardado || !borradorGuardado) {
      return { ok: false, error: "No fue posible guardar el borrador versionado en la base de datos." };
    }

    return {
      ok: true,
      borradorId: borradorGuardado.id as string,
      nombreRutina: rutina.nombreRutina,
      comparacion: compararRutinasV2(activa, rutina, versionPropuesta),
      guardadoEn,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No fue posible guardar el borrador versionado." };
  }
}

export async function publicarBorradorVersionadoV2(
  borradorId: string,
  confirmacion: string,
): Promise<ResultadoPublicarVersionV2> {
  await requireRol(["entrenador", "admin"]);
  if (!borradorId || confirmacion !== "PUBLICAR") return { ok: false, error: "Escribe PUBLICAR para confirmar." };

  const supabase = await createClient();
  const db = supabase as unknown as Db;
  const { data, error } = await db.rpc("publicar_borrador_rutina_v2", {
    p_borrador_id: borradorId,
    p_confirmacion: confirmacion,
  });
  if (error || !data) return { ok: false, error: mensajeRpc(error, "No fue posible publicar la versión. La rutina anterior sigue activa.") };

  const resultado = data as { rutinaId?: string; version?: number; nombre?: string };
  if (!resultado.rutinaId || !resultado.version || !resultado.nombre) {
    return { ok: false, error: "La publicación no devolvió una versión válida." };
  }
  revalidatePath("/admin/generador-v2");
  revalidatePath("/admin/rutinas-generadas");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/inicio");
  return { ok: true, rutinaId: resultado.rutinaId, version: resultado.version, nombre: resultado.nombre };
}

export async function revertirRutinaVersionadaV2(
  rutinaDestinoId: string,
  confirmacion: string,
): Promise<ResultadoRevertirVersionV2> {
  await requireRol(["entrenador", "admin"]);
  if (!rutinaDestinoId || confirmacion !== "REVERTIR") return { ok: false, error: "Escribe REVERTIR para confirmar." };

  const supabase = await createClient();
  const db = supabase as unknown as Db;
  const { data, error } = await db.rpc("revertir_rutina_versionada_v2", {
    p_rutina_destino_id: rutinaDestinoId,
    p_confirmacion: confirmacion,
  });
  if (error || !data) return { ok: false, error: mensajeRpc(error, "No fue posible restaurar la versión anterior.") };

  const resultado = data as { rutinaId?: string; version?: number; nombre?: string };
  if (!resultado.rutinaId || !resultado.version || !resultado.nombre) {
    return { ok: false, error: "La reversión no devolvió una versión válida." };
  }
  revalidatePath("/admin/generador-v2");
  revalidatePath("/admin/rutinas-generadas");
  revalidatePath("/alumno/entrenar");
  revalidatePath("/alumno/inicio");
  return { ok: true, rutinaId: resultado.rutinaId, version: resultado.version, nombre: resultado.nombre };
}
