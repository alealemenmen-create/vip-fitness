import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularPuntosAlimentacion, calcularPuntosEntrenamiento, PUNTOS_VIP } from "./reglas";

type Categoria = "entrenamiento" | "alimentacion" | "progreso" | "constancia" | "ajuste";

type Movimiento = {
  alumnoId: string;
  clave: string;
  categoria: Categoria;
  puntos: number;
  titulo: string;
  detalle?: string | null;
  fecha: string;
  metadata?: Record<string, unknown>;
};

function lunesDe(fechaISO: string): string {
  const fecha = new Date(`${fechaISO}T12:00:00Z`);
  const desplazamiento = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - desplazamiento);
  return fecha.toISOString().slice(0, 10);
}

export async function guardarMovimiento(movimiento: Movimiento): Promise<number> {
  const admin = createAdminClient();
  const { error } = await admin.from("puntos_vip_movimientos").upsert(
    {
      alumno_id: movimiento.alumnoId,
      clave: movimiento.clave,
      categoria: movimiento.categoria,
      puntos: Math.max(0, Math.round(movimiento.puntos)),
      titulo: movimiento.titulo,
      detalle: movimiento.detalle ?? null,
      fecha: movimiento.fecha,
      metadata: movimiento.metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "alumno_id,clave" }
  );
  if (error) throw new Error(`No fue posible guardar Puntos VIP: ${error.message}`);
  return Math.max(0, Math.round(movimiento.puntos));
}

export async function registrarEntrenamiento({
  alumnoId,
  sesionId,
  fecha,
  completados,
  total,
}: {
  alumnoId: string;
  sesionId: string;
  fecha: string;
  completados: number;
  total: number;
}) {
  const puntos = calcularPuntosEntrenamiento(completados, total);
  return guardarMovimiento({
    alumnoId,
    clave: `entrenamiento:${sesionId}`,
    categoria: "entrenamiento",
    puntos,
    titulo: "Entrenamiento finalizado",
    detalle: `${completados} de ${total} ejercicios completados`,
    fecha,
    metadata: { sesionId, completados, total },
  });
}

export async function desactivarEntrenamiento(alumnoId: string, sesionId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `entrenamiento:${sesionId}`,
    categoria: "entrenamiento",
    puntos: 0,
    titulo: "Entrenamiento reabierto",
    detalle: "Los puntos se confirmaran al finalizar nuevamente.",
    fecha,
    metadata: { sesionId },
  });
}

export async function recalcularAlimentacionDia(alumnoId: string, fecha: string): Promise<number> {
  const admin = createAdminClient();
  const [{ data: plan }, { data: registro }] = await Promise.all([
    admin
      .from("planes_alimentacion")
      .select("kcal_objetivo")
      .eq("alumno_id", alumnoId)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("registros_diarios")
      .select("comidas_registradas(omitida, alimentos_consumidos(cantidad, alimentos(kcal, porcion_base)))")
      .eq("alumno_id", alumnoId)
      .eq("fecha", fecha)
      .maybeSingle(),
  ]);

  let kcal = 0;
  type Comida = {
    omitida: boolean;
    alimentos_consumidos: { cantidad: number; alimentos: { kcal: number; porcion_base: number } | null }[] | null;
  };
  const comidas = (registro?.comidas_registradas as unknown as Comida[] | null) ?? [];
  for (const comida of comidas) {
    if (comida.omitida) continue;
    for (const consumido of comida.alimentos_consumidos ?? []) {
      if (!consumido.alimentos || consumido.alimentos.porcion_base <= 0) continue;
      kcal += (consumido.cantidad / consumido.alimentos.porcion_base) * consumido.alimentos.kcal;
    }
  }

  const objetivo = plan?.kcal_objetivo ?? null;
  const puntos = calcularPuntosAlimentacion(kcal, objetivo);
  const porcentaje = objetivo && objetivo > 0 ? Math.round((kcal / objetivo) * 100) : null;
  return guardarMovimiento({
    alumnoId,
    clave: `alimentacion:${fecha}`,
    categoria: "alimentacion",
    puntos,
    titulo: "Progreso de alimentacion",
    detalle: porcentaje === null ? `${Math.round(kcal)} kcal registradas` : `${porcentaje}% de la meta diaria`,
    fecha,
    metadata: { kcal: Math.round(kcal), objetivo, porcentaje },
  });
}

export async function registrarCheckin(alumnoId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `checkin:${fecha}`,
    categoria: "constancia",
    puntos: PUNTOS_VIP.checkinDiario,
    titulo: "Check-in diario",
    detalle: "Seguimiento completado",
    fecha,
  });
}

export async function registrarPeso(alumnoId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `peso:${lunesDe(fecha)}`,
    categoria: "progreso",
    puntos: PUNTOS_VIP.pesoSemanal,
    titulo: "Peso semanal registrado",
    detalle: "Una recompensa por semana",
    fecha,
  });
}

export async function registrarFoto(alumnoId: string, fecha: string) {
  return guardarMovimiento({
    alumnoId,
    clave: `foto:${lunesDe(fecha)}`,
    categoria: "progreso",
    puntos: PUNTOS_VIP.fotoSemanal,
    titulo: "Foto de progreso",
    detalle: "Seguimiento visual de la semana",
    fecha,
  });
}
