-- Borrado (soft-delete) y fijado de mensajes, más un cooldown anti-spam.
alter table public.mensajes
  add column eliminado boolean not null default false,
  add column fijado boolean not null default false;

-- Borrar el propio mensaje: función en vez de una policy de UPDATE amplia,
-- para que solo se pueda tocar "eliminado"/"contenido"/adjunto, nunca otra
-- fila ni otros campos.
create or replace function public.eliminar_mensaje_propio(p_mensaje_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update mensajes
  set eliminado = true, contenido = '', adjunto_path = null, adjunto_nombre = null
  where id = p_mensaje_id and remitente_id = auth.uid();

  if not found then
    raise exception 'No autorizado o mensaje inexistente';
  end if;
end;
$$;

revoke all on function public.eliminar_mensaje_propio(uuid) from public;
grant execute on function public.eliminar_mensaje_propio(uuid) to authenticated;

-- Fijar/desfijar un mensaje de foro: solo admin o el profesor asignado a ese
-- curso. Función (no policy de UPDATE) para no abrir la puerta a que un
-- profesor edite contenido ajeno del foro, solo el flag "fijado".
create or replace function public.fijar_mensaje_foro(p_mensaje_id uuid, p_fijar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curso_id uuid;
begin
  select curso_id into v_curso_id from mensajes where id = p_mensaje_id and destinatario_id is null;
  if v_curso_id is null then
    raise exception 'Mensaje de foro no encontrado';
  end if;

  if not (
    has_role(auth.uid(), 'admin'::app_role)
    or exists (select 1 from docentes_cursos dc where dc.curso_id = v_curso_id and dc.docente_id = auth.uid())
  ) then
    raise exception 'No autorizado';
  end if;

  update mensajes set fijado = p_fijar where id = p_mensaje_id;
end;
$$;

revoke all on function public.fijar_mensaje_foro(uuid, boolean) from public;
grant execute on function public.fijar_mensaje_foro(uuid, boolean) to authenticated;

-- Cooldown anti-spam: función SECURITY DEFINER (no una subconsulta directa en
-- la policy) para no repetir el "infinite recursion detected in policy" que
-- ya pasó antes con el chequeo de hilo existente.
create or replace function public.dentro_de_cooldown_mensajes(p_remitente uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.mensajes m
    where m.remitente_id = p_remitente
      and m.creado_en > (now() - interval '5 seconds')
  );
$$;

revoke all on function public.dentro_de_cooldown_mensajes(uuid) from public;
grant execute on function public.dentro_de_cooldown_mensajes(uuid) to authenticated;

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
