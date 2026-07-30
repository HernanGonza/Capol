-- Un mensaje sin destinatario y con curso_id es un mensaje de FORO: grupal,
-- visible/escribible por todos los que tienen acceso vigente a ese curso
-- (admin, profesor asignado, o alumno con suscripción activa). Reutilizamos
-- la misma tabla "mensajes" en vez de crear una tabla nueva.
alter table public.mensajes alter column destinatario_id drop not null;

alter table public.mensajes add constraint mensajes_destinatario_o_foro
  check (destinatario_id is not null or curso_id is not null);

create index idx_mensajes_foro on public.mensajes(curso_id, creado_en)
  where destinatario_id is null;

drop policy "Ver mensajes propios" on public.mensajes;

create policy "Ver mensajes propios o foro de mis cursos"
on public.mensajes for select
to authenticated
using (
  remitente_id = (select auth.uid())
  or destinatario_id = (select auth.uid())
  or (
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
);

drop policy "Enviar mensajes segun rol o hilo existente" on public.mensajes;

create policy "Enviar mensajes directo o foro"
on public.mensajes for insert
to authenticated
with check (
  remitente_id = (select auth.uid())
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
        or existe_hilo_mensajes((select auth.uid()), destinatario_id)
      )
    )
    or
    (
      destinatario_id is null and curso_id is not null and (
        has_role((select auth.uid()), 'admin'::app_role)
        or exists (
          select 1 from docentes_cursos dc
          where dc.curso_id = curso_id and dc.docente_id = (select auth.uid())
        )
        or exists (
          select 1 from suscripciones s
          where s.curso_id = curso_id and s.usuario_id = (select auth.uid()) and s.estado = 'active'
        )
      )
    )
  )
);
