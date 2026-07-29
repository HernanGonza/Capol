-- Envolvemos auth.uid() en (select auth.uid()) en TODAS las policies del
-- proyecto (no solo las de hoy). Sin esto, Postgres re-evalúa auth.uid() por
-- CADA FILA que evalúa la policy; envuelto en un subquery escalar, Postgres lo
-- resuelve una sola vez por consulta (initplan) y lo reutiliza. Mismo
-- comportamiento exacto, mejor plan de ejecución a medida que crezcan las tablas.
-- No se toca ninguna lógica de negocio, solo la forma de invocar auth.uid().

-- configuracion_global
alter policy "solo_admin_edita_config" on public.configuracion_global
using (has_role((select auth.uid()), 'admin'::app_role));

-- cursos
alter policy "Admins manage courses" on public.cursos
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Enrolled students view courses" on public.cursos
using (
  (publicado = true) and exists (
    select 1 from inscripciones
    where inscripciones.curso_id = cursos.id
      and inscripciones.usuario_id = (select auth.uid())
  )
);

alter policy "Teachers can view assigned courses" on public.cursos
using (
  exists (
    select 1 from docentes_cursos
    where docentes_cursos.curso_id = cursos.id
      and docentes_cursos.docente_id = (select auth.uid())
  )
  or exists (
    select 1 from roles_usuario
    where roles_usuario.usuario_id = (select auth.uid())
      and roles_usuario.rol = 'admin'::app_role
  )
  or publicado = true
);

-- docentes_cursos
alter policy "Admins can manage course_teachers" on public.docentes_cursos
using (
  exists (
    select 1 from roles_usuario
    where roles_usuario.usuario_id = (select auth.uid())
      and roles_usuario.rol = 'admin'::app_role
  )
);

alter policy "Teachers can view their assignments" on public.docentes_cursos
using (docente_id = (select auth.uid()));

-- ejercicios
alter policy "Admins manage exercises" on public.ejercicios
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Subscribed students view exercises" on public.ejercicios
using (
  exists (
    select 1 from lecciones l
    join suscripciones s on s.curso_id = l.curso_id
    where l.id = ejercicios.leccion_id
      and s.usuario_id = (select auth.uid())
      and s.estado = 'active'::text
      and (s.fin_en > now() or s.fin_en is null)
  )
  or exists (
    select 1 from lecciones l
    join docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = ejercicios.leccion_id
      and dc.docente_id = (select auth.uid())
  )
  or has_role((select auth.uid()), 'admin'::app_role)
);

-- entregas_trabajo_final
alter policy "Admins ven todas las entregas" on public.entregas_trabajo_final
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Los alumnos actualizan su propia entrega" on public.entregas_trabajo_final
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

alter policy "Los alumnos crean su propia entrega" on public.entregas_trabajo_final
with check (usuario_id = (select auth.uid()));

alter policy "Los alumnos ven su propia entrega" on public.entregas_trabajo_final
using (usuario_id = (select auth.uid()));

alter policy "Profesores ven entregas de sus cursos" on public.entregas_trabajo_final
using (
  exists (
    select 1 from lecciones l
    join docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = entregas_trabajo_final.leccion_id
      and dc.docente_id = (select auth.uid())
  )
);

-- inscripciones
alter policy "Admins manage enrollments" on public.inscripciones
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Students view own enrollments" on public.inscripciones
using ((select auth.uid()) = usuario_id);

-- lecciones
alter policy "Admins manage lessons" on public.lecciones
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Subscribed students view lessons" on public.lecciones
using (
  exists (
    select 1 from suscripciones s
    where s.curso_id = lecciones.curso_id
      and s.usuario_id = (select auth.uid())
      and s.estado = 'active'::text
      and (s.fin_en > now() or s.fin_en is null)
  )
  or has_role((select auth.uid()), 'admin'::app_role)
);

