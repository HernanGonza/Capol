-- Antes solo el propio alumno (o un admin, y solo para leer) podía tocar su
-- progreso. Ahora el profesor necesita poder marcar como completada la última
-- clase de un alumno cuando aprueba su trabajo final.
create policy "Profesores aprueban progreso de sus cursos"
on public.progreso_lecciones
for all
to authenticated
using (
  exists (
    select 1 from public.lecciones l
    join public.docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = progreso_lecciones.leccion_id
      and dc.docente_id = auth.uid()
  )
  or public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  exists (
    select 1 from public.lecciones l
    join public.docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = progreso_lecciones.leccion_id
      and dc.docente_id = auth.uid()
  )
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);
