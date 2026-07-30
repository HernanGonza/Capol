-- Total de cuentas registradas en la plataforma (cualquier rol), para el
-- stat público de la Landing y las métricas del admin. A diferencia de
-- contar_alumnos_totales() (que filtra por rol = 'student'), este cuenta
-- todos los perfiles sin importar si compraron o se inscribieron a algo.
create or replace function public.contar_registrados_totales()
returns integer
language sql
stable security definer
set search_path to 'public'
as $$
  select count(*)::integer from public.perfiles;
$$;
