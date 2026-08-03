-- Faltaba esta política (mismo caso que "avatars" en
-- 20260730200000_add_avatars_select_policy.sql): un upsert (reemplazar una
-- firma ya subida) necesita INSERT + SELECT + UPDATE para funcionar. Sin
-- SELECT, Postgres no puede resolver el "on conflict" del upsert y tira
-- "new row violates row-level security policy" al volver a firmar.
-- (El bucket es público para lectura vía URL, así que esto no expone nada
-- nuevo — solo habilita el chequeo interno que necesita el upsert.)
create policy "Ver firma propia o de direccion (upsert)"
on storage.objects for select
to authenticated
using (
  bucket_id = 'firmas'
  and (
    name = 'profesor-' || (select auth.uid())::text || '.png'
    or (name = 'director.png' and has_role((select auth.uid()), 'admin'::app_role))
  )
);
