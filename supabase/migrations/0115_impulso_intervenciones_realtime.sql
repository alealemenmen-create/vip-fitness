-- Las indicaciones de Alejandro llegan directamente al navegador del alumno.
-- Esto reemplaza el sondeo de una Server Action cada 8 segundos, que agotaba
-- el cupo de Vercel aun cuando no existía ninguna indicación nueva.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'impulso_vip_intervenciones'
  ) then
    alter publication supabase_realtime add table public.impulso_vip_intervenciones;
  end if;
end
$$;
