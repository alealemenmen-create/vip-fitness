import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerSaldoVip } from "@/lib/torneos/apuestas-data";

export type RecompensaVip = {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: "digital" | "servicio" | "fisica";
  costoPuntos: number;
  stock: number | null;
  requiereAprobacion: boolean;
  activa: boolean;
};

export type CanjeVip = {
  id: string;
  alumnoId: string;
  alumnoNombre: string;
  recompensaId: string;
  recompensaNombre: string;
  costo: number;
  estado: "solicitado" | "aprobado" | "entregado" | "rechazado" | "cancelado";
  nota: string | null;
  fecha: string;
};

function faltaMigracion(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /recompensas_vip_/i.test(error.message ?? "")));
}

export async function obtenerRecompensasAlumnoVip(alumnoId: string) {
  const db = createAdminClient();
  const [{ data: catalogo, error }, { data: canjes }, saldo] = await Promise.all([
    db.from("recompensas_vip_catalogo").select("id, nombre, descripcion, tipo, costo_puntos, stock, requiere_aprobacion, activo").eq("activo", true).lte("vigente_desde", new Date().toISOString()).or(`vigente_hasta.is.null,vigente_hasta.gt.${new Date().toISOString()}`).order("costo_puntos"),
    db.from("recompensas_vip_canjes").select("id, alumno_id, recompensa_id, costo_congelado, estado, nota_admin, solicitado_en").eq("alumno_id", alumnoId).order("solicitado_en", { ascending: false }).limit(12),
    obtenerSaldoVip(alumnoId),
  ]);
  if (faltaMigracion(error)) return { disponible: false, saldo, catalogo: [] as RecompensaVip[], canjes: [] as CanjeVip[] };
  const recompensas = catalogo ?? [];
  const nombrePorId = new Map(recompensas.map((item) => [item.id, item.nombre]));
  return {
    disponible: true,
    saldo,
    catalogo: recompensas.map((item) => ({ id: item.id, nombre: item.nombre, descripcion: item.descripcion, tipo: item.tipo, costoPuntos: item.costo_puntos, stock: item.stock, requiereAprobacion: item.requiere_aprobacion, activa: item.activo })),
    canjes: (canjes ?? []).map((canje) => ({ id: canje.id, alumnoId: canje.alumno_id, alumnoNombre: "Tú", recompensaId: canje.recompensa_id, recompensaNombre: nombrePorId.get(canje.recompensa_id) ?? "Recompensa VIP", costo: canje.costo_congelado, estado: canje.estado, nota: canje.nota_admin, fecha: canje.solicitado_en })),
  };
}

export async function obtenerAdminRecompensasVip() {
  const db = createAdminClient();
  const [{ data: catalogo, error }, { data: canjes }] = await Promise.all([
    db.from("recompensas_vip_catalogo").select("id, nombre, descripcion, tipo, costo_puntos, stock, requiere_aprobacion, activo").order("created_at", { ascending: false }),
    db.from("recompensas_vip_canjes").select("id, alumno_id, recompensa_id, costo_congelado, estado, nota_admin, solicitado_en").order("solicitado_en", { ascending: false }).limit(100),
  ]);
  if (faltaMigracion(error)) return { disponible: false, catalogo: [] as RecompensaVip[], canjes: [] as CanjeVip[] };
  const idsAlumnos = [...new Set((canjes ?? []).map((canje) => canje.alumno_id))];
  const { data: perfiles } = idsAlumnos.length ? await db.from("perfiles").select("id, nombre").in("id", idsAlumnos) : { data: [] };
  const nombres = new Map((perfiles ?? []).map((perfil) => [perfil.id, perfil.nombre]));
  const recompensas = catalogo ?? [];
  const nombrePorId = new Map(recompensas.map((item) => [item.id, item.nombre]));
  return {
    disponible: true,
    catalogo: recompensas.map((item) => ({ id: item.id, nombre: item.nombre, descripcion: item.descripcion, tipo: item.tipo, costoPuntos: item.costo_puntos, stock: item.stock, requiereAprobacion: item.requiere_aprobacion, activa: item.activo })),
    canjes: (canjes ?? []).map((canje) => ({ id: canje.id, alumnoId: canje.alumno_id, alumnoNombre: nombres.get(canje.alumno_id) ?? "Alumno VIP", recompensaId: canje.recompensa_id, recompensaNombre: nombrePorId.get(canje.recompensa_id) ?? "Recompensa VIP", costo: canje.costo_congelado, estado: canje.estado, nota: canje.nota_admin, fecha: canje.solicitado_en })),
  };
}
