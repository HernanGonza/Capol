-- Métricas de Acceso bajaba TODAS las filas de landing_visits (solo pais_code)
-- en cada carga para contarlas en el navegador. Esta función devuelve el
-- conteo ya agrupado por país (una fila por país, pais_code null = sin
-- detectar), solo para admin.

create or replace function public.visitas_por_pais()
 returns table (pais_code text, cantidad bigint)
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede ver las visitas';
  end if;

  return query
  select v.pais_code, count(*)::bigint
  from public.landing_visits v
  group by v.pais_code;
end;
$function$;

revoke execute on function public.visitas_por_pais() from public, anon;
grant execute on function public.visitas_por_pais() to authenticated;
