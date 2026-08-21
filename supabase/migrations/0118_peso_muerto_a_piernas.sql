-- Los 4 ejercicios de "peso muerto" estaban etiquetados grupo_muscular =
-- 'espalda'. Alejandro los clasifica como piernas (femoral/glúteo), no
-- espalda -- pedido explícito 2026-08-21: "el peso muerto yo no lo tiro
-- para espalda, todos los pesos muertos son de glúteos, para mí, femorales
-- y glúteos". "Peso muerto sumo" ya estaba en 'piernas' (sin cambios).
-- "Buenos días" queda deliberadamente en 'espalda' -- no se pidió tocarlo.
update ejercicios
set grupo_muscular = 'piernas'
where nombre in ('Peso muerto', 'Peso muerto parcial', 'Peso muerto rumano', 'Peso muerto rumano con mancuernas')
  and grupo_muscular = 'espalda';
