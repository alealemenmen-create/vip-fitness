-- Corrige planes activos matemáticamente inconsistentes sin alterar los
-- anclajes definidos por el entrenador: calorías, proteína y grasa. Los
-- carbohidratos absorben la diferencia. Los casos imposibles (proteína +
-- grasa por encima de las calorías) quedan intactos para revisión humana.
update public.planes_alimentacion
set carb_objetivo = greatest(
  0,
  round((kcal_objetivo - prot_objetivo * 4 - grasa_objetivo * 9)::numeric / 4)::integer
)
where activo = true
  and kcal_objetivo is not null
  and kcal_objetivo > 0
  and prot_objetivo is not null
  and grasa_objetivo is not null
  and prot_objetivo * 4 + grasa_objetivo * 9 <= kcal_objetivo
  and (
    carb_objetivo is null
    or abs(
      prot_objetivo * 4 + carb_objetivo * 4 + grasa_objetivo * 9 - kcal_objetivo
    ) > greatest(50, kcal_objetivo * 0.03)
  );
