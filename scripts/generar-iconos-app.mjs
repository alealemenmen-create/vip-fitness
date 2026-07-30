import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const ORIGEN = "public/logo-vip-full.png";
// Bounding box real del glifo "V⚡P" dentro del wordmark (medido con sharp:
// primera columna con contenido hasta la última antes del espacio con "F" de
// FITNESS, y el alto real de las letras).
const RECORTE = { left: 0, top: 49, width: 424, height: 188 };

const FONDO = "#000000"; // mismo negro sólido premium del tema Espejo

async function generarBase() {
  const glifo = await sharp(ORIGEN).extract(RECORTE).png().toBuffer();
  const glifoInfo = await sharp(glifo).metadata();

  // Canvas cuadrado con el glifo centrado y un margen generoso (zona segura
  // para el recorte circular/redondeado que aplican Android e iOS).
  const LADO_BASE = 512;
  const margen = 0.16; // 16% de aire a cada lado
  const anchoUtil = Math.round(LADO_BASE * (1 - margen * 2));
  const escala = anchoUtil / glifoInfo.width;
  const anchoFinal = Math.round(glifoInfo.width * escala);
  const altoFinal = Math.round(glifoInfo.height * escala);

  const glifoEscalado = await sharp(glifo)
    .resize(anchoFinal, altoFinal)
    .toBuffer();

  const base = await sharp({
    create: {
      width: LADO_BASE,
      height: LADO_BASE,
      channels: 4,
      background: FONDO,
    },
  })
    .composite([
      {
        input: glifoEscalado,
        left: Math.round((LADO_BASE - anchoFinal) / 2),
        top: Math.round((LADO_BASE - altoFinal) / 2),
      },
    ])
    .png()
    .toBuffer();

  return base;
}

async function main() {
  const base = await generarBase();
  await fs.writeFile("scratch-icon-base-512.png", base);

  const tamanos = {
    "public/icons/icon-512.png": 512,
    "public/icons/icon-192.png": 192,
    "public/icons/icon-maskable-512.png": 512,
    "public/icons/apple-icon-180.png": 180,
    "src/app/icon.png": 512,
    "src/app/apple-icon.png": 180,
  };

  for (const [destino, size] of Object.entries(tamanos)) {
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await sharp(base).resize(size, size).png().toFile(destino);
    console.log("OK", destino, `${size}x${size}`);
  }

  // favicon.ico multi-resolución (16/32/48) para Windows (pestaña, taskbar).
  const pngToIco = (await import("png-to-ico")).default;
  const buffers = await Promise.all(
    [16, 32, 48].map((size) => sharp(base).resize(size, size).png().toBuffer()),
  );
  const ico = await pngToIco(buffers);
  await fs.writeFile("src/app/favicon.ico", ico);
  console.log("OK src/app/favicon.ico (16/32/48)");
}

main();
