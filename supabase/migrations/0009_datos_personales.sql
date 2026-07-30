-- Datos personales del alumno (edad, estatura, condición médica y
-- alimenticia) — los edita el propio alumno desde su portal, el entrenador
-- solo los visualiza en la ficha del alumno.
alter table alumno_perfil
  add column fecha_nacimiento date,
  add column estatura_cm numeric(5, 1) check (estatura_cm is null or estatura_cm > 0),
  add column condicion_medica text,
  add column restriccion_alimenticia text;

-- La política existente (alumno_perfil_write) solo dejaba escribir al
-- entrenador. Se agrega una política adicional para que el propio alumno
-- también pueda actualizar su fila (para estos datos personales).
create policy alumno_perfil_update_propio on alumno_perfil for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
