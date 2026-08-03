-- 1) Habilita alumno -> alumno: solo si ambos tienen una suscripción activa
-- al MISMO curso (compañeros de cursada). No abre alumno -> alumno de
-- cursos distintos ni alumno -> cualquier desconocido.
--
-- 2) De paso, corrige un bug real que ya estaba en producción: la rama de
-- foro comparaba "dc.curso_id = curso_id" y "s.curso_id = curso_id" sin
-- calificar el "curso_id" de la derecha. Como docentes_cursos/suscripciones
-- también tienen una columna curso_id, Postgres resuelve esa referencia
-- ambigua contra la tabla de la subconsulta (dc.curso_id = dc.curso_id),
-- no contra el mensaje que se está insertando — una tautología que en la
-- práctica dejaba postear en el foro de CUALQUIER curso a cualquier
-- profesor asignado a algún curso, o a cualquier alumno con alguna
-- suscripción activa a algún curso (verificado contra pg_policies: Postgres
-- ya lo mostraba resuelto así). Ahora queda calificado como
-- "mensajes.curso_id" explícitamente, sin ambigüedad.
drop policy "Enviar mensajes directo o foro" on public.mensajes;

create policy "Enviar mensajes directo o foro"
on public.mensajes for insert
to authenticated
with check (
  remitente_id = (select auth.uid())
  and not exists (
    select 1 from mensajeria_bloqueados b where b.usuario_id = (select auth.uid())
  )
  and not dentro_de_cooldown_mensajes((select auth.uid()))
  and (
    (
      destinatario_id is not null
      and (
        has_role((select auth.uid()), 'admin'::app_role)
        or exists (
          select 1 from docentes_cursos dc
          join suscripciones s on s.curso_id = dc.curso_id
          where dc.docente_id = (select auth.uid())
            and s.usuario_id = destinatario_id
            and s.estado = 'active'
        )
        or exists (
          select 1 from docentes_cursos dc
          join suscripciones s on s.curso_id = dc.curso_id
          where dc.docente_id = destinatario_id
            and s.usuario_id = (select auth.uid())
            and s.estado = 'active'
        )
        or exists (
          select 1 from suscripciones s1
          join suscripciones s2 on s2.curso_id = s1.curso_id
          where s1.usuario_id = (select auth.uid())
            and s1.estado = 'active'
            and s2.usuario_id = destinatario_id
            and s2.estado = 'active'
        )
        or existe_hilo_mensajes((select auth.uid()), destinatario_id)
      )
    )
    or
    (
      destinatario_id is null and curso_id is not null and (
        has_role((select auth.uid()), 'admin'::app_role)
        or exists (
          select 1 from docentes_cursos dc
          where dc.curso_id = mensajes.curso_id and dc.docente_id = (select auth.uid())
        )
        or exists (
          select 1 from suscripciones s
          where s.curso_id = mensajes.curso_id and s.usuario_id = (select auth.uid()) and s.estado = 'active'
        )
      )
    )
  )
);
