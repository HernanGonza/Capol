-- 1) Bucket "avatars": antes cualquier usuario autenticado podía sobrescribir
-- el avatar de CUALQUIER OTRO usuario (las políticas de insert/update no
-- restringían el nombre de archivo). Hay dos flujos legítimos de subida:
--   a) durante el registro (Auth.tsx), ANTES de que exista la cuenta, con un
--      nombre temporal "temp_<timestamp>.ext" (todavía no hay auth.uid()).
--   b) desde "Mi Perfil" (Profile.tsx), ya autenticado, con el archivo
--      nombrado exactamente "<uid>.ext".
-- Restringimos insert/update a esos dos patrones exactos.
drop policy if exists "Cualquiera puede subir un avatar" on storage.objects;
drop policy if exists "Los usuarios autenticados pueden actualizar avatares" on storage.objects;

create policy "Subir avatar propio o temporal en registro"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'avatars'
  and (
    name like 'temp\_%' escape '\'
    or ((select auth.uid()) is not null and name like ((select auth.uid())::text || '.%'))
  )
);

create policy "Actualizar solo el propio avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and name like ((select auth.uid())::text || '.%'))
with check (bucket_id = 'avatars' and name like ((select auth.uid())::text || '.%'));

-- 4) Buckets públicos: un bucket "public" ya sirve objetos por URL directa sin
-- pasar por RLS (confirmado en la doc de Supabase) — la policy de SELECT solo
-- hacía falta para poder LISTAR el contenido del bucket vía API, algo que esta
-- app nunca usa (todo el acceso es por getPublicUrl con paths conocidos).
-- Sacarla no rompe nada y evita que cualquiera pueda enumerar todos los
-- archivos subidos (nombres de alumnos, flyers, etc.).
drop policy if exists "Los avatares son publicos" on storage.objects;
drop policy if exists "Public can view course flyers" on storage.objects;
drop policy if exists "Los assets de marca son publicos" on storage.objects;
