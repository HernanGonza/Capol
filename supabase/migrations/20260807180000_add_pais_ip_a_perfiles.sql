-- País detectado por IP al momento del registro, además del país que el
-- alumno tipea a mano en el formulario ("pais"). Sirve para contrastar los
-- dos — si alguien dice ser de un país pero se conectó desde otro, queda
-- a la vista.
alter table public.perfiles add column if not exists pais_ip text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  INSERT INTO public.perfiles (
    id, nombre_completo, url_avatar, telefono, dni, direccion, localidad, provincia, pais, pais_ip, email, edad, ocupacion
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
    new.raw_user_meta_data->>'pais_ip',
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
    pais_ip = EXCLUDED.pais_ip,
    email = EXCLUDED.email,
    edad = EXCLUDED.edad,
    ocupacion = EXCLUDED.ocupacion;

  -- Todo usuario nuevo es "student" por defecto (antes esto nunca se creaba).
  INSERT INTO public.roles_usuario (usuario_id, rol)
  VALUES (new.id, 'student')
  ON CONFLICT (usuario_id, rol) DO NOTHING;

  RETURN new;
END;
$function$;
