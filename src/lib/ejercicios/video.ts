/** Compartido entre el servidor (`admin/ejercicios/actions.ts`) y el cliente
 * (`ModalVideo.tsx`) para no mantener la misma expresión regular en dos
 * lados. Soporta los formatos comunes de link de YouTube: watch, youtu.be,
 * shorts y embed. */
const REGEX_YOUTUBE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function idDeYoutube(valor: string): string | null {
  return valor.match(REGEX_YOUTUBE)?.[1] ?? null;
}
