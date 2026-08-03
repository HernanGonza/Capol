-- Reemplaza el campo "dirección" del registro (no se usaba para nada) por
-- edad y ocupación, más útiles para conocer al alumnado. La columna
-- "direccion" se deja como está (no se borra, por si algún perfil viejo
-- tiene el dato cargado) — solo se deja de pedir en el formulario.
alter table public.perfiles add column edad integer;
alter table public.perfiles add column ocupacion text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
BEGIN
  INSERT INTO public.perfiles (
    id, nombre_completo, url_avatar, telefono, dni, direccion, localidad, provincia, pais, email, edad, ocupacion
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
    new.email,
    nullif(new.raw_user_meta_data->>'edad', '')::integer,
    new.raw_user_meta_data->>'ocupacion'
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
    email = EXCLUDED.email,
    edad = EXCLUDED.edad,
    ocupacion = EXCLUDED.ocupacion;

  -- Todo usuario nuevo es "student" por defecto (antes esto nunca se creaba).
  INSERT INTO public.roles_usuario (usuario_id, rol)
  VALUES (new.id, 'student')
  ON CONFLICT (usuario_id, rol) DO NOTHING;

  RETURN new;
END;
$$;
