/** Evento de navegador para avisar "se acaban de ganar puntos" sin acoplar
 * quién los ganó (una sesión finalizada, más adelante otra acción) con quién
 * los muestra (`XpBadgeV2`, montado una sola vez en el layout de portal-v2).
 * Cruza de una página a otra porque el layout no se desmonta entre rutas de
 * `/portal-v2/**`. */
export const EVENTO_XP_GANADO = "vip:xp-ganado";

export type DetalleXpGanado = { puntos: number };
