-- "perfiles" solo deja ver la fila propia (o todas si sos admin) porque tiene
-- columnas sensibles (dni, telefono, direccion). Pero nombre y avatar SÍ se
-- necesitan mostrar de OTRAS personas en varios lugares (mensajes directos,
-- foro de curso, lista de alumnos del profesor, revisión de trabajos
-- finales) — lugares donde ya existe una razón legítima para ver con quién
-- se está interactuando. Esta función expone únicamente esas dos columnas
-- no sensibles para cualquier usuario autenticado, sin abrir el resto del
-- perfil.
create or replace function public.perfiles_publicos(p_ids uuid[])
returns table(id uuid, nombre_completo text, url_avatar text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nombre_completo, p.url_avatar
  from perfiles p
  where p.id = any(p_ids);
$$;

revoke all on function public.perfiles_publicos(uuid[]) from public;
grant execute on function public.perfiles_publicos(uuid[]) to authenticated;
