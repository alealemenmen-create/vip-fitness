import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Next permite distDir personalizado; todas esas carpetas son artefactos
    // compilados, no código fuente para lint.
    ".next-*/**",
    "out/**",
    "build/**",
    "tmp/**",
    "Rutinas Alejandro/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
