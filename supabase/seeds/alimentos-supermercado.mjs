/**
 * Catálogo base de VIP Fitness: ingredientes y productos de supermercado, con
 * sus preparaciones habituales. NO lleva platos preparados (cazuelas, guisos):
 * si el alumno come un plato, registra sus ingredientes.
 *
 * Valores por 100 g de porción comestible, de tablas nutricionales estándar.
 * La medida casera es la que la persona usa al servirse.
 *
 * Uso:  node supabase/seeds/alimentos-supermercado.mjs --aplicar
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// nombre, categoría, kcal, prot, carb, grasa, medida, gramos por medida
export const ALIMENTOS = [
  // ── Carnes y aves ──
  ["Pechuga de pollo cruda", "Carnes y aves", 120, 22.5, 0, 2.6, "porción (150 g)", 150],
  ["Pechuga de pollo a la plancha", "Carnes y aves", 165, 31, 0, 3.6, "porción (150 g)", 150],
  ["Pollo asado con piel", "Carnes y aves", 239, 27, 0, 14, "presa", 150],
  ["Pollo frito", "Carnes y aves", 260, 26, 8, 13, "presa", 150],
  ["Trutro de pollo", "Carnes y aves", 209, 26, 0, 11, "unidad", 130],
  ["Milanesa de pollo", "Carnes y aves", 220, 18, 14, 10, "unidad", 120],
  ["Pechuga de pavo", "Carnes y aves", 135, 29, 0, 1, "porción (150 g)", 150],
  ["Carne molida 5% grasa", "Carnes y aves", 137, 21.4, 0, 5, "porción (150 g)", 150],
  ["Carne molida 7% grasa", "Carnes y aves", 150, 20.5, 0, 7.5, "porción (150 g)", 150],
  ["Carne molida 20% grasa", "Carnes y aves", 254, 17, 0, 20, "porción (150 g)", 150],
  ["Posta rosada", "Carnes y aves", 143, 22, 0, 5.5, "porción (150 g)", 150],
  ["Lomo liso", "Carnes y aves", 180, 21, 0, 10, "porción (150 g)", 150],
  ["Filete de vacuno", "Carnes y aves", 158, 22, 0, 7.5, "porción (150 g)", 150],
  ["Asado de tira", "Carnes y aves", 290, 18, 0, 24, "porción (150 g)", 150],
  ["Chuleta de cerdo", "Carnes y aves", 231, 24, 0, 14, "unidad", 150],
  ["Costillar de cerdo", "Carnes y aves", 291, 19, 0, 23, "porción (150 g)", 150],
  ["Lomo de cerdo", "Carnes y aves", 143, 21, 0, 6, "porción (150 g)", 150],
  ["Longaniza", "Carnes y aves", 330, 15, 2, 29, "unidad", 80],
  ["Vienesa", "Carnes y aves", 290, 11, 3, 26, "unidad", 50],
  ["Jamón de pavo", "Carnes y aves", 105, 17, 2, 3, "lámina", 20],
  ["Jamón de cerdo", "Carnes y aves", 145, 18, 1.5, 7, "lámina", 20],
  ["Milanesa de carne", "Carnes y aves", 240, 19, 15, 12, "unidad", 120],
  ["Hamburguesa de carne", "Carnes y aves", 254, 17, 0, 20, "medallón", 100],
  ["Nuggets de pollo", "Carnes y aves", 296, 15, 18, 19, "unidad", 20],
  ["Salchicha de pavo", "Carnes y aves", 196, 14, 2, 15, "unidad", 45],
  ["Pechuga de pollo desmenuzada", "Carnes y aves", 165, 31, 0, 3.6, "taza", 140],

  // ── Pescados y mariscos ──
  ["Merluza", "Pescados y mariscos", 90, 18.3, 0, 1.3, "porción (150 g)", 150],
  ["Salmón", "Pescados y mariscos", 208, 20.4, 0, 13.4, "porción (150 g)", 150],
  ["Reineta", "Pescados y mariscos", 105, 20, 0, 2.5, "porción (150 g)", 150],
  ["Atún en agua", "Pescados y mariscos", 116, 25.5, 0, 0.8, "lata (120 g)", 120],
  ["Atún en aceite", "Pescados y mariscos", 198, 29, 0, 8, "lata (120 g)", 120],
  ["Jurel en conserva", "Pescados y mariscos", 170, 20, 0, 9, "lata (200 g)", 200],
  ["Camarones", "Pescados y mariscos", 99, 24, 0, 0.3, "porción (100 g)", 100],

  // ── Huevos ──
  ["Huevo entero", "Huevos", 143, 12.6, 0.7, 9.5, "unidad", 50],
  ["Clara de huevo", "Huevos", 52, 10.9, 0.7, 0.2, "unidad", 33],
  ["Yema de huevo", "Huevos", 322, 15.9, 3.6, 26.5, "unidad", 17],
  ["Huevo duro", "Huevos", 155, 12.6, 1.1, 10.6, "unidad", 50],
  ["Huevo frito", "Huevos", 196, 13.6, 0.8, 15, "unidad", 55],
  ["Huevo revuelto", "Huevos", 149, 10, 1.6, 11, "porción (100 g)", 100],

  // ── Lácteos ──
  ["Leche entera", "Lácteos", 61, 3.2, 4.8, 3.3, "vaso (200 ml)", 200],
  ["Leche descremada", "Lácteos", 35, 3.4, 5, 0.1, "vaso (200 ml)", 200],
  ["Leche semidescremada", "Lácteos", 47, 3.3, 4.8, 1.6, "vaso (200 ml)", 200],
  ["Leche sin lactosa", "Lácteos", 42, 3.4, 4.7, 1.5, "vaso (200 ml)", 200],
  ["Yogur natural sin azúcar", "Lácteos", 59, 10, 3.6, 0.4, "pote (125 g)", 125],
  ["Yogur proteico", "Lácteos", 60, 10, 4, 0.2, "pote (155 g)", 155],
  ["Yogur griego", "Lácteos", 97, 9, 3.6, 5, "pote (150 g)", 150],
  ["Yogur con fruta", "Lácteos", 85, 3.5, 13, 2, "pote (125 g)", 125],
  ["Quesillo", "Lácteos", 98, 12.4, 3.4, 4.3, "porción (80 g)", 80],
  ["Queso gauda", "Lácteos", 356, 25, 2, 28, "lámina", 20],
  ["Queso mantecoso", "Lácteos", 330, 22, 2, 26, "lámina", 20],
  ["Queso crema", "Lácteos", 342, 6, 4, 34, "cucharada", 15],
  ["Mantequilla", "Lácteos", 717, 0.9, 0.1, 81, "cucharadita", 5],
  ["Margarina", "Lácteos", 717, 0.2, 0.7, 80, "cucharadita", 5],
  ["Crema de leche", "Lácteos", 292, 2.5, 3, 30, "cucharada", 15],
  ["Leche condensada", "Lácteos", 321, 7.9, 54, 8.7, "cucharada", 20],
  ["Queso fresco", "Lácteos", 264, 18, 3, 20, "porción (80 g)", 80],
  ["Ricotta", "Lácteos", 174, 11, 3, 13, "porción (100 g)", 100],
  ["Leche de almendras", "Lácteos", 15, 0.6, 0.3, 1.2, "vaso (200 ml)", 200],
  ["Bebida de soya", "Lácteos", 43, 3.3, 4.9, 1.8, "vaso (200 ml)", 200],

  // ── Panes y masas ──
  ["Pan de molde blanco", "Panes y masas", 265, 9, 49, 3.2, "rebanada", 28],
  ["Pan de molde integral", "Panes y masas", 247, 13, 41, 3.4, "rebanada", 28],
  ["Marraqueta", "Panes y masas", 271, 8.5, 55, 1, "unidad", 100],
  ["Hallulla", "Panes y masas", 290, 8, 54, 4.5, "unidad", 100],
  ["Pan amasado", "Panes y masas", 280, 7.5, 54, 3.5, "unidad", 100],
  ["Pan pita", "Panes y masas", 275, 9, 55, 1.2, "unidad", 60],
  ["Pan de centeno", "Panes y masas", 259, 9, 48, 3.3, "rebanada", 32],
  ["Tortilla de trigo", "Panes y masas", 310, 8, 49, 8, "unidad", 45],
  ["Galletas de agua", "Panes y masas", 430, 10, 72, 12, "unidad", 7],
  ["Galletas de arroz", "Panes y masas", 387, 8, 81, 3, "unidad", 9],

  // ── Cereales y granos ──
  ["Arroz blanco cocido", "Cereales y granos", 130, 2.7, 28.2, 0.3, "taza cocida", 158],
  ["Arroz integral cocido", "Cereales y granos", 123, 2.7, 25.6, 1, "taza cocida", 158],
  ["Fideos cocidos", "Cereales y granos", 158, 5.8, 30.9, 0.9, "taza cocida", 140],
  ["Fideos integrales cocidos", "Cereales y granos", 124, 5, 26, 0.5, "taza cocida", 140],
  // Mismos valores que los fideos: en Chile se dicen de las dos formas y el
  // alumno tiene que encontrarlo escriba lo que escriba.
  ["Pasta cocida", "Cereales y granos", 158, 5.8, 30.9, 0.9, "taza cocida", 140],
  ["Pasta integral cocida", "Cereales y granos", 124, 5, 26, 0.5, "taza cocida", 140],
  ["Avena en hojuelas", "Cereales y granos", 389, 16.9, 66.3, 6.9, "taza (80 g)", 80],
  ["Quinoa cocida", "Cereales y granos", 120, 4.4, 21.3, 1.9, "taza cocida", 185],
  ["Cuscús cocido", "Cereales y granos", 112, 3.8, 23.2, 0.2, "taza cocida", 157],
  ["Cereal de desayuno", "Cereales y granos", 379, 7, 84, 1, "taza", 30],
  ["Granola", "Cereales y granos", 471, 10, 64, 20, "porción (50 g)", 50],
  ["Harina de trigo", "Cereales y granos", 364, 10, 76, 1, "taza", 125],
  ["Pan rallado", "Cereales y granos", 395, 13, 72, 5, "cucharada", 15],

  // ── Legumbres ──
  ["Lentejas cocidas", "Legumbres", 116, 9, 20.1, 0.4, "taza cocida", 200],
  ["Garbanzos cocidos", "Legumbres", 164, 8.9, 27.4, 2.6, "taza cocida", 165],
  ["Porotos negros cocidos", "Legumbres", 132, 8.9, 23.7, 0.5, "taza cocida", 172],
  ["Porotos blancos cocidos", "Legumbres", 139, 9.7, 25.1, 0.4, "taza cocida", 179],
  ["Arvejas", "Legumbres", 81, 5.4, 14.5, 0.4, "taza", 160],
  ["Soya texturizada", "Legumbres", 330, 50, 30, 1.5, "porción (30 g)", 30],

  // ── Verduras ──
  ["Tomate", "Verduras", 18, 0.9, 3.9, 0.2, "unidad", 123],
  ["Lechuga", "Verduras", 15, 1.4, 2.9, 0.2, "taza", 50],
  ["Zanahoria", "Verduras", 41, 0.9, 9.6, 0.2, "unidad", 61],
  ["Brócoli", "Verduras", 34, 2.8, 6.6, 0.4, "taza", 90],
  ["Coliflor", "Verduras", 25, 1.9, 5, 0.3, "taza", 100],
  ["Zapallo italiano", "Verduras", 17, 1.2, 3.1, 0.3, "unidad", 200],
  ["Zapallo", "Verduras", 26, 1, 6.5, 0.1, "taza", 116],
  ["Espinaca", "Verduras", 23, 2.9, 3.6, 0.4, "taza", 30],
  ["Acelga", "Verduras", 19, 1.8, 3.7, 0.2, "taza", 36],
  ["Cebolla", "Verduras", 40, 1.1, 9.3, 0.1, "unidad", 110],
  ["Pepino", "Verduras", 15, 0.7, 3.6, 0.1, "unidad", 200],
  ["Betarraga", "Verduras", 43, 1.6, 9.6, 0.2, "unidad", 82],
  ["Pimentón", "Verduras", 31, 1, 6, 0.3, "unidad", 119],
  ["Champiñones", "Verduras", 22, 3.1, 3.3, 0.3, "taza", 70],
  ["Papa cocida", "Verduras", 87, 2, 20.1, 0.1, "unidad", 150],
  ["Papas fritas", "Verduras", 312, 3.4, 41, 15, "porción (100 g)", 100],
  ["Puré de papas", "Verduras", 88, 2, 15, 2.5, "taza", 210],
  ["Camote cocido", "Verduras", 86, 1.6, 20.1, 0.1, "unidad", 150],
  ["Choclo", "Verduras", 86, 3.3, 19, 1.2, "taza", 155],
  ["Porotos verdes", "Verduras", 31, 1.8, 7, 0.2, "taza", 100],
  ["Apio", "Verduras", 14, 0.7, 3, 0.2, "tallo", 40],
  ["Repollo", "Verduras", 25, 1.3, 5.8, 0.1, "taza", 89],
  ["Palmitos", "Verduras", 28, 2.5, 4.6, 0.6, "taza", 146],
  ["Aceitunas", "Verduras", 115, 0.8, 6, 11, "unidad", 4],
  ["Ajo", "Verduras", 149, 6.4, 33, 0.5, "diente", 3],

  // ── Frutas ──
  ["Plátano", "Frutas", 89, 1.1, 22.8, 0.3, "unidad", 118],
  ["Manzana", "Frutas", 52, 0.3, 13.8, 0.2, "unidad", 182],
  ["Naranja", "Frutas", 47, 0.9, 11.8, 0.1, "unidad", 154],
  ["Pera", "Frutas", 57, 0.4, 15.2, 0.1, "unidad", 178],
  ["Uva", "Frutas", 69, 0.7, 18.1, 0.2, "taza", 150],
  ["Frutilla", "Frutas", 32, 0.7, 7.7, 0.3, "taza", 150],
  ["Arándanos", "Frutas", 57, 0.7, 14.5, 0.3, "taza", 148],
  ["Kiwi", "Frutas", 61, 1.1, 14.7, 0.5, "unidad", 76],
  ["Palta", "Frutas", 160, 2, 8.5, 14.7, "media unidad", 75],
  ["Sandía", "Frutas", 30, 0.6, 7.6, 0.2, "taza", 152],
  ["Melón", "Frutas", 34, 0.8, 8.2, 0.2, "taza", 160],
  ["Durazno", "Frutas", 39, 0.9, 9.5, 0.3, "unidad", 150],
  ["Piña", "Frutas", 50, 0.5, 13.1, 0.1, "taza", 165],
  ["Mandarina", "Frutas", 53, 0.8, 13.3, 0.3, "unidad", 88],
  ["Limón", "Frutas", 29, 1.1, 9.3, 0.3, "unidad", 58],
  ["Ciruela", "Frutas", 46, 0.7, 11.4, 0.3, "unidad", 66],
  ["Pasas", "Frutas", 299, 3.1, 79, 0.5, "puñado", 40],

  // ── Frutos secos y semillas ──
  ["Almendras", "Frutos secos y semillas", 579, 21.2, 21.6, 49.9, "puñado", 30],
  ["Nueces", "Frutos secos y semillas", 654, 15.2, 13.7, 65.2, "puñado", 30],
  ["Maní", "Frutos secos y semillas", 567, 25.8, 16.1, 49.2, "puñado", 30],
  ["Castañas de cajú", "Frutos secos y semillas", 553, 18.2, 30.2, 43.8, "puñado", 30],
  ["Semillas de chía", "Frutos secos y semillas", 486, 16.5, 42.1, 30.7, "cucharada", 12],
  ["Semillas de zapallo", "Frutos secos y semillas", 559, 30.2, 10.7, 49, "cucharada", 15],
  ["Linaza", "Frutos secos y semillas", 534, 18.3, 28.9, 42.2, "cucharada", 10],
  ["Mantequilla de maní", "Frutos secos y semillas", 588, 25, 20, 50, "cucharada", 16],

  // ── Aceites y salsas ──
  ["Aceite de oliva", "Aceites y salsas", 884, 0, 0, 100, "cucharada", 14],
  ["Aceite vegetal", "Aceites y salsas", 884, 0, 0, 100, "cucharada", 14],
  ["Aceite de coco", "Aceites y salsas", 892, 0, 0, 99, "cucharada", 14],
  ["Mayonesa", "Aceites y salsas", 680, 1, 1.5, 75, "cucharada", 15],
  ["Ketchup", "Aceites y salsas", 101, 1.2, 24, 0.1, "cucharada", 15],
  ["Mostaza", "Aceites y salsas", 66, 4, 5, 3.3, "cucharada", 15],
  ["Salsa de tomate", "Aceites y salsas", 32, 1.6, 7, 0.2, "taza", 245],
  ["Salsa de soya", "Aceites y salsas", 53, 8, 4.9, 0.6, "cucharada", 16],
  ["Vinagre", "Aceites y salsas", 18, 0, 0.9, 0, "cucharada", 15],

  // ── Endulzantes y untables ──
  ["Azúcar", "Endulzantes y untables", 387, 0, 100, 0, "cucharadita", 4],
  ["Endulzante en polvo", "Endulzantes y untables", 0, 0, 0, 0, "sobre", 1],
  ["Miel", "Endulzantes y untables", 304, 0.3, 82, 0, "cucharada", 21],
  ["Mermelada", "Endulzantes y untables", 278, 0.4, 69, 0.1, "cucharada", 20],
  ["Manjar", "Endulzantes y untables", 315, 5, 57, 7, "cucharada", 20],

  // ── Bebidas ──
  ["Agua", "Bebidas", 0, 0, 0, 0, "vaso (200 ml)", 200],
  ["Bebida cola", "Bebidas", 42, 0, 10.6, 0, "vaso (200 ml)", 200],
  ["Bebida cola light", "Bebidas", 0.3, 0, 0.1, 0, "vaso (200 ml)", 200],
  ["Jugo de naranja", "Bebidas", 45, 0.7, 10.4, 0.2, "vaso (200 ml)", 200],
  ["Jugo en polvo preparado", "Bebidas", 5, 0, 1.2, 0, "vaso (200 ml)", 200],
  ["Café negro", "Bebidas", 2, 0.3, 0, 0, "taza (240 ml)", 240],
  ["Café con leche", "Bebidas", 55, 3, 5, 2.5, "taza (240 ml)", 240],
  ["Té", "Bebidas", 1, 0, 0.2, 0, "taza (240 ml)", 240],
  ["Bebida isotónica", "Bebidas", 26, 0, 6.4, 0, "botella (500 ml)", 500],
  ["Cerveza", "Bebidas", 43, 0.5, 3.6, 0, "lata (350 ml)", 350],
  ["Vino tinto", "Bebidas", 85, 0.1, 2.6, 0, "copa (150 ml)", 150],

  // ── Snacks y suplementos ──
  ["Proteína en polvo (whey)", "Snacks y suplementos", 380, 78, 8, 5, "scoop (30 g)", 30],
  ["Barra de cereal", "Snacks y suplementos", 400, 6, 70, 10, "unidad", 25],
  ["Barra de proteína", "Snacks y suplementos", 350, 30, 38, 10, "unidad", 60],
  ["Chocolate de leche", "Snacks y suplementos", 535, 7.6, 59, 30, "barra", 40],
  ["Chocolate amargo 70%", "Snacks y suplementos", 598, 7.8, 46, 43, "barra", 40],
  ["Papas fritas de bolsa", "Snacks y suplementos", 536, 6.6, 53, 35, "bolsa", 30],
  ["Galletas dulces", "Snacks y suplementos", 480, 6, 70, 20, "unidad", 12],
  ["Helado", "Snacks y suplementos", 207, 3.5, 24, 11, "bola", 60],
];

if (process.argv[1]?.includes("alimentos-supermercado")) {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  if (!process.argv.includes("--aplicar")) {
    console.log(`El archivo trae ${ALIMENTOS.length} alimentos. Para cargarlos: --aplicar`);
    process.exit(0);
  }

  // 1. Vaciar: primero los consumos (historial de prueba), después los alimentos.
  const { data: consumos } = await admin.from("alimentos_consumidos").select("id");
  if (consumos?.length) {
    await admin
      .from("alimentos_consumidos")
      .delete()
      .in("id", consumos.map((c) => c.id));
    console.log("registros de consumo borrados:", consumos.length);
  }

  const previos = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await admin.from("alimentos").select("id").range(desde, desde + 999);
    previos.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  for (let i = 0; i < previos.length; i += 200) {
    await admin
      .from("alimentos")
      .delete()
      .in("id", previos.slice(i, i + 200).map((a) => a.id));
  }
  console.log("alimentos anteriores borrados:", previos.length);

  // 2. Cargar el catálogo nuevo.
  const filas = ALIMENTOS.map(([nombre, categoria, kcal, prot, carb, grasa, medida, gramos]) => ({
    nombre,
    categoria,
    porcion_base: 100,
    unidad: "g",
    kcal,
    prot,
    carb,
    grasa,
    activo: true,
    medida_nombre: medida,
    medida_gramos: gramos,
  }));

  const { error } = await admin.from("alimentos").insert(filas);
  if (error) {
    console.error("error insertando:", error.message);
    process.exit(1);
  }

  const { count } = await admin.from("alimentos").select("*", { count: "exact", head: true });
  console.log(`listo. catálogo: ${count} alimentos`);
}
