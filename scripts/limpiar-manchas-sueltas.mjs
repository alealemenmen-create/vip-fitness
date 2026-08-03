/**
 * Borra las manchas de color que quedaron flotando, separadas del cuerpo,
 * en las fotos de grupo muscular.
 *
 * Origen del defecto: el recorte que separó al modelo del fondo dejó
 * fragmentos del resaltado de color (rojo/verde) desprendidos del cuerpo
 * principal — casi siempre cerca del short, donde el resaltado de pierna se
 * escapaba del contorno. Con el círculo chico y el recorte por grupo que
 * usaba la app antes, esa franja quedaba fuera de lo visible y el defecto
 * nunca se notó. Al mostrar el cuerpo entero (pedido explícito: "que se vea
 * el modelo completo") quedó a la vista — un modelo con manchas verdes y
 * rojas flotando bajo las piernas.
 *
 * La detección es autocontenida, no depende de coordenadas fijas: agrupa los
 * píxeles opacos en componentes conexas (BFS 4-vecinos) y conserva SOLO la
 * componente más grande — el cuerpo. Cualquier otra, sin importar tamaño ni
 * posición, se vuelve transparente.
 *
 * Uso:  node scripts/limpiar-manchas-sueltas.mjs [--aplicar]
 * Sin --aplicar escribe copias `*.limpio.webp` para comparar sin pisar nada.
 */
import sharp from "sharp";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "grupos-musculares");
const UMBRAL_OPACO = 40;

const aplicar = process.argv.includes("--aplicar");

function componentesConexas(data, w, h) {
  const visitado = new Uint8Array(w * h);
  const idComponente = new Int32Array(w * h).fill(-1);
  const tamanos = [];

  for (let inicio = 0; inicio < w * h; inicio++) {
    if (visitado[inicio] || data[inicio * 4 + 3] <= UMBRAL_OPACO) continue;

    const id = tamanos.length;
    const pila = [inicio];
    visitado[inicio] = 1;
    let tam = 0;

    while (pila.length) {
      const j = pila.pop();
      idComponente[j] = id;
      tam++;
      const jx = j % w;
      const arriba = j - w;
      const abajo = j + w;
      const izq = jx > 0 ? j - 1 : -1;
      const der = jx < w - 1 ? j + 1 : -1;

      for (const k of [arriba, abajo, izq, der]) {
        if (k < 0 || k >= w * h || visitado[k] || data[k * 4 + 3] <= UMBRAL_OPACO) continue;
        visitado[k] = 1;
        pila.push(k);
      }
    }
    tamanos.push(tam);
  }
  return { idComponente, tamanos };
}

const archivos = (await readdir(DIR)).filter(
  (f) => f.endsWith(".webp") && !f.endsWith(".limpio.webp")
);

for (const archivo of archivos) {
  const ruta = path.join(DIR, archivo);
  const { data, info } = await sharp(await readFile(ruta))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const { idComponente, tamanos } = componentesConexas(data, w, h);
  const idPrincipal = tamanos.indexOf(Math.max(...tamanos));

  let borrados = 0;
  for (let i = 0; i < w * h; i++) {
    if (idComponente[i] !== -1 && idComponente[i] !== idPrincipal) {
      data[i * 4 + 3] = 0;
      borrados++;
    }
  }

  const salida = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();

  const manchasSueltas = tamanos.length - 1;
  console.log(
    `${archivo}: ${manchasSueltas} manchas sueltas borradas (${borrados}px, ` +
      `cuerpo principal ${tamanos[idPrincipal]}px)`
  );

  await writeFile(aplicar ? ruta : ruta.replace(/\.webp$/, ".limpio.webp"), salida);
}

console.log(aplicar ? "\nAplicado sobre los .webp." : "\nCopias .limpio.webp escritas (nada pisado).");
