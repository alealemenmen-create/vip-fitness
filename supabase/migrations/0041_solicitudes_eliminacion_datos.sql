-- El Asistente VIP puede armar una "solicitud de borrado" cuando el
-- entrenador le pide, por chat, eliminar datos puntuales de un alumno
-- (ej. "borra el historial de entrenamiento de Fulano"). La IA NUNCA borra
-- nada directamente: esta fila es la propuesta (con el conteo exacto de lo
-- que tocaría) y queda en 'pendiente' hasta que el entrenador confirma con
-- un botón explícito, aparte del chat — mismo criterio que borradores_noticias
-- (0037_asistente_vip.sql). También sirve de auditoría: nunca se borra.

create table solicitudes_eliminacion_datos (
  id uuid primary key default gen_random_uuid(),
  alumno_id uuid not null references perfiles(id) on delete cascade,
  categoria text not null check (categoria in ('entrenamiento', 'comida', 'progreso', 'ranking')),
  -- [{tabla, cantidad}] calculado al proponer, para mostrar y para auditoría.
  resumen jsonb not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'cancelado')),
  creado_por uuid not null references perfiles(id),
  generado_con_ia boolean not null default true,
  confirmado_por uuid references perfiles(id),
  confirmado_en timestamptz,
  created_at timestamptz not null default now()
);

alter table solicitudes_eliminacion_datos enable row level security;

create policy solicitudes_eliminacion_staff on solicitudes_eliminacion_datos
  for all using (es_admin_o_entrenador());

-- La auditoría de uso de IA (asistente_uso_ia, 0037_asistente_vip.sql) solo
-- permitía las herramientas de reporte existentes — se suma "eliminar_datos".
alter table asistente_uso_ia drop constraint asistente_uso_ia_herramienta_check;
alter table asistente_uso_ia add constraint asistente_uso_ia_herramienta_check
  check (herramienta in ('atencion', 'nutricion', 'entrenamiento', 'progreso', 'noticia', 'alumno', 'eliminar_datos'));
