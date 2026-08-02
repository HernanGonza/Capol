-- Edición de mensajes propios (directos o de foro), con ventana de 15
-- minutos desde la creación. Mismo patrón que eliminar_mensaje_propio:
-- función SECURITY DEFINER en vez de ampliar la policy de UPDATE, para que
-- solo se pueda tocar "contenido"/"editado" del propio mensaje y nada más
-- (ni fijado, ni leido, ni adjuntos, ni mensajes ajenos).
alter table public.mensajes
  add column editado boolean not null default false;

create or replace function public.editar_mensaje_propio(p_mensaje_id uuid, p_contenido text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contenido text := trim(p_contenido);
begin
  if v_contenido is null or v_contenido = '' then
    raise exception 'El mensaje no puede quedar vacío';
  end if;

  update mensajes
  set contenido = v_contenido, editado = true
  where id = p_mensaje_id
    and remitente_id = auth.uid()
    and eliminado = false
    and creado_en > now() - interval '15 minutes';

  if not found then
    if exists (
      select 1 from mensajes
      where id = p_mensaje_id and remitente_id = auth.uid() and eliminado = false
    ) then
      raise exception 'Ya pasaron los 15 minutos para editar este mensaje';
    else
      raise exception 'No autorizado o mensaje inexistente';
    end if;
  end if;
end;
$$;

revoke all on function public.editar_mensaje_propio(uuid, text) from public;
grant execute on function public.editar_mensaje_propio(uuid, text) to authenticated;
