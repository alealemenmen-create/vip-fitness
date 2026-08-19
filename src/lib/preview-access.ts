import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "vip_v2_preview";
const DURACION_SEGUNDOS = 60 * 60 * 24 * 30;

export const PREVIEW_ACCESS_COOKIE = COOKIE_NAME;

function compararSeguro(a: string, b: string) {
  const izquierda = Buffer.from(a);
  const derecha = Buffer.from(b);
  return izquierda.length === derecha.length && timingSafeEqual(izquierda, derecha);
}

export function hashCodigoPreview(codigo: string) {
  return createHash("sha256").update(codigo.trim(), "utf8").digest("hex");
}

export function resolverAccesoPreview(codigo: string, configuracion = process.env.V2_PREVIEW_ACCESS_CODES) {
  if (!configuracion || !codigo.trim()) return null;
  const hash = hashCodigoPreview(codigo);

  for (const entrada of configuracion.split(",")) {
    const [identificador, hashPermitido] = entrada.split(":", 2).map((valor) => valor?.trim());
    if (identificador && hashPermitido && compararSeguro(hash, hashPermitido)) return identificador;
  }

  return null;
}

function firma(payload: string, secreto: string) {
  return createHmac("sha256", secreto).update(payload, "utf8").digest("base64url");
}

export function crearCookiePreview(identificador: string, secreto = process.env.V2_PREVIEW_GATE_SECRET) {
  if (!secreto) throw new Error("Falta V2_PREVIEW_GATE_SECRET");
  const vence = Math.floor(Date.now() / 1000) + DURACION_SEGUNDOS;
  const payload = `${identificador}.${vence}`;
  return `${payload}.${firma(payload, secreto)}`;
}

export function validarCookiePreview(valor: string | undefined, secreto = process.env.V2_PREVIEW_GATE_SECRET) {
  if (!valor || !secreto) return false;
  const [identificador, venceTexto, firmaRecibida] = valor.split(".");
  const vence = Number(venceTexto);
  if (!identificador || !Number.isInteger(vence) || vence <= Math.floor(Date.now() / 1000) || !firmaRecibida) return false;
  const payload = `${identificador}.${vence}`;
  return compararSeguro(firma(payload, secreto), firmaRecibida);
}

export function previewPrivadaActiva() {
  return process.env.VERCEL_ENV === "preview" && Boolean(process.env.V2_PREVIEW_ACCESS_CODES && process.env.V2_PREVIEW_GATE_SECRET);
}
