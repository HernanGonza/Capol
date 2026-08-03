-- Bucket público para firmas digitales de certificados: "profesor-<uid>.png"
-- (una por profesor, reusada en todos sus cursos) y "director.png" (firma
-- compartida de la escuela, cualquier admin la puede reemplazar). Mismo
-- criterio que "avatars": INSERT/UPDATE acotados por nombre de archivo.
insert into storage.buckets (id, name, public)
values ('firmas', 'firmas', true)
on conflict (id) do nothing;

create policy "Subir firma propia o de direccion"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'firmas'
  and (
    name = 'profesor-' || (select auth.uid())::text || '.png'
    or (name = 'director.png' and has_role((select auth.uid()), 'admin'::app_role))
  )
);

create policy "Actualizar firma propia o de direccion"
on storage.objects for update
to authenticated
using (
  bucket_id = 'firmas'
  and (
    name = 'profesor-' || (select auth.uid())::text || '.png'
    or (name = 'director.png' and has_role((select auth.uid()), 'admin'::app_role))
  )
)
with check (
  bucket_id = 'firmas'
  and (
    name = 'profesor-' || (select auth.uid())::text || '.png'
    or (name = 'director.png' and has_role((select auth.uid()), 'admin'::app_role))
  )
);
