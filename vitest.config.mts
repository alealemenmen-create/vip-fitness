import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // "server-only" no es un paquete npm real — Next.js lo resuelve con un
      // alias de webpack/turbopack que apunta a un módulo vacío del lado del
      // servidor (y a uno que tira error del lado del cliente, para que
      // importarlo desde un Client Component falle en build). Vitest no
      // conoce ese alias, así que sin esto cualquier archivo con
      // `import "server-only"` (ej. src/lib/impulso-vip/data.ts) ni siquiera
      // se puede importar en un test.
      "server-only": path.resolve(import.meta.dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
