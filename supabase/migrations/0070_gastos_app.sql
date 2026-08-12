-- Control de los servicios que mantienen funcionando VIP Fitness.
-- Guarda el calendario vigente separado del historial: marcar un pago nunca
-- borra el anterior y mueve el próximo vencimiento según el ciclo elegido.

create table if not exists gastos_app (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 2 and 100),
  categoria text not null default 'servicio' check (categoria in ('infraestructura', 'ia', 'dominio', 'comunicaciones', 'desarrollo', 'servicio', 'otro')),
  uso_app text,
  proveedor text,
  plan text,
  monto_estimado numeric(12, 2) check (monto_estimado is null or monto_estimado >= 0),
  moneda text not null default 'USD' check (moneda in ('CLP', 'USD', 'EUR')),
  ciclo text not null default 'mensual' check (ciclo in ('mensual', 'anual', 'variable', 'unico')),
  proxima_fecha date,
  avisar_dias_antes integer not null default 3 check (avisar_dias_antes between 0 and 90),
  enlace_panel text,
  notas text,
  activo boolean not null default true,
  creado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists gastos_app_pagos (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references gastos_app(id) on delete restrict,
  fecha_pago date not null default current_date,
  monto_real numeric(12, 2) check (monto_real is null or monto_real >= 0),
  moneda text not null default 'USD' check (moneda in ('CLP', 'USD', 'EUR')),
  periodo_vencimiento date,
  nota text,
  registrado_por uuid references perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists gastos_app_proxima_fecha_idx
  on gastos_app (proxima_fecha) where activo = true;
create unique index if not exists gastos_app_nombre_unico_idx
  on gastos_app (lower(nombre));
create index if not exists gastos_app_pagos_gasto_fecha_idx
  on gastos_app_pagos (gasto_id, fecha_pago desc);

alter table gastos_app enable row level security;
alter table gastos_app_pagos enable row level security;

drop policy if exists gastos_app_control_entrenador on gastos_app;
create policy gastos_app_control_entrenador on gastos_app for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

drop policy if exists gastos_app_pagos_control_entrenador on gastos_app_pagos;
create policy gastos_app_pagos_control_entrenador on gastos_app_pagos for all
  using (es_admin_o_entrenador())
  with check (es_admin_o_entrenador());

-- Inventario inicial tomado de PAGOS_SERVICIOS.md. Los montos desconocidos
-- quedan vacíos para no inventar cobros; pueden completarse desde la app.
insert into gastos_app
  (nombre, categoria, uso_app, proveedor, plan, monto_estimado, moneda, ciclo, proxima_fecha, avisar_dias_antes, notas)
values
  ('Cloudflare Stream', 'infraestructura', 'Videos de ejercicios', 'Cloudflare', 'Starter Bundle', 5, 'USD', 'mensual', '2026-09-08', 3, 'Precio base; los excesos se cobran aparte.'),
  ('Vercel', 'infraestructura', 'Hosting, funciones y cron', 'Vercel', 'Por confirmar', null, 'USD', 'mensual', null, 5, 'Completar plan y fecha desde Billing.'),
  ('Supabase', 'infraestructura', 'Base de datos, usuarios y archivos', 'Supabase', 'Por confirmar', null, 'USD', 'mensual', null, 5, 'Completar plan y fecha desde Billing.'),
  ('Dominio vipfitness.cl', 'dominio', 'Dirección pública de la aplicación', null, 'Renovación anual', null, 'CLP', 'anual', null, 30, 'Completar registrador, precio y vencimiento.'),
  ('Anthropic API', 'ia', 'Asistente y revisiones con IA', 'Anthropic', 'Variable por consumo', 0.71, 'USD', 'variable', null, 5, 'Estimación de referencia de una medición; revisar el consumo mensual, no requiere cuadrar cada llamada con factura.'),
  ('Resend', 'comunicaciones', 'Correos transaccionales', 'Resend', 'Por confirmar', null, 'USD', 'mensual', null, 5, 'Completar plan, cuota y fecha.'),
  ('GitHub', 'desarrollo', 'Repositorio y colaboración', 'GitHub', 'Por confirmar', null, 'USD', 'mensual', null, 5, 'Registrar solo si el plan actual es pagado.'),
  ('Cloudflare DNS', 'infraestructura', 'DNS de vipfitness.cl', 'Cloudflare', 'Normalmente gratuito', 0, 'USD', 'variable', null, 5, 'Sin vencimiento conocido; revisar junto con el dominio.')
on conflict do nothing;
