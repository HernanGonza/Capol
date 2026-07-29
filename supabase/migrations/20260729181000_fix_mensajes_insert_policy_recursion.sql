-- La policy de INSERT de "mensajes" tenía una subconsulta que volvía a leer la
-- propia tabla "mensajes" (para permitir responder un hilo existente). Esa
-- sub-lectura dispara de nuevo la RLS de "mensajes", generando
-- "infinite recursion detected in policy for relation mensajes". Se soluciona
-- moviendo ese chequeo a una función SECURITY DEFINER (mismo patrón que
-- has_role()), que corre con privilegios del dueño y no vuelve a pasar por RLS.

create or replace function public.existe_hilo_mensajes(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mensajes m
    where (m.remitente_id = user_a and m.destinatario_id = user_b)
       or (m.remitente_id = user_b and m.destinatario_id = user_a)
  );
$$;

revoke all on function public.existe_hilo_mensajes(uuid, uuid) from public;
grant execute on function public.existe_hilo_mensajes(uuid, uuid) to authenticated;

drop policy "Enviar mensajes segun rol o hilo existente" on public.mensajes;

create policy "Enviar mensajes segun rol o hilo existente"
on public.mensajes for insert
to authenticated
with check (
  remitente_id = (select auth.uid())
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
);
