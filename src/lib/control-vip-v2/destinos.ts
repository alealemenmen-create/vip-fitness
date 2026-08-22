import {
  Bug,
  CircleDollarSign,
  ClipboardList,
  Dumbbell,
  Landmark,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  PanelsTopLeft,
  PencilRuler,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import type { DestinoAdmin, GrupoDestinos } from "@/lib/admin/destinos";

/**
 * Navegación de Control VIP V2 (Fase 1, docs/PROYECTO_CONTROL_VIP_V2.md §5.2).
 * Mismo tipo (`DestinoAdmin`/`GrupoDestinos`) que `src/lib/admin/destinos.ts`,
 * pero una lista propia: la navegación nueva agrupa distinto que la actual
 * (p. ej. "Progreso y puntos" no existe como grupo en /admin) y todavía no
 * reemplaza esa lista.
 *
 * En esta fase solo `Hoy` y `Más` son pantallas nuevas de verdad. Todo lo
 * demás apunta directo a su ruta `/admin/...` real — el documento pide
 * explícitamente conservar las rutas antiguas como respaldo hasta que cada
 * pantalla tenga su equivalente V2 (§10). Cada fase siguiente reemplaza un
 * enlace-puente por una pantalla propia.
 */
export const GRUPOS_DESTINOS_CONTROL_VIP_V2: GrupoDestinos[] = [
  {
    label: "Hoy",
    items: [
      {
        href: "/control-vip",
        label: "Hoy",
        detalle: "Decisiones, alumnos y producción del día",
        icon: LayoutDashboard,
        seccion: "hoy",
      },
    ],
  },
  {
    label: "Alumnos",
    items: [
      {
        href: "/control-vip/alumnos",
        label: "Alumnos",
        detalle: "Directorio, prioridad y fichas",
        icon: Users,
        seccion: "alumnos",
      },
      {
        href: "/admin/solicitudes",
        label: "Solicitudes de ingreso",
        detalle: "Quién pidió entrar al gimnasio",
        icon: ClipboardList,
        seccion: "alumnos",
        soloAdmin: true,
      },
      {
        href: "/admin/ingresos",
        label: "Ingresos y asistencia",
        detalle: "Quién entró y cuándo",
        icon: Landmark,
        seccion: "alumnos",
      },
    ],
  },
  {
    label: "Rutinas",
    items: [
      {
        href: "/control-vip/rutinas",
        label: "Rutinas",
        detalle: "Armar, generar, reutilizar e importar",
        icon: PencilRuler,
        seccion: "rutinas",
      },
    ],
  },
  {
    label: "Galería",
    items: [
      {
        href: "/control-vip/galeria",
        label: "Galería de ejercicios",
        detalle: "Fotos, videos y control de calidad",
        icon: Dumbbell,
        seccion: "galeria",
      },
    ],
  },
  {
    label: "Progreso y puntos",
    items: [
      {
        href: "/control-vip/puntos",
        label: "Otorgar puntos",
        detalle: "Ajustes manuales de Puntos VIP",
        icon: Sparkles,
        seccion: "progreso",
        soloAdmin: true,
      },
      {
        href: "/control-vip/torneos",
        label: "Arena VIP",
        detalle: "Competencias y temporadas",
        icon: Trophy,
        seccion: "progreso",
        soloAdmin: true,
      },
    ],
  },
  {
    label: "Comunicación",
    items: [
      {
        href: "/control-vip/noticias",
        label: "Noticias",
        detalle: "Avisos que ven los alumnos",
        icon: Megaphone,
        seccion: "comunicacion",
        soloAdmin: true,
      },
      {
        href: "/control-vip/reportes",
        label: "Errores reportados",
        detalle: "Fallas que avisaron los alumnos",
        icon: Bug,
        seccion: "comunicacion",
        soloAdmin: true,
      },
      {
        href: "/control-vip/resenas",
        label: "Reseñas de la app",
        detalle: "Estrellas y sugerencias de los alumnos",
        icon: Star,
        seccion: "comunicacion",
        soloAdmin: true,
      },
    ],
  },
  {
    label: "Estudio VIP",
    items: [
      {
        href: "/control-vip/estudio-vip",
        label: "Estudio VIP",
        detalle: "Diseño, contenidos y publicación de Portal V2",
        icon: PanelsTopLeft,
        seccion: "estudio-vip",
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        href: "/control-vip/gastos",
        label: "Gastos de la app",
        detalle: "Pagos de servicios y vencimientos",
        icon: CircleDollarSign,
        seccion: "administracion",
        soloAdmin: true,
      },
      {
        href: "/control-vip/auditoria",
        label: "Auditoría de Puntos VIP",
        detalle: "Historial y hallazgos por revisar",
        icon: ShieldCheck,
        seccion: "administracion",
        soloAdmin: true,
      },
      {
        href: "/control-vip/borrados",
        label: "Pedidos de borrado",
        detalle: "Solicitudes de eliminación de datos",
        icon: Trash2,
        seccion: "administracion",
        soloAdmin: true,
      },
      {
        href: "/admin/configuracion",
        label: "Configuración",
        detalle: "Cuenta, sistema y ajustes",
        icon: Settings,
        seccion: "administracion",
        soloAdmin: true,
      },
    ],
  },
];

/** Los 5 destinos de la barra móvil (doc §5.1). Hoy y Más son pantallas
 * nuevas; Alumnos, Rutinas y Galería son puente a `/admin/...`. */
export const MOBILE_TABS_CONTROL_VIP_V2: DestinoAdmin[] = [
  GRUPOS_DESTINOS_CONTROL_VIP_V2[0].items[0], // Hoy
  GRUPOS_DESTINOS_CONTROL_VIP_V2[1].items[0], // Alumnos
  GRUPOS_DESTINOS_CONTROL_VIP_V2[2].items[0], // Rutinas
  GRUPOS_DESTINOS_CONTROL_VIP_V2[3].items[0], // Galería
  {
    href: "/control-vip/mas",
    label: "Más",
    detalle: "Todo el panel nuevo, con buscador",
    icon: MoreHorizontal,
    seccion: "mas",
  },
];

/** Plano, para el comando global. */
export const DESTINOS_CONTROL_VIP_V2: DestinoAdmin[] = GRUPOS_DESTINOS_CONTROL_VIP_V2.flatMap(
  (grupo) => grupo.items
);

export function gruposControlVipV2ParaRol(rol: "entrenador" | "admin"): GrupoDestinos[] {
  return GRUPOS_DESTINOS_CONTROL_VIP_V2
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => rol === "admin" || !item.soloAdmin),
    }))
    .filter((grupo) => grupo.items.length > 0);
}
