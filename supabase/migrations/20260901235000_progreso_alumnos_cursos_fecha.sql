-- progreso_alumnos_cursos(): agregar la fecha de inicio y el estado del curso,
-- para que el Panel de Control pueda separar a los alumnos "cursando" (curso ya
-- en marcha) de los que todavía están "por empezar" (inscriptos a un curso en
-- vivo cuya fecha de inicio no llegó / estado 'proximamente').

drop function if exists public.progreso_alumnos_cursos();

create or replace function public.progreso_alumnos_cursos()
returns table (
  usuario_id uuid,
  curso_id uuid,
  curso_titulo text,
  curso_modalidad public.curso_modalidad,
  curso_estado public.curso_estado,
  curso_fecha_inicio date,
  estado_suscripcion text,
  total_clases integer,
  clases_completadas integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede ver el progreso de los alumnos';
  end if;

  return query
  with alumnos as (
    select ru.usuario_id
    from public.roles_usuario ru
    where ru.rol = 'student'::public.app_role
  ),
  subs as (
    select distinct on (s.usuario_id, s.curso_id)
      s.usuario_id, s.curso_id, s.estado
    from public.suscripciones s
    join alumnos a on a.usuario_id = s.usuario_id
    where s.estado in ('active', 'pago_pendiente', 'pago_diferido')
    order by s.usuario_id, s.curso_id, s.creado_en desc
  ),
  clases as (
    select l.curso_id, count(*)::integer as total
    from public.lecciones l
    group by l.curso_id
  ),
  completadas as (
    select pl.usuario_id, l.curso_id, count(*)::integer as hechas
    from public.progreso_lecciones pl
    join public.lecciones l on l.id = pl.leccion_id
    where pl.completado = true
    group by pl.usuario_id, l.curso_id
  )
  select
    subs.usuario_id,
    subs.curso_id,
    c.titulo,
    c.modalidad,
    c.estado,
    c.fecha_inicio,
    subs.estado,
    coalesce(clases.total, 0),
    coalesce(completadas.hechas, 0)
  from subs
  join public.cursos c on c.id = subs.curso_id
  left join clases on clases.curso_id = subs.curso_id
  left join completadas
    on completadas.usuario_id = subs.usuario_id
   and completadas.curso_id = subs.curso_id;
end;
$function$;

revoke execute on function public.progreso_alumnos_cursos() from public, anon;
grant execute on function public.progreso_alumnos_cursos() to authenticated, service_role;
