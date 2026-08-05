-- Suscripciones de notificaciones push (Web Push): para avisar el fin del
-- descanso incluso con la pantalla bloqueada o la app en otra pestaña. Un
-- `setInterval` del navegador se suspende ahi (iOS lo pausa en cuanto la app
-- pasa a segundo plano), asi que el aviso lo tiene que mandar el servidor
-- via push real, no un temporizador que vive en la pestaña.
--
-- Guarda lo minimo que exige la Push API del navegador (endpoint + claves de
-- cifrado del canal), nada de datos personales.

create table if not exists push_suscripciones (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  creado_en timestamptz not null default now()
);

create index if not exists push_suscripciones_alumno_idx on push_suscripciones (alumno_id);

alter table push_suscripciones enable row level security;

-- El alumno gestiona sus propias suscripciones (se crean solas al aceptar el
-- permiso de notificaciones, ver `asegurarSuscripcionPush` en
-- lib/entrenamiento/push.ts). El envio real lo hace el servidor con el
-- cliente admin, que no pasa por RLS.
drop policy if exists push_suscripciones_alumno on push_suscripciones;
create policy push_suscripciones_alumno on push_suscripciones for all
  using (alumno_id = auth.uid())
  with check (alumno_id = auth.uid());