alter policy "Teachers can manage lessons of assigned courses" on public.lecciones
using (
  exists (
    select 1 from docentes_cursos
    where docentes_cursos.curso_id = lecciones.curso_id
      and docentes_cursos.docente_id = (select auth.uid())
  )
  or exists (
    select 1 from roles_usuario
    where roles_usuario.usuario_id = (select auth.uid())
      and roles_usuario.rol = 'admin'::app_role
  )
);

-- mensajes_contacto
alter policy "Admin gestiona mensajes de contacto" on public.mensajes_contacto
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));

-- perfiles
alter policy "Users insert own profile" on public.perfiles
with check ((select auth.uid()) = id);

alter policy "Users update own profile" on public.perfiles
using ((select auth.uid()) = id);

alter policy "Users view own profile or admin views all" on public.perfiles
using (
  (select auth.uid()) = id
  or has_role((select auth.uid()), 'admin'::app_role)
);

-- progreso_lecciones
alter policy "Admins view all progress" on public.progreso_lecciones
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Profesores aprueban progreso de sus cursos" on public.progreso_lecciones
using (
  exists (
    select 1 from lecciones l
    join docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = progreso_lecciones.leccion_id
      and dc.docente_id = (select auth.uid())
  )
  or has_role((select auth.uid()), 'admin'::app_role)
)
with check (
  exists (
    select 1 from lecciones l
    join docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = progreso_lecciones.leccion_id
      and dc.docente_id = (select auth.uid())
  )
  or has_role((select auth.uid()), 'admin'::app_role)
);

alter policy "Students manage own progress" on public.progreso_lecciones
using ((select auth.uid()) = usuario_id);

-- roles_usuario
alter policy "Admins manage roles" on public.roles_usuario
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Admins read all roles" on public.roles_usuario
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Users read own roles" on public.roles_usuario
using ((select auth.uid()) = usuario_id);

-- solicitudes_inscripcion
alter policy "admin_gestionar_solicitudes" on public.solicitudes_inscripcion
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "alumno_crear_solicitud" on public.solicitudes_inscripcion
with check ((select auth.uid()) = usuario_id);

alter policy "alumno_ver_sus_solicitudes" on public.solicitudes_inscripcion
using ((select auth.uid()) = usuario_id);

-- suscripciones
alter policy "Admins manage subscriptions" on public.suscripciones
using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Students view own subscriptions" on public.suscripciones
using ((select auth.uid()) = usuario_id);

-- storage.objects (course-flyers, trabajos-finales, avatars ya quedaron bien
-- optimizadas en la migración anterior)
alter policy "Admins can delete course flyers" on storage.objects
using (
  bucket_id = 'course-flyers' and exists (
    select 1 from roles_usuario
    where roles_usuario.usuario_id = (select auth.uid())
      and roles_usuario.rol = 'admin'::app_role
  )
);

alter policy "Admins can update course flyers" on storage.objects
using (
  bucket_id = 'course-flyers' and exists (
    select 1 from roles_usuario
    where roles_usuario.usuario_id = (select auth.uid())
      and roles_usuario.rol = 'admin'::app_role
  )
);

alter policy "Admins can upload course flyers" on storage.objects
with check (
  bucket_id = 'course-flyers' and exists (
    select 1 from roles_usuario
    where roles_usuario.usuario_id = (select auth.uid())
      and roles_usuario.rol = 'admin'::app_role
  )
);

alter policy "Los alumnos actualizan su propio trabajo final" on storage.objects
using (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter policy "Los alumnos suben su propio trabajo final" on storage.objects
with check (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter policy "Los alumnos ven su propio trabajo final" on storage.objects
using (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter policy "Staff ve los trabajos finales de sus cursos" on storage.objects
using (
  bucket_id = 'trabajos-finales' and (
    has_role((select auth.uid()), 'admin'::app_role)
    or exists (
      select 1 from lecciones l
      join docentes_cursos dc on dc.curso_id = l.curso_id
      where l.id::text = (storage.foldername(objects.name))[2]
        and dc.docente_id = (select auth.uid())
    )
  )
);
