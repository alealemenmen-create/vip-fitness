-- Una sola alerta push por intervención. La intervención conserva su flujo
-- automático: esta tabla registra la oportunidad de revisión de Ale y evita
-- duplicar vibraciones cuando el alumno guarda varias veces.

create table if not exists impulso_vip_avisos_entrenador (
  intervencion_id uuid primary key references impulso_vip_intervenciones(id) on delete cascade,
  alumno_id uuid not null references perfiles(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'descartada', 'automatica')),
  enviado_en timestamptz not null default now(),
  vence_en timestamptz not null default (now() + interval '20 minutes'),
  respondida_en timestamptz,
  respondida_por uuid references perfiles(id) on delete set null
);

create index if not exists impulso_vip_avisos_entrenador_estado_idx
  on impulso_vip_avisos_entrenador (estado, enviado_en desc);

alter table impulso_vip_avisos_entrenador enable row level security;

drop policy if exists impulso_vip_avisos_entrenador_select on impulso_vip_avisos_entrenador;
create policy impulso_vip_avisos_entrenador_select
  on impulso_vip_avisos_entrenador for select
  using (rol_actual() in ('entrenador', 'admin'));
