import {
  Bell,
  Bot,
  Bug,
  ClipboardCheck,
  ClipboardList,
  CircleDollarSign,
  Dumbbell,
  FileText,
  History,
  Landmark,
  Megaphone,
  Salad,
  Settings,
  Sparkles,
  ShieldCheck,
  Star,
  Trash2,
  Trophy,
  Users,
  WandSparkles,
  PencilRuler,
  type LucideIcon,
} from "lucide-react";

/**
 * Único inventario de destinos del Panel del Entrenador.
 *
 * La barra lateral de escritorio y el directorio "Más" leen de ACÁ, no de dos
 * listas paralelas: el instructivo pide que usen los mismos nombres y grupos
 * (§4.2) y que **todos** los destinos aparezcan también dentro de Más (§4.1),
 * incluidos los que ya están a un toque en la barra inferior. Con dos listas
 * eso se desincroniza a la primera ruta nueva — que es exactamente lo que
 * había pasado: Errores reportados y Pedidos de borrado vivían en la barra
 * lateral y no había forma de llegar a ellos desde el celular.
 *
 * `seccion` es la que decide qué pestaña de la barra inferior se enciende y
 * qué contador le corresponde; ver `estaActivo` y `pendientesDe` en
 * `AdminTabs.tsx`.
 */
export type DestinoAdmin = {
  href: string;
  label: string;
  /** Una línea de qué se hace ahí. Se muestra en Más, no en la barra lateral. */
  detalle: string;
  icon: LucideIcon;
  seccion: string;
  /** Sólo el propietario/administrador puede ver y abrir esta herramienta. */
  soloAdmin?: boolean;
};

export type GrupoDestinos = {
  label: string;
  items: DestinoAdmin[];
};

export const GRUPOS_DESTINOS: GrupoDestinos[] = [
  {
    label: "Trabajo diario",
    items: [
      {
        href: "/admin/alumnos",
        label: "Alumnos",
        detalle: "Directorio, prioridad y seguimiento",
        icon: Users,
        seccion: "alumnos",
      },
      {
        href: "/admin/solicitudes",
        label: "Solicitudes de ingreso",
        detalle: "Quién pidió entrar al gimnasio",
        icon: ClipboardList,
        seccion: "solicitudes",
        soloAdmin: true,
      },
      {
        href: "/admin/ingresos",
        label: "Ingresos y asistencia",
        detalle: "Quién entró y cuándo",
        icon: Landmark,
        seccion: "ingresos",
      },
    ],
  },
  {
    label: "Rutinas",
    items: [
      {
        href: "/admin/armar-rutina",
        label: "Armar manualmente",
        detalle: "Control total, ejercicio por ejercicio",
        icon: PencilRuler,
        seccion: "rutinas",
      },
      {
        href: "/admin/generador",
        label: "Generar con reglas",
        detalle: "Cuestionario y motor VIP",
        icon: WandSparkles,
        seccion: "rutinas",
      },
      {
        href: "/admin/rutinas-generadas",
        label: "Rutinas hechas",
        detalle: "Reutilizar y editar lo ya armado",
        icon: History,
        seccion: "rutinas",
      },
      {
        href: "/admin/documentos",
        label: "Documentos y asignaciones",
        detalle: "Importar archivos y asignarlos",
        icon: FileText,
        seccion: "rutinas",
      },
    ],
  },
  {
    label: "Bibliotecas",
    items: [
      {
        href: "/admin/ejercicios",
        label: "Galería de ejercicios",
        detalle: "Fotos, videos y control de calidad",
        icon: Dumbbell,
        seccion: "ejercicios",
        soloAdmin: true,
      },
      {
        href: "/admin/alimentos",
        label: "Biblioteca de alimentos",
        detalle: "Catálogo y pendientes de aprobar",
        icon: Salad,
        seccion: "alimentos",
        soloAdmin: true,
      },
    ],
  },
  {
    label: "Automatización y control",
    items: [
      {
        href: "/admin/pendientes",
        label: "Pendientes",
        detalle: "Cola de excepciones por resolver",
        icon: ClipboardCheck,
        seccion: "pendientes",
      },
      {
        href: "/admin/asistente",
        label: "Asistente VIP",
        detalle: "Informes y acciones sugeridas",
        icon: Bot,
        seccion: "asistente",
      },
      {
        href: "/admin/auditoria",
        label: "Auditoría de Puntos VIP",
        detalle: "Historial y hallazgos por revisar",
        icon: ShieldCheck,
        seccion: "auditoria",
        soloAdmin: true,
      },
      {
        href: "/admin/puntos",
        label: "Otorgar puntos",
        detalle: "Ajustes manuales de Puntos VIP",
        icon: Sparkles,
        seccion: "puntos",
        soloAdmin: true,
      },
      {
        href: "/admin/reportes",
        label: "Errores reportados",
        detalle: "Fallas que avisaron los alumnos",
        icon: Bug,
        seccion: "reportes",
        soloAdmin: true,
      },
      {
        href: "/admin/resenas",
        label: "Reseñas de la app",
        detalle: "Estrellas y sugerencias de los alumnos",
        icon: Star,
        seccion: "resenas",
        soloAdmin: true,
      },
      {
        href: "/admin/borrados",
        label: "Pedidos de borrado",
        detalle: "Solicitudes de eliminación de datos",
        icon: Trash2,
        seccion: "borrados",
        soloAdmin: true,
      },
    ],
  },
  {
    label: "Comunidad",
    items: [
      {
        href: "/admin/torneos",
        label: "Arena VIP",
        detalle: "Competencias y temporadas",
        icon: Trophy,
        seccion: "torneos",
        soloAdmin: true,
      },
      {
        href: "/admin/noticias",
        label: "Noticias",
        detalle: "Avisos que ven los alumnos",
        icon: Megaphone,
        seccion: "noticias",
        soloAdmin: true,
      },
    ],
  },
  {
    label: "Administración",
    items: [
      {
        href: "/admin/gastos",
        label: "Gastos de la app",
        detalle: "Pagos de servicios y vencimientos",
        icon: CircleDollarSign,
        seccion: "gastos",
        soloAdmin: true,
      },
      {
        href: "/admin/novedades",
        label: "Actualizaciones",
        detalle: "Qué cambió en cada versión",
        icon: Bell,
        seccion: "novedades",
        soloAdmin: true,
      },
      {
        href: "/admin/configuracion",
        label: "Configuración del sistema",
        detalle: "Cuenta, apariencia y ajustes",
        icon: Settings,
        seccion: "configuracion",
        soloAdmin: true,
      },
    ],
  },
];

/** Plano, para buscar en Más sin recorrer los grupos a mano. */
export const DESTINOS_ADMIN: DestinoAdmin[] = GRUPOS_DESTINOS.flatMap((grupo) => grupo.items);

export function gruposDestinosParaRol(rol: "entrenador" | "admin"): GrupoDestinos[] {
  return GRUPOS_DESTINOS
    .map((grupo) => ({
      ...grupo,
      items: grupo.items.filter((item) => rol === "admin" || !item.soloAdmin),
    }))
    .filter((grupo) => grupo.items.length > 0);
}

/**
 * Las cuatro puertas de "Rutinas". Es la misma lista que el grupo homónimo de
 * arriba; se deriva en vez de copiarse para que la página puerta y el
 * directorio no puedan decir cosas distintas.
 */
export const DESTINOS_RUTINAS: DestinoAdmin[] =
  GRUPOS_DESTINOS.find((grupo) => grupo.label === "Rutinas")?.items ?? [];
