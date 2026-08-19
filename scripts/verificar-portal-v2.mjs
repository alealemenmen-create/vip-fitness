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

console.table(resultados);
if (fallos.length) {
  console.error("\nVerificación V2 fallida:");
  for (const fallo of fallos) console.error(`- ${fallo}`);
  process.exitCode = 1;
} else {
  console.log(`\nPortal V2 verificado: ${resultados.length} rutas, sin redirecciones al login ni datos demo durante la carga.`);
}
