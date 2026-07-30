import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";

const ARCHIVOS = [
  "pecho",
  "espalda",
  "hombros",
  "brazos",
  "core",
  "piernas-frente",
  "piernas-espalda",
];

const DIR = "public/grupos-musculares";

// Fondo negro sólido: convertimos a transparente todo pixel cuyo brillo esté
// por debajo del umbral, con una zona de transición suave (feather) para que
// el borde de la silueta no quede dentado.
const UMBRAL_OPACO = 40; // por encima de esto: 100% opaco
const UMBRAL_TRANSPARENTE = 12; // por debajo de esto: 100% transparente

function alfaPorBrillo(r, g, b) {
  const brillo = Math.max(r, g, b);
  if (brillo <= UMBRAL_TRANSPARENTE) return 0;
  if (brillo >= UMBRAL_OPACO) return 255;
  const t = (brillo - UMBRAL_TRANSPARENTE) / (UMBRAL_OPACO - UMBRAL_TRANSPARENTE);
  return Math.round(t * 255);
}

async function procesar(nombre) {
  const entrada = path.join(DIR, `${nombre}.jpg`);
  const salida = path.join(DIR, `${nombre}.webp`);

  const img = sharp(entrada).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  for (let i = 0; i < width * height; i++) {
    const idx = i * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    data[idx + 3] = alfaPorBrillo(r, g, b);
  }

  // WebP en vez de PNG: mismo soporte de transparencia, pero el PNG sin
  // pérdida infla fotos reales a 700KB-1.4MB cada una (10-15x el peso del
  // JPG original) — eso fue lo que hacía sentir lenta la app entera.
  await sharp(data, { raw: { width, height, channels } })
    .webp({ quality: 90 })
    .toFile(salida);

  const { size } = await fs.stat(salida);
  console.log(`OK ${nombre}.webp (${width}x${height}, ${Math.round(size / 1024)}KB)`);
}

for (const nombre of ARCHIVOS) {
  await procesar(nombre);
}
