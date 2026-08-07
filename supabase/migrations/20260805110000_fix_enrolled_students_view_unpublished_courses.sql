-- Bug: esta policy exigía publicado=true ADEMÁS de la inscripción, lo cual
-- la volvía redundante con "Public can view published courses" (esa ya
-- cubre publicado=true para cualquiera, inscripto o no). En la práctica, un
-- alumno inscripto (vía suscripción activa) en un curso que el admin dejó
-- como borrador — para venderlo manualmente sin que aparezca en el
-- catálogo público — no podía ver ni el curso ni sus lecciones.
drop policy "Enrolled students view courses" on public.cursos;

create policy "Enrolled students view courses"
on public.cursos for select
to authenticated
using (
  exists (
    select 1 from public.inscripciones
    where inscripciones.curso_id = cursos.id
      and inscripciones.usuario_id = (select auth.uid())
  )
);
