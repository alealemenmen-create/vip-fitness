-- Pago de inscripción en el registro público, y aviso de beta.
--
-- QUEDA CONSTRUIDO PERO APAGADO. `pago_registro_activo` arranca en false a
-- propósito: durante la beta los alumnos del gimnasio se inscriben por el link
-- sin pagar nada, y el paso del comprobante ni siquiera se les muestra.
-- Cuando llegue el momento se enciende desde Configuración, sin tocar código
-- ni volver a desplegar.
--
-- Cómo funciona una vez encendido:
--   1. La persona manda sus datos (solicitud, migración 0032).
--   2. Ve los datos bancarios del gimnasio y sube el capture de la
--      transferencia, que queda pegado a su solicitud.
--   3. El entrenador mira el comprobante en el panel, lo compara con su cuenta
--      y marca el pago como verificado.
--   4. Recién ahí crea la cuenta con "Aceptar".
--
-- El comprobante NO bloquea el envío de la solicitud: alguien puede pagar
-- después o mandar el capture por WhatsApp, y esa solicitud tiene que llegar
-- igual (marcada como "sin comprobante") en vez de perderse.

-- ── 1. Configuración del gimnasio ────────────────────────────────────────

alter table configuracion_gimnasio
  -- Aviso de "esto es una prueba" en la pantalla de registro. Se apaga solo
  -- cuando la beta termine.
  add column if not exists registro_beta_aviso boolean not null default true,
  add column if not exists pago_registro_activo boolean not null default false,
  -- En pesos chilenos, sin decimales. Null = no se muestra monto y el valor
  -- se acuerda por WhatsApp.
  add column if not exists pago_monto integer
    check (pago_monto is null or pago_monto >= 0),
  add column if not exists pago_banco text,
  add column if not exists pago_tipo_cuenta text,
  add column if not exists pago_numero_cuenta text,
  add column if not exists pago_rut text,
  add column if not exists pago_titular text,
  add column if not exists pago_correo text,
  add column if not exists pago_instrucciones text,
  -- Número al que se manda el comprobante por WhatsApp (solo dígitos con
  -- código de país, ej: 56912345678). Sin esto, el botón de WhatsApp de la
  -- pantalla de pago no se muestra.
  add column if not exists whatsapp_gimnasio text;

-- ── 2. Comprobante en la solicitud ───────────────────────────────────────

alter table solicitudes_registro
  add column if not exists comprobante_path text,
  add column if not exists comprobante_subido_en timestamptz,
  add column if not exists pago_verificado boolean not null default false,
  add column if not exists pago_verificado_por uuid references perfiles(id) on delete set null,
  add column if not exists pago_verificado_en timestamptz;

-- ── 3. Bucket de comprobantes ────────────────────────────────────────────
--
-- Privado. La subida la hace el servidor con la service_role (quien sube no
-- tiene sesión: todavía no es usuario de la app), así que no hace falta
-- ninguna política de insert. Leer y borrar, solo entrenador/admin.

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists comprobantes_storage_select on storage.objects;
create policy comprobantes_storage_select on storage.objects for select
  using (bucket_id = 'comprobantes' and es_admin_o_entrenador());

drop policy if exists comprobantes_storage_delete on storage.objects;
create policy comprobantes_storage_delete on storage.objects for delete
  using (bucket_id = 'comprobantes' and es_admin_o_entrenador());
