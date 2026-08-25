-- El borrado de una clase se realiza desde el cliente mediante Storage API,
-- antes de eliminar la fila de public.lecciones. Estas policies permiten que
-- admin y el profesor asignado limpien los objetos físicos asociados.
create policy "Staff elimina recursos de sus clases"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'lesson-resources'
  and (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    or exists (
      select 1
      from public.docentes_cursos dc
      where dc.docente_id = (select auth.uid())
        and dc.curso_id::text = (storage.foldername(objects.name))[1]
    )
  )
);

create policy "Staff elimina trabajos de sus clases"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'trabajos-finales'
  and (
    public.has_role((select auth.uid()), 'admin'::public.app_role)
    or exists (
      select 1
      from public.lecciones l
      join public.docentes_cursos dc on dc.curso_id = l.curso_id
      where l.id::text = (storage.foldername(objects.name))[2]
        and dc.docente_id = (select auth.uid())
    )
  )
);
