export type TipoRecompensaVip = "digital" | "servicio" | "fisica";
export type EstadoAdministrableCanjeVip = "aprobado" | "entregado" | "rechazado";

export type NuevaRecompensaVipValidada = {
  nombre: string;
  descripcion: string;
  tipo: TipoRecompensaVip;
  costo: number;
  stock: number | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIPOS_RECOMPENSA = new Set<string>(["digital", "servicio", "fisica"]);
const ESTADOS_CANJE = new Set<string>(["aprobado", "entregado", "rechazado"]);

export function esUuidVip(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

export function textoSeguroVip(valor: unknown, maximo: number) {
  return typeof valor === "string" ? valor.trim().replace(/\s+/g, " ").slice(0, maximo) : "";
}

export function esEstadoAdministrableCanjeVip(valor: unknown): valor is EstadoAdministrableCanjeVip {
  return typeof valor === "string" && ESTADOS_CANJE.has(valor);
}

function esTipoRecompensaVip(valor: string): valor is TipoRecompensaVip {
  return TIPOS_RECOMPENSA.has(valor);
}

export function validarNuevaRecompensaVip(input: unknown): NuevaRecompensaVipValidada | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const datos = input as Record<string, unknown>;
  const nombre = textoSeguroVip(datos.nombre, 80);
  const descripcion = textoSeguroVip(datos.descripcion, 500);
  const tipo = textoSeguroVip(datos.tipo, 20);
  const costo = typeof datos.costo === "number" && Number.isFinite(datos.costo)
    ? Math.round(datos.costo)
    : Number.NaN;
  const stock = datos.stock === null
    ? null
    : typeof datos.stock === "number" && Number.isFinite(datos.stock)
      ? Math.round(datos.stock)
      : Number.NaN;

  if (
    nombre.length < 2
    || !esTipoRecompensaVip(tipo)
    || !Number.isInteger(costo)
    || costo < 1
    || costo > 1_000_000
    || (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 100_000))
  ) return null;

  return { nombre, descripcion, tipo, costo, stock };
}

export function mensajeAdministracionRecompensasVip(mensaje: string) {
  if (mensaje.includes("CANJE_YA_RESUELTO")) return "Este canje ya fue resuelto. Actualizamos la lista para mostrar su estado real.";
  if (mensaje.includes("PRIMERO_APROBAR")) return "Primero debes aprobar el canje y después marcarlo como entregado.";
  if (mensaje.includes("CANJE_NO_EXISTE")) return "El canje ya no existe o fue retirado.";
  if (mensaje.includes("RECOMPENSA_NO_EXISTE")) return "La recompensa ya no existe.";
  if (mensaje.includes("SIN_PERMISO")) return "Esta operación está reservada para el administrador.";
  if (/recompensas_vip_|PGRST202|42883/i.test(mensaje)) return "El módulo de recompensas no está disponible en este entorno.";
  return "No pudimos completar la operación. No se modificaron puntos ni stock.";
}
