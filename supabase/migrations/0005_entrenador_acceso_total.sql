-- Decisión de producto (no solo seguridad): el equipo de entrenadores es de
-- confianza y cualquiera debe poder ver y gestionar a cualquier alumno, sin
-- necesidad de "asignar" alumnos a un entrenador específico. Antes,
-- es_entrenador_de() solo devolvía true si el alumno estaba vinculado a ESE
-- entrenador en particular (o si el usuario actual era admin); ahora
-- cualquier rol 'entrenador' o 'admin' tiene acceso total.
--
-- Como todas las políticas de RLS (rutinas, notas, documentos, pesos, fotos,
-- comidas, sesiones, seguimientos, perfiles, y los buckets de Storage) usan
-- esta misma función, el cambio se propaga solo con este único archivo.
--
-- alumno_perfil.entrenador_id se mantiene en el esquema, pero pasa a ser
-- solo informativo (quién dio de alta al alumno), ya no restringe el acceso.

create or replace function es_entrenador_de(p_alumno_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select rol_actual() in ('entrenador', 'admin');
$$;
