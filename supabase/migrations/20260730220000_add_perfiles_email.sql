-- El admin necesita poder identificar alumnos/profesores por mail (no solo
-- por nombre, que puede repetirse o faltar) en sus pantallas de gestión.
-- perfiles ya tiene RLS de "el propio usuario o el admin ven la fila
-- completa", así que alcanza con agregar la columna — no hace falta tocar
-- políticas ni exponer esto en perfiles_publicos() (que sigue siendo solo
-- nombre+avatar para las pantallas de alumno/profesor).
alter table public.perfiles add column email text;

update public.perfiles p
set email = u.email
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
  INSERT INTO public.perfiles (
    id, nombre_completo, url_avatar, telefono, dni, direccion, localidad, provincia, pais, email
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'nombre_completo',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'telefono',
    new.raw_user_meta_data->>'dni',
    new.raw_user_meta_data->>'direccion',
    new.raw_user_meta_data->>'localidad',
    new.raw_user_meta_data->>'provincia',
    COALESCE(new.raw_user_meta_data->>'pais', 'Argentina'),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    url_avatar = EXCLUDED.url_avatar,
    telefono = EXCLUDED.telefono,
    dni = EXCLUDED.dni,
    direccion = EXCLUDED.direccion,
    localidad = EXCLUDED.localidad,
    provincia = EXCLUDED.provincia,
    pais = EXCLUDED.pais,
    email = EXCLUDED.email;

  -- Todo usuario nuevo es "student" por defecto (antes esto nunca se creaba).
  INSERT INTO public.roles_usuario (usuario_id, rol)
  VALUES (new.id, 'student')
  ON CONFLICT (usuario_id, rol) DO NOTHING;

  RETURN new;
END;
$$;
