/**
 * Rehace el recorte de las fotos de grupos musculares para que se vean bien
 * sobre CUALQUIER fondo, no solo sobre el negro del tema oscuro.
 *
 * El problema de origen: las fotos son de estudio sobre fondo NEGRO, con el
 * cuerpo en claroscuro. La herramienta que les quitó el fondo no pudo
 * distinguir el negro del fondo de las partes oscuras del propio cuerpo, así
 * que dejó dos defectos:
 *
 *  1. AGUJEROS INTERIORES — barba, cuello, sombras del pecho: zonas del cuerpo
 *     que quedaron transparentes. Sobre negro se leían como sombra y nadie las
 *     notaba; sobre el tema claro son parches blancos en plena cara.
 *
 *  2. NEGRO HORNEADO EN EL BORDE — los píxeles del contorno quedaron
 *     compuestos contra el fondo negro (`guardado = real * alfa`), así que
 *     sobre blanco cada borde se componía a gris sucio.
 *
 * La reconstrucción usa las dos fuentes que ya están en el repo:
 *
 *  - el COLOR sale de la `.jpg`, que es la foto original sin recortar (mismas
 *    dimensiones, sin alfa). Es el color verdadero, sin negro horneado — esto
 *    arregla el defecto 2 de raíz, sin aproximaciones.
 *  - el ALFA sale de la `.webp`, que es donde vive el recorte, pero corrigiendo
 *    el defecto 1: se separa el fondo real de los agujeros interiores con un
 *    relleno por inundación desde el borde de la imagen. Lo que es transparente
 *    y NO llega al borde no es fondo, es un agujero en el cuerpo: se rellena.
 *
 * El borde antialiasing del contorno se conserva tal cual (alfa parcial), así
 * que la silueta no queda dentada.
 *
 * Uso:  node scripts/rehacer-recorte-fotos-grupos.mjs [--aplicar]
 * Sin --aplicar escribe copias `*.nuevo.webp` para comparar sin pisar nada.
 */
import sharp from "sharp";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "grupos-musculares");

// Debajo de este alfa se considera "transparente" para decidir qué es fondo.
// No es 0 porque la compresión con pérdida deja el fondo en 1-3 en vez de 0.
const UMBRAL_TRANSPARENTE = 8;

const aplicar = process.argv.includes("--aplicar");

/** Marca todo lo transparente que se pueda alcanzar desde el borde de la
 * imagen. Eso es el fondo de verdad; cualquier otra zona transparente está
 * encerrada por el cuerpo y por lo tanto es un agujero del recorte. */
function marcarFondo(data, ancho, alto) {
  const fondo = new Uint8Array(ancho * alto);
  const pila = [];
  for (let x = 0; x < ancho; x++) pila.push(x, x + (alto - 1) * ancho);
  for (let y = 0; y < alto; y++) pila.push(y * ancho, ancho - 1 + y * ancho);

  while (pila.length) {
    const i = pila.pop();
    if (fondo[i] || data[i * 4 + 3] > UMBRAL_TRANSPARENTE) continue;
    fondo[i] = 1;
    const x = i % ancho;
    if (x > 0) pila.push(i - 1);
    if (x < ancho - 1) pila.push(i + 1);
    if (i >= ancho) pila.push(i - ancho);
    if (i < ancho * (alto - 1)) pila.push(i + ancho);
  }
  return fondo;
}

const archivos = (await readdir(DIR)).filter(
  (f) => f.endsWith(".webp") && !f.endsWith(".nuevo.webp")
);

for (const archivo of archivos) {
  const rutaWebp = path.join(DIR, archivo);
  const rutaJpg = rutaWebp.replace(/\.webp$/, ".jpg");

  const recorte = await sharp(await readFile(rutaWebp))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: ancho, height: alto } = recorte.info;

  const original = await sharp(await readFile(rutaJpg))
    .resize(ancho, alto, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const fondo = marcarFondo(recorte.data, ancho, alto);

  const salida = Buffer.alloc(ancho * alto * 4);
  let agujerosRellenados = 0;
  for (let i = 0; i < ancho * alto; i++) {
    const alfaOriginal = recorte.data[i * 4 + 3];
    let alfa;
    if (fondo[i]) {
      alfa = 0;
    } else if (alfaOriginal <= UMBRAL_TRANSPARENTE) {
      // Transparente pero encerrado por el cuerpo: es un agujero, no fondo.
      alfa = 255;
      agujerosRellenados++;
    } else {
      // Borde real del contorno: se respeta su alfa para no dentar la silueta.
      alfa = alfaOriginal;
    }
    // El color SIEMPRE sale de la foto original, incluso en el borde: es lo
    // que saca el negro horneado.
    salida[i * 4] = original[i * 3];
    salida[i * 4 + 1] = original[i * 3 + 1];
    salida[i * 4 + 2] = original[i * 3 + 2];
    salida[i * 4 + 3] = alfa;
  }

  const webp = await sharp(salida, { raw: { width: ancho, height: alto, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();

  const pct = ((agujerosRellenados / (ancho * alto)) * 100).toFixed(2);
  console.log(
    `${archivo}: ${agujerosRellenados} px de agujero rellenados (${pct}%) · ` +
      `${(webp.length / 1024).toFixed(0)} kB`
  );

  await writeFile(aplicar ? rutaWebp : rutaWebp.replace(/\.webp$/, ".nuevo.webp"), webp);
}

console.log(aplicar ? "\nAplicado sobre los .webp." : "\nCopias .nuevo.webp escritas (nada pisado).");
