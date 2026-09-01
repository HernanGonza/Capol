-- Datos para separar, en el Panel de Control y en Métricas, a los alumnos
-- "cursando" (con al menos un curso sin terminar) de los "graduados" (todos
-- sus cursos con todas las clases completadas), tanto en total como por curso.
--
-- Devuelve una fila por (alumno, curso) para los alumnos con una suscripción
-- vigente (active / pago_pendiente / pago_diferido — mismo criterio que el
-- resto de las métricas), con cuántas clases tiene el curso y cuántas
-- completó ese alumno. El corte "graduado" se hace del lado del cliente:
-- total_clases > 0 y clases_completadas >= total_clases.
--
-- SECURITY DEFINER + chequeo de rol: solo un admin puede leer el progreso de
-- todos los alumnos (progreso_lecciones tiene RLS por alumno).

create or replace function public.progreso_alumnos_cursos()
returns table (
  usuario_id uuid,
  curso_id uuid,
  curso_titulo text,
  curso_modalidad public.curso_modalidad,
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
    -- Una fila por (alumno, curso): el estado más reciente de su suscripción.
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
