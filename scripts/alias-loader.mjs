/**
 * Resuelve el alias "@/..." de tsconfig cuando se corre un script de
 * mantenimiento con node directamente (fuera de Next). Node 24 ya entiende
 * TypeScript por su cuenta; lo único que le falta es el alias.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/alias-loader.mjs scripts/loQueSea.mjs
 */
import { register } from "node:module";

register(new URL("./alias-hooks.mjs", import.meta.url));
