-- La política original de staff dejaba ver a CUALQUIER profesor todos los
-- archivos de trabajos finales, sin importar el curso. La acotamos a los
-- cursos donde el profesor está realmente asignado (docentes_cursos + lecciones).
drop policy if exists "Staff ve todos los trabajos finales" on storage.objects;
drop policy if exists "Staff ve los trabajos finales de sus cursos" on storage.objects;

create policy "Staff ve los trabajos finales de sus cursos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trabajos-finales'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or exists (
      select 1 from public.lecciones l
      join public.docentes_cursos dc on dc.curso_id = l.curso_id
      where l.id::text = (storage.foldername(name))[2]
        and dc.docente_id = auth.uid()
    )
  )
);
