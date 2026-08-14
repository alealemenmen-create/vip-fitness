/**
 * Toma una foto cruda de `_fotos_ejercicios_staging/` y genera las dos
 * versiones que usa la app para un slug de ejercicio:
 *   - public/ejercicios-completas/<slug>.webp  (foto completa comprimida)
 *   - public/ejercicios/<slug>.webp            (recorte cuadrado 480x480, centrado)
 *
 * Uso:
 *   node scripts/procesar-foto-ejercicio.mjs "<archivo-staging>" <slug>
 */
import sharp from "sharp";
import path from "node:path";

const [, , archivo, slug] = process.argv;
if (!archivo || !slug) {
  console.error("Uso: node scripts/procesar-foto-ejercicio.mjs <archivo-staging> <slug>");
  process.exit(1);
}

const entrada = path.join("_fotos_ejercicios_staging", archivo);
const salidaCompleta = path.join("public/ejercicios-completas", `${slug}.webp`);
const salidaThumb = path.join("public/ejercicios", `${slug}.webp`);

const img = sharp(entrada).rotate(); // respeta EXIF orientation

await img.clone().resize({ width: 1400, height: 1867, fit: "inside", withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(salidaCompleta);

await img.clone().resize({ width: 480, height: 480, fit: "cover", position: "attention" })
  .webp({ quality: 82 })
  .toFile(salidaThumb);

console.log(`OK: ${archivo} -> ${slug}`);
console.log(`  ${salidaCompleta}`);
console.log(`  ${salidaThumb}`);
