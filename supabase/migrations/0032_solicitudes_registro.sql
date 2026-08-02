-- Registro público de alumnos: el entrenador manda un link por WhatsApp, la
-- persona se inscribe sola y la solicitud queda esperando aprobación. Nadie
-- entra a la app hasta que el entrenador la acepta desde su panel.
--
-- Decisiones de diseño que conviene no perder:
--
-- 1. La solicitud NO crea cuenta de Auth. Mientras está pendiente es solo una
--    fila de datos: si fuera una cuenta bloqueada, un link público dejaría a
--    cualquiera creando usuarios en el proyecto de Supabase. La cuenta se crea
--    recién al aceptar, con el mismo camino que ya usa "Agregar alumno nuevo"
--    (contraseña generada + correo con las credenciales).
--
-- 2. El formulario público NO escribe con RLS: entra por una Server Action que
--    usa el cliente admin, igual que el alta de alimentos del alumno (0030).
--    Por eso esta tabla no lleva ninguna política de insert para anon — no hay
--    forma de escribirle desde el navegador saltándose las validaciones.
--
-- 3. Los datos de salud se copian a `alumno_perfil` al aceptar, pero la
--    solicitud original se conserva: sirve de historial de qué declaró la
--    persona el día que se inscribió, aunque después edite su perfil.

-- ── 1. Campos nuevos del perfil del alumno ───────────────────────────────
--
-- `telefono` y `sexo` no existían: los pide el formulario de registro y el
-- alumno los sigue viendo/editando en "Mi perfil". El resto (fecha de
-- nacimiento, estatura, condición médica y alimenticia) ya venía de la 0009.

alter table alumno_perfil add column if not exists telefono text;
alter table alumno_perfil add column if not exists sexo text
  check (sexo is null or sexo in ('femenino', 'masculino', 'otro'));

-- ── 2. Solicitudes ───────────────────────────────────────────────────────

create table if not exists solicitudes_registro (
  id uuid primary key default gen_random_uuid(),

  -- Identidad y contacto (lo único obligatorio: sin esto no hay a quién
  -- crearle la cuenta ni por dónde avisarle).
  nombre text not null,
  email text not null,
  telefono text not null,

  -- Datos de salud declarados. Todos opcionales a propósito: un formulario
  -- largo y obligatorio se abandona a la mitad, y lo que falte el entrenador
  -- se lo pregunta en la primera sesión.
  fecha_nacimiento date,
  sexo text check (sexo is null or sexo in ('femenino', 'masculino', 'otro')),
  estatura_cm numeric(5, 1) check (estatura_cm is null or (estatura_cm > 0 and estatura_cm <= 260)),
  peso_kg numeric(6, 2) check (peso_kg is null or (peso_kg > 0 and peso_kg <= 500)),
  objetivo text,
  condicion_medica text,
  restriccion_alimenticia text,
  mensaje text,

  -- Revisión del entrenador.
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  revisada_por uuid references perfiles(id) on delete set null,
  revisada_en timestamptz,
  motivo_rechazo text,
  -- Alumno creado al aceptar. `on delete set null`: si después se elimina al
  -- alumno, la solicitud queda como registro histórico y no se va con él.
  alumno_id uuid references perfiles(id) on delete set null,

  created_at timestamptz not null default now()
);

-- Una sola solicitud pendiente por correo. Sin esto, tocar dos veces "Enviar"
-- con la conexión lenta del gimnasio le deja dos tarjetas iguales al
-- entrenador. Es parcial a propósito: si la rechazan, la persona puede
-- volver a postular más adelante con el mismo correo.
create unique index if not exists solicitudes_registro_email_pendiente_key
  on solicitudes_registro (lower(email)) where estado = 'pendiente';

-- "Las que están esperando", que es la consulta del panel en cada carga.
create index if not exists solicitudes_registro_pendientes_idx
  on solicitudes_registro (created_at desc) where estado = 'pendiente';

-- ── 3. RLS ───────────────────────────────────────────────────────────────
--
-- Solo entrenador/admin, y solo para leer y resolver. El alta pública pasa
-- por el servidor con cliente admin (ver punto 2 del encabezado), así que acá
-- no hace falta ninguna política de insert: sin política, nadie más escribe.

alter table solicitudes_registro enable row level security;

drop policy if exists solicitudes_registro_select on solicitudes_registro;
create policy solicitudes_registro_select on solicitudes_registro for select
  using (es_admin_o_entrenador());

drop policy if exists solicitudes_registro_update on solicitudes_registro;
create policy solicitudes_registro_update on solicitudes_registro for update
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

drop policy if exists solicitudes_registro_delete on solicitudes_registro;
create policy solicitudes_registro_delete on solicitudes_registro for delete
  using (es_admin_o_entrenador());
