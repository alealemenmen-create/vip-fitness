import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { obtenerHallazgosPendientes } from "@/lib/auditoria/data";
import { obtenerResumenAlertasGastos } from "@/lib/gastos/data";

export type CategoriaPendiente = {
  id: string;
  etiqueta: string;
  descripcion: string;
  cantidad: number;
  /** "error" = bloquea o vence; "warning" = requiere revisión; "neutral" =
   * informativo, sin urgencia real. Mismo criterio de color que el resto del
   * panel (sección 3.4 del instructivo de reorganización). */
  severidad: "error" | "warning" | "neutral";
  href: string;
};

/**
 * Cola única de todo lo que espera una decisión del entrenador, reunida
 * desde sus fuentes reales — no es una tabla nueva, cada categoría sigue
 * viviendo y resolviéndose donde ya vivía (Solicitudes, Auditoría, Errores
 * reportados, Pedidos de borrado, Galería, Gastos). Sección 9.4 del
 * instructivo de reorganización del panel: "agrupa por tipo y severidad;
 * marca resuelto cuando el origen se corrige" — como esto solo LEE cada
 * fuente en el momento, un pendiente resuelto en su pantalla de origen
 * desaparece acá solo, sin ningún estado propio que sincronizar.
 */
/** `cache()`: Control VIP V2 la pide una vez en el layout (para la insignia
 * de la pestaña Hoy) y otra vez en la página — sin memoizar por request
 * serían el doble de consultas por carga. `/admin/pendientes` la sigue
 * llamando igual, solo que ahora comparte resultado si algo más la pide en
 * el mismo request. */
export const obtenerColaPendientes = cache(async function obtenerColaPendientes(): Promise<CategoriaPendiente[]> {
  const supabase = await createClient();

  const [
    { count: solicitudesPendientes },
    { count: reportesFotosPendientes },
    { count: reportesBugsPendientes },
    { count: borradosPendientes },
    hallazgosAuditoria,
    gastosAlerta,
  ] = await Promise.all([
    supabase.from("solicitudes_registro").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("reportes_fotos_ejercicios").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("reportes_bugs").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("solicitudes_borrado_sesion").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    obtenerHallazgosPendientes(),
    obtenerResumenAlertasGastos(),
  ]);

  // Las rutinas por rehacer no se descartan (se reemplazan) — cuentan aparte
  // en Auditoría, pero acá suman igual: siguen siendo trabajo pendiente.
  const hallazgosParaDecidir = hallazgosAuditoria.filter((h) => h.tipo !== "rutina_activa_deficiente").length;
  const rutinasPorRehacer = hallazgosAuditoria.length - hallazgosParaDecidir;

  const categorias: CategoriaPendiente[] = [
    {
      id: "solicitudes",
      etiqueta: "Solicitudes de ingreso",
      descripcion: "Pedidos de inscripción nuevos, esperando aprobación",
      cantidad: solicitudesPendientes ?? 0,
      severidad: "warning",
      href: "/admin/solicitudes",
    },
    {
      id: "fotos",
      etiqueta: "Reportes de fotos",
      descripcion: "Ejercicios con foto reportada como incorrecta o faltante",
      cantidad: reportesFotosPendientes ?? 0,
      severidad: "warning",
      href: "/admin/ejercicios#reportes-ejercicios",
    },
    {
      id: "auditoria",
      etiqueta: "Auditoría de Puntos VIP",
      descripcion: "Hallazgos esperando descartar o penalizar",
      cantidad: hallazgosParaDecidir,
      severidad: "neutral",
      href: "/admin/auditoria",
    },
    {
      id: "rutinas-deficientes",
      etiqueta: "Rutinas activas con observaciones",
      descripcion: "No se descartan: se corrigen publicando un reemplazo",
      cantidad: rutinasPorRehacer,
      severidad: "neutral",
      href: "/admin/auditoria",
    },
    {
      id: "bugs",
      etiqueta: "Errores reportados",
      descripcion: "Fallas que los alumnos avisaron desde la app",
      cantidad: reportesBugsPendientes ?? 0,
      severidad: "warning",
      href: "/admin/reportes",
    },
    {
      id: "borrados",
      etiqueta: "Pedidos de borrado",
      descripcion: "Sesiones que un alumno pidió eliminar de su historial",
      cantidad: borradosPendientes ?? 0,
      severidad: "warning",
      href: "/admin/borrados",
    },
    {
      id: "gastos",
      etiqueta: "Gastos de la app",
      descripcion: "Pagos próximos a vencer o ya vencidos",
      cantidad: gastosAlerta.pendientes,
      severidad: gastosAlerta.vencidos > 0 ? "error" : "warning",
      href: "/admin/gastos",
    },
  ];

  // Solo lo que de verdad tiene algo pendiente — una cola vacía de "Gastos"
  // no es información útil, es ruido.
  return categorias.filter((c) => c.cantidad > 0).sort((a, b) => b.cantidad - a.cantidad);
});
