-- Faltaba esta política: un upsert (reemplazar el propio avatar) necesita
-- INSERT + SELECT + UPDATE para funcionar. Sin SELECT, Postgres no puede
-- resolver el "on conflict" del upsert y tira "new row violates row-level
-- security policy" al intentar reemplazar una foto ya subida antes.
-- (El bucket es público para lectura vía URL, así que esto no expone nada
-- nuevo — solo habilita el chequeo interno que necesita el upsert.)
create policy "Ver el propio avatar (upsert)"
on storage.objects for select
to authenticated
using (bucket_id = 'avatars' and name like ((select auth.uid())::text || '.%'));
