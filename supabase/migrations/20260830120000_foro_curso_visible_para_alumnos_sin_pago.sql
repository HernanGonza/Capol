-- El foro del curso (mensajes grupales: destinatario_id null + curso_id) pasa
-- a ser visible y escribible para cualquier alumno que tenga una suscripción
-- a ese curso, SIN importar el estado del pago (active / pago_pendiente /
-- expired) ni la fecha de corte (fin_en).
--
-- Motivo: un alumno con la inscripción aprobada pero todavía sin pagar tiene
-- el CONTENIDO del curso bloqueado (eso no cambia: las policies de
-- "lecciones" / "ejercicios" siguen exigiendo suscripción active y vigente),
-- pero igual queremos que pueda entrar al foro para coordinar el pago,
-- preguntar dudas, etc.
--
-- Esto revierte parcialmente 20260825183614_restrict_unpaid_subscription_access,
-- pero SOLO para el foro. La mensajería directa (destinatario_id no nulo) no
-- se toca.

-- Helper único para no repetir la condición en las 4 policies que la usan.
-- SECURITY DEFINER para saltear la RLS de suscripciones/docentes_cursos y
-- evitar recursión de policies (mismo patrón que dentro_de_cooldown_mensajes,
-- existe_hilo_mensajes, etc.).
create or replace function public.puede_participar_foro_curso(p_curso_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    has_role((select auth.uid()), 'admin'::app_role)
    or exists (
      select 1 from public.docentes_cursos dc
      where dc.curso_id = p_curso_id
        and dc.docente_id = (select auth.uid())
    )
    or exists (
      -- Cualquier suscripción del alumno a este curso, sin filtrar por estado
      -- ni por fin_en: alcanza con estar inscripto.
      select 1 from public.suscripciones s
      where s.curso_id = p_curso_id
        and s.usuario_id = (select auth.uid())
    );
$$;

revoke all on function public.puede_participar_foro_curso(uuid) from public;
grant execute on function public.puede_participar_foro_curso(uuid) to authenticated;
revoke execute on function public.puede_participar_foro_curso(uuid) from anon;

-- 1) SELECT de mensajes: ver el hilo del foro.
drop policy if exists "Ver mensajes propios o foro de mis cursos" on public.mensajes;
create policy "Ver mensajes propios o foro de mis cursos"
on public.mensajes for select
to authenticated
using (
  remitente_id = (select auth.uid())
  or destinatario_id = (select auth.uid())
  or (
    destinatario_id is null
    and curso_id is not null
    and public.puede_participar_foro_curso(mensajes.curso_id)
  )
);

-- 2) INSERT de mensajes: escribir en el foro. La rama de mensajería directa
-- (destinatario_id not null) queda EXACTAMENTE igual que en
-- 20260825183614_restrict_unpaid_subscription_access.
drop policy if exists "Enviar mensajes directo o foro" on public.mensajes;
create policy "Enviar mensajes directo o foro"
on public.mensajes for insert
to authenticated
with check (
  remitente_id = (select auth.uid())
  and not exists (
    select 1 from public.mensajeria_bloqueados b
    where b.usuario_id = (select auth.uid())
  )
  and not dentro_de_cooldown_mensajes((select auth.uid()))
  and (
    (
      destinatario_id is not null
      and (
        has_role((select auth.uid()), 'admin'::app_role)
        or exists (
          select 1 from public.docentes_cursos dc
          join public.suscripciones s on s.curso_id = dc.curso_id
          where dc.docente_id = (select auth.uid())
            and s.usuario_id = mensajes.destinatario_id
            and s.estado = 'active'
        )
        or exists (
          select 1 from public.docentes_cursos dc
          join public.suscripciones s on s.curso_id = dc.curso_id
          where dc.docente_id = mensajes.destinatario_id
            and s.usuario_id = (select auth.uid())
            and s.estado = 'active'
        )
        or exists (
          select 1 from public.suscripciones s1
          join public.suscripciones s2 on s2.curso_id = s1.curso_id
          where s1.usuario_id = (select auth.uid())
            and s1.estado = 'active'
            and s2.usuario_id = mensajes.destinatario_id
            and s2.estado = 'active'
        )
        or existe_hilo_mensajes((select auth.uid()), destinatario_id)
      )
    )
    or (
      destinatario_id is null
      and curso_id is not null
      and public.puede_participar_foro_curso(mensajes.curso_id)
    )
  )
);

-- 3) SELECT de adjuntos del foro en storage.
drop policy if exists "Ver adjuntos de mensajes propios o del foro" on storage.objects;
create policy "Ver adjuntos de mensajes propios o del foro"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mensajes-adjuntos'
  and exists (
    select 1 from public.mensajes m
    where m.id::text = (storage.foldername(objects.name))[1]
      and (
        m.remitente_id = (select auth.uid())
        or m.destinatario_id = (select auth.uid())
        or (
          m.destinatario_id is null
          and m.curso_id is not null
          and public.puede_participar_foro_curso(m.curso_id)
        )
      )
  )
);

-- 4) Reportar un mensaje del foro que ahora se puede ver.
drop policy if exists "Reportar un mensaje que se puede ver" on public.mensajes_reportados;
create policy "Reportar un mensaje que se puede ver"
on public.mensajes_reportados for insert
to authenticated
with check (
  reportado_por = (select auth.uid())
  and exists (
    select 1 from public.mensajes m
    where m.id = mensajes_reportados.mensaje_id
      and (
        m.remitente_id = (select auth.uid())
        or m.destinatario_id = (select auth.uid())
        or (
          m.destinatario_id is null
          and m.curso_id is not null
          and public.puede_participar_foro_curso(m.curso_id)
        )
      )
  )
);
