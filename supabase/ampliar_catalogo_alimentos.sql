-- Ampliacion del catalogo de alimentos (de ~38 a ~164), a partir de la lista
-- entregada por el entrenador. Solo agrega lo que faltaba: los que ya
-- existian (pollo, arroz, palta, etc.) no se repiten.
-- Seguro de re-correr: usa "on conflict (nombre) do nothing" gracias a la
-- restriccion unica agregada en 0004_alimentos_nombre_unique.sql (correr esa
-- migracion primero).

insert into alimentos (nombre, categoria, porcion_base, unidad, kcal, prot, carb, grasa) values
  -- Proteinas
  ('Cerdo magro (lomo)', 'Proteina', 100, 'g', 143, 21.0, 0.0, 6.0),
  ('Jurel', 'Proteina', 100, 'g', 158, 20.0, 0.0, 8.0),
  ('Camarones (crudos)', 'Proteina', 100, 'g', 85, 20.0, 0.2, 0.5),
  ('Quesillo', 'Proteina', 100, 'g', 150, 12.0, 3.0, 10.0),
  ('Yogurt griego (natural, sin azucar)', 'Proteina', 100, 'g', 59, 10.0, 3.6, 0.4),
  ('Yogurt alto en proteina (tipo Skyr)', 'Proteina', 100, 'g', 63, 11.0, 4.0, 0.2),
  ('Leche alta en proteina', 'Proteina', 100, 'ml', 50, 8.0, 4.0, 0.3),

  -- Carbohidratos
  ('Arroz basmati (crudo)', 'Carbohidrato', 100, 'g', 356, 7.5, 78.0, 0.9),
  ('Choclo (grano fresco)', 'Carbohidrato', 100, 'g', 96, 3.4, 21.0, 1.5),
  ('Pan pita integral', 'Carbohidrato', 1, 'unidad', 165, 6.0, 33.0, 1.2),
  ('Tortilla / wrap integral', 'Carbohidrato', 1, 'unidad', 120, 4.0, 20.0, 3.0),
  ('Galletas de agua (tipo Salmas)', 'Carbohidrato', 1, 'unidad', 30, 0.6, 5.0, 0.9),
  ('Galletas de arroz', 'Carbohidrato', 1, 'unidad', 35, 0.7, 7.5, 0.3),
  ('Pasta integral (cruda)', 'Carbohidrato', 100, 'g', 348, 13.0, 66.0, 2.5),
  ('Cuscus (crudo)', 'Carbohidrato', 100, 'g', 376, 12.8, 77.4, 0.6),
  ('Granola sin azucar', 'Carbohidrato', 100, 'g', 471, 10.0, 64.0, 20.0),
  ('Cereal integral (alto en fibra)', 'Carbohidrato', 100, 'g', 320, 10.0, 68.0, 3.0),
  ('Tortillas de maiz', 'Carbohidrato', 1, 'unidad', 55, 1.4, 12.0, 0.6),
  ('Pan de centeno', 'Carbohidrato', 1, 'rebanada', 65, 2.2, 12.0, 0.5),
  ('Pan de masa madre', 'Carbohidrato', 1, 'rebanada', 92, 3.3, 18.0, 0.5),
  ('Pan proteico', 'Carbohidrato', 1, 'rebanada', 70, 6.0, 8.0, 1.5),
  ('Avena instantanea', 'Carbohidrato', 100, 'g', 375, 13.0, 65.0, 6.5),
  ('Harina de almendras', 'Carbohidrato', 100, 'g', 571, 21.0, 21.0, 50.0),
  ('Arroz inflado', 'Carbohidrato', 100, 'g', 387, 6.0, 89.0, 1.0),

  -- Legumbres
  ('Lentejas (cocidas)', 'Legumbre', 100, 'g', 116, 9.0, 20.0, 0.4),
  ('Garbanzos (cocidos)', 'Legumbre', 100, 'g', 164, 8.9, 27.4, 2.6),
  ('Porotos (cocidos)', 'Legumbre', 100, 'g', 127, 8.7, 22.8, 0.5),
  ('Arvejas (cocidas)', 'Legumbre', 100, 'g', 84, 5.4, 14.5, 0.4),
  ('Habas (cocidas)', 'Legumbre', 100, 'g', 88, 7.6, 17.6, 0.5),

  -- Verduras
  ('Acelga', 'Fruta/Verdura', 100, 'g', 19, 1.8, 3.7, 0.2),
  ('Rucula', 'Fruta/Verdura', 100, 'g', 25, 2.6, 3.7, 0.7),
  ('Zanahoria', 'Fruta/Verdura', 100, 'g', 41, 0.9, 9.6, 0.2),
  ('Betarraga', 'Fruta/Verdura', 100, 'g', 43, 1.6, 9.6, 0.2),
  ('Coliflor', 'Fruta/Verdura', 100, 'g', 25, 1.9, 5.0, 0.3),
  ('Zapallo', 'Fruta/Verdura', 100, 'g', 26, 1.0, 6.5, 0.1),
  ('Pimenton', 'Fruta/Verdura', 100, 'g', 31, 1.0, 6.0, 0.3),
  ('Apio', 'Fruta/Verdura', 100, 'g', 16, 0.7, 3.0, 0.2),
  ('Repollo', 'Fruta/Verdura', 100, 'g', 25, 1.3, 5.8, 0.1),
  ('Repollo morado', 'Fruta/Verdura', 100, 'g', 31, 1.4, 7.4, 0.2),
  ('Champinones', 'Fruta/Verdura', 100, 'g', 22, 3.1, 3.3, 0.3),
  ('Esparragos', 'Fruta/Verdura', 100, 'g', 20, 2.2, 3.9, 0.1),
  ('Alcachofa', 'Fruta/Verdura', 100, 'g', 47, 3.3, 10.5, 0.2),
  ('Cebolla', 'Fruta/Verdura', 100, 'g', 40, 1.1, 9.3, 0.1),
  ('Cebollin', 'Fruta/Verdura', 100, 'g', 32, 1.8, 4.4, 0.7),
  ('Ajo', 'Fruta/Verdura', 100, 'g', 149, 6.4, 33.0, 0.5),
  ('Porotos verdes', 'Fruta/Verdura', 100, 'g', 31, 1.8, 7.0, 0.2),

  -- Frutas
  ('Pera', 'Fruta/Verdura', 1, 'unidad', 96, 0.6, 25.7, 0.3),
  ('Kiwi', 'Fruta/Verdura', 1, 'unidad', 46, 0.8, 11.0, 0.4),
  ('Naranja', 'Fruta/Verdura', 1, 'unidad', 84, 1.7, 21.0, 0.2),
  ('Mandarina', 'Fruta/Verdura', 1, 'unidad', 40, 0.6, 10.0, 0.2),
  ('Pomelo', 'Fruta/Verdura', 100, 'g', 32, 0.6, 8.0, 0.1),
  ('Pina', 'Fruta/Verdura', 100, 'g', 50, 0.5, 13.1, 0.1),
  ('Sandia', 'Fruta/Verdura', 100, 'g', 30, 0.6, 7.6, 0.2),
  ('Melon', 'Fruta/Verdura', 100, 'g', 34, 0.8, 8.2, 0.2),
  ('Durazno', 'Fruta/Verdura', 1, 'unidad', 59, 1.4, 14.3, 0.4),
  ('Ciruela', 'Fruta/Verdura', 1, 'unidad', 30, 0.5, 7.5, 0.2),
  ('Uvas', 'Fruta/Verdura', 100, 'g', 69, 0.7, 18.1, 0.2),
  ('Frambuesas', 'Fruta/Verdura', 100, 'g', 52, 1.2, 11.9, 0.7),
  ('Mango', 'Fruta/Verdura', 100, 'g', 60, 0.8, 15.0, 0.4),
  ('Papaya', 'Fruta/Verdura', 100, 'g', 43, 0.5, 10.8, 0.3),

  -- Grasas saludables
  ('Pistachos', 'Grasa', 100, 'g', 560, 20.0, 27.5, 45.3),
  ('Castanas de caju', 'Grasa', 100, 'g', 553, 18.0, 30.0, 44.0),
  ('Mantequilla de almendras', 'Grasa', 1, 'cucharada', 98, 3.4, 3.0, 8.9),
  ('Linaza (semillas de lino)', 'Grasa', 100, 'g', 534, 18.3, 28.9, 42.2),
  ('Semillas de zapallo', 'Grasa', 100, 'g', 559, 30.2, 10.7, 49.0),
  ('Semillas de maravilla', 'Grasa', 100, 'g', 584, 20.8, 20.0, 51.5),
  ('Sesamo', 'Grasa', 100, 'g', 573, 17.7, 23.4, 49.7),
  ('Mix de frutos secos', 'Grasa', 100, 'g', 590, 18.0, 20.0, 52.0),
  ('Mix de semillas', 'Grasa', 100, 'g', 550, 20.0, 20.0, 45.0),
  ('Coco rallado sin azucar', 'Grasa', 100, 'g', 660, 6.9, 6.4, 65.0),
  ('Aceitunas', 'Grasa', 100, 'g', 115, 0.8, 6.0, 10.7),
  ('Mantequilla de mani en polvo', 'Grasa', 1, 'cucharada', 45, 5.0, 4.0, 1.5),

  -- Lacteos y alternativas
  ('Leche descremada', 'Lacteo', 100, 'ml', 34, 3.4, 5.0, 0.1),
  ('Leche sin lactosa', 'Lacteo', 100, 'ml', 46, 3.3, 4.9, 1.5),
  ('Leche de almendras (sin azucar)', 'Lacteo', 100, 'ml', 15, 0.5, 0.3, 1.2),
  ('Leche de avena', 'Lacteo', 100, 'ml', 47, 1.0, 6.7, 1.5),
  ('Leche de soya (sin azucar)', 'Lacteo', 100, 'ml', 33, 3.3, 1.8, 1.8),
  ('Yogurt natural (entero)', 'Lacteo', 100, 'g', 61, 3.5, 4.7, 3.3),
  ('Kefir', 'Lacteo', 100, 'ml', 41, 3.4, 4.5, 1.0),
  ('Ricotta', 'Lacteo', 100, 'g', 174, 11.3, 3.0, 13.0),
  ('Requeson', 'Lacteo', 100, 'g', 98, 11.0, 3.4, 4.3),
  ('Queso fresco light', 'Lacteo', 100, 'g', 120, 15.0, 3.0, 5.0),

  -- Bebidas
  ('Agua', 'Bebida', 100, 'ml', 0, 0.0, 0.0, 0.0),
  ('Agua mineral', 'Bebida', 100, 'ml', 0, 0.0, 0.0, 0.0),
  ('Cafe (negro, sin azucar)', 'Bebida', 100, 'ml', 1, 0.1, 0.0, 0.0),
  ('Te', 'Bebida', 100, 'ml', 1, 0.0, 0.2, 0.0),
  ('Te verde', 'Bebida', 100, 'ml', 1, 0.0, 0.0, 0.0),
  ('Mate', 'Bebida', 100, 'ml', 2, 0.1, 0.3, 0.0),
  ('Bebida Zero', 'Bebida', 100, 'ml', 0.3, 0.0, 0.0, 0.0),
  ('Bebida Light', 'Bebida', 100, 'ml', 20, 0.0, 5.0, 0.0),

  -- Snacks
  ('Barritas de proteina', 'Snack', 1, 'unidad', 220, 20.0, 22.0, 7.0),
  ('Gelatina Light', 'Snack', 100, 'g', 7, 1.3, 0.3, 0.0),
  ('Chocolate 85%', 'Snack', 100, 'g', 598, 7.8, 33.0, 48.0),
  ('Chocolate 90%', 'Snack', 100, 'g', 604, 9.0, 23.0, 52.0),
  ('Cacao amargo (polvo)', 'Snack', 100, 'g', 228, 19.6, 57.9, 13.7),

  -- Condimentos
  ('Limon (jugo)', 'Condimento', 100, 'ml', 22, 0.4, 6.9, 0.2),
  ('Vinagre', 'Condimento', 100, 'ml', 19, 0.0, 0.9, 0.0),
  ('Mostaza', 'Condimento', 100, 'g', 66, 4.4, 5.3, 3.3),
  ('Salsa de soya baja en sodio', 'Condimento', 100, 'ml', 53, 8.0, 6.0, 0.1),
  ('Oregano (seco)', 'Condimento', 100, 'g', 265, 9.0, 68.9, 4.3),
  ('Merken', 'Condimento', 100, 'g', 280, 12.0, 45.0, 8.0),
  ('Paprika', 'Condimento', 100, 'g', 282, 14.1, 54.0, 12.9),
  ('Pimienta negra', 'Condimento', 100, 'g', 251, 10.4, 64.0, 3.3),
  ('Curry (polvo)', 'Condimento', 100, 'g', 325, 14.3, 55.8, 14.0),
  ('Comino', 'Condimento', 100, 'g', 375, 17.8, 44.2, 22.3),
  ('Canela', 'Condimento', 100, 'g', 247, 4.0, 80.6, 1.2),
  ('Endulzante (stevia/sucralosa)', 'Condimento', 100, 'g', 0, 0.0, 0.0, 0.0),

  -- Suplementos
  ('Creatina', 'Suplemento', 1, 'cucharadita', 0, 0.0, 0.0, 0.0),
  ('Omega 3', 'Suplemento', 1, 'capsula', 9, 0.0, 0.0, 1.0),
  ('Magnesio', 'Suplemento', 1, 'capsula', 0, 0.0, 0.0, 0.0),
  ('Zinc', 'Suplemento', 1, 'capsula', 0, 0.0, 0.0, 0.0),
  ('Multivitaminico', 'Suplemento', 1, 'capsula', 0, 0.0, 0.0, 0.0),
  ('Vitamina C', 'Suplemento', 1, 'capsula', 0, 0.0, 0.0, 0.0),
  ('Electrolitos', 'Suplemento', 1, 'sobre', 5, 0.0, 1.0, 0.0),

  -- Otros (uso frecuente en nutricion deportiva)
  ('Edamame (cocido)', 'Otro', 100, 'g', 122, 11.9, 8.9, 5.2),
  ('Tofu (firme)', 'Otro', 100, 'g', 76, 8.0, 1.9, 4.8),
  ('Tempeh', 'Otro', 100, 'g', 192, 20.3, 7.6, 10.8),
  ('Seitan', 'Otro', 100, 'g', 370, 75.0, 14.0, 1.9),
  ('Hummus', 'Otro', 100, 'g', 166, 7.9, 14.3, 9.6),
  ('Guacamole', 'Otro', 100, 'g', 150, 2.0, 8.5, 13.4),
  ('Pepinillos', 'Otro', 100, 'g', 11, 0.3, 2.3, 0.2),
  ('Pasas', 'Otro', 100, 'g', 299, 3.1, 79.2, 0.5),
  ('Datiles', 'Otro', 1, 'unidad', 23, 0.2, 6.0, 0.0),
  ('Mermelada sin azucar', 'Otro', 100, 'g', 130, 0.5, 32.0, 0.1),
  ('Miel', 'Otro', 1, 'cucharada', 64, 0.1, 17.3, 0.0),
  ('Bebida isotonica sin azucar', 'Otro', 100, 'ml', 2, 0.0, 0.3, 0.0)

on conflict (nombre) do nothing;
