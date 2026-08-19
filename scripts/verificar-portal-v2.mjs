import fs from "node:fs";
import path from "node:path";

const base = (process.env.V2_BASE_URL || "http://127.0.0.1:3100").replace(/\/$/, "");

const rutas = [
  "/portal-v2",
  "/portal-v2/entrenamiento",
  "/portal-v2/entrenamiento/programas",
  "/portal-v2/entrenamiento/biblioteca?buscar=hombros",
  "/portal-v2/entrenamiento/historial",
  "/portal-v2/entrenamiento/rutina",
  "/portal-v2/entrenamiento/sesion",
  "/portal-v2/nutricion",
  "/portal-v2/progreso",
  "/portal-v2/progreso/comunidad",
  "/portal-v2/progreso/ranking",
  "/portal-v2/mas",
  "/portal-v2/perfil",
  "/portal-v2/privacidad",
  "/portal-v2/soporte",
];

const fallos = [];
const resultados = [];

function archivosTsx(directorio) {
  if (!fs.existsSync(directorio)) return [];
  return fs.readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) return archivosTsx(ruta);
    return entrada.isFile() && ruta.endsWith(".tsx") ? [ruta] : [];
  });
}

const enlacesDeclarados = new Set();
for (const archivo of [
  ...archivosTsx(path.join(process.cwd(), "src", "app", "portal-v2")),
  ...archivosTsx(path.join(process.cwd(), "src", "components", "v2")),
]) {
  const contenido = fs.readFileSync(archivo, "utf8");
  for (const coincidencia of contenido.matchAll(/href\s*=\s*["'](\/portal-v2[^"']*)["']/g)) {
    enlacesDeclarados.add(coincidencia[1]);
  }
  // Los destinos por rol viven dentro de expresiones JSX, por ejemplo
  // `href={esCoach ? "/admin/mas" : "/portal-v2/entrenamiento"}`. Extraemos
  // cada literal V2 del bloque para que volver condicional un enlace no lo
  // haga desaparecer falsamente de la auditoría.
  for (const expresion of contenido.matchAll(/href\s*=\s*\{([^}]+)\}/g)) {
    for (const coincidencia of expresion[1].matchAll(/["'](\/portal-v2[^"']*)["']/g)) {
      enlacesDeclarados.add(coincidencia[1]);
    }
  }
}

for (const ruta of rutas) {
  const inicio = performance.now();
  try {
    const respuesta = await fetch(`${base}${ruta}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "VIP-Fitness-V2-Smoke/1.0" },
    });
    const html = await respuesta.text();
    const tiempoMs = Math.round(performance.now() - inicio);
    const redirigeLogin = new URL(respuesta.url).pathname.startsWith("/login");
    const errorVisible = /Internal Server Error|Application error|Error de aplicación/i.test(html);
    const correcto = respuesta.status === 200 && !redirigeLogin && !errorVisible;
    resultados.push({ ruta, estado: respuesta.status, tiempoMs, correcto });
    if (!correcto) fallos.push(`${ruta}: HTTP ${respuesta.status}, final ${respuesta.url}`);

    if (ruta === "/portal-v2/progreso") {
      if (!html.includes("Reconstruyendo tu progreso verificado")) fallos.push("Progreso: falta el estado de carga protegido.");
      if (/88\.0 kg|900 XP/.test(html)) fallos.push("Progreso: el HTML inicial filtra métricas demostrativas.");
    }
    if (ruta === "/portal-v2/entrenamiento/programas" && !html.includes("Mis programas")) {
      fallos.push("Programas: la pantalla no contiene su encabezado esperado.");
    }
    if (ruta === "/portal-v2/mas") {
      if (!html.includes("Cargando tu cuenta y preferencias")) fallos.push("Más: falta el estado de carga protegido.");
      if (/Ale Mendoza|900 XP/.test(html)) fallos.push("Más: el HTML inicial filtra una identidad demostrativa.");
    }
  } catch (error) {
    resultados.push({ ruta, estado: 0, tiempoMs: Math.round(performance.now() - inicio), correcto: false });
    fallos.push(`${ruta}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const href of enlacesDeclarados) {
  const destino = href.split("#")[0] || "/portal-v2";
  if (rutas.includes(destino)) continue;
  try {
    const respuesta = await fetch(`${base}${destino}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "VIP-Fitness-V2-Link-Audit/1.0" },
    });
    const redirigeLogin = new URL(respuesta.url).pathname.startsWith("/login");
    if (respuesta.status !== 200 || redirigeLogin) fallos.push(`Enlace ${href}: HTTP ${respuesta.status}, final ${respuesta.url}`);
  } catch (error) {
    fallos.push(`Enlace ${href}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.table(resultados);
if (fallos.length) {
  console.error("\nVerificación V2 fallida:");
  for (const fallo of fallos) console.error(`- ${fallo}`);
  process.exitCode = 1;
} else {
  console.log(`\nPortal V2 verificado: ${resultados.length} rutas y ${enlacesDeclarados.size} conexiones declaradas, sin redirecciones al login ni datos demo durante la carga.`);
}
