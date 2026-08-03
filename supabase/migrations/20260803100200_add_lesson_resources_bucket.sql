-- Bucket para archivos adjuntos a bloques de lección (recurso descargable e
-- imagen subida directamente, en vez de solo pegar una URL externa).
-- Público para lectura por URL directa (mismo criterio que "course-flyers"/
-- "avatars": el SELECT no hace falta, las lecturas van por getPublicUrl, que
-- no pasa por RLS). Path "<curso_id>/<uuid>.<ext>" — permite validar el
-- permiso de escritura por curso sin tabla intermedia.
insert into storage.buckets (id, name, public)
values ('lesson-resources', 'lesson-resources', true)
on conflict (id) do nothing;

create policy "Subir recursos de leccion si se puede editar el curso"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'lesson-resources'
  and (
    has_role((select auth.uid()), 'admin'::app_role)
    or exists (
      select 1 from docentes_cursos dc
      where dc.docente_id = (select auth.uid())
        and dc.curso_id::text = (storage.foldername(objects.name))[1]
    )
  )
);
