-- Permitir a un admin ELIMINAR (borrado físico) suscripciones y solicitudes.
--
-- Caso de uso: un alumno hace una solicitud a un curso por error, el admin se la
-- aprueba (queda una suscripción en pago_pendiente) y después el alumno pide el
-- curso que realmente quería. Hay que poder borrar el rastro del curso equivocado
-- para que no ensucie los números de inscriptos.
--
-- Guardas:
--   - Solo admin.
--   - Nunca se borra algo que tenga pagos registrados (eso implicaría perder
--     historial de plata). Para esos casos hay que borrar antes el pago a mano.

create or replace function public.eliminar_suscripcion(p_suscripcion_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_usuario_id uuid;
  v_curso_id uuid;
  v_pagos integer;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede eliminar suscripciones';
  end if;

  select usuario_id, curso_id
    into v_usuario_id, v_curso_id
  from public.suscripciones
  where id = p_suscripcion_id;

  if not found then
    raise exception 'La suscripción no existe';
  end if;

  select count(*)
    into v_pagos
  from public.pagos
  where usuario_id = v_usuario_id and curso_id = v_curso_id;

  if v_pagos > 0 then
    raise exception 'Esta suscripción tiene % pago(s) registrado(s). Borrá primero el historial de pagos.', v_pagos;
  end if;

  -- Borra todo el rastro de este alumno en este curso: la inscripción, las
  -- solicitudes (aprobadas / rechazadas / pendientes) y la suscripción.
  delete from public.inscripciones
  where usuario_id = v_usuario_id and curso_id = v_curso_id;

  delete from public.solicitudes_inscripcion
  where usuario_id = v_usuario_id and curso_id = v_curso_id;

  delete from public.suscripciones
  where id = p_suscripcion_id;
end;
$function$;

revoke all on function public.eliminar_suscripcion(uuid) from public, anon;
grant execute on function public.eliminar_suscripcion(uuid) to authenticated;


create or replace function public.eliminar_solicitud(
  p_solicitud_id uuid,
  p_borrar_suscripcion boolean default false
)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_usuario_id uuid;
  v_curso_id uuid;
  v_pagos integer;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede eliminar solicitudes';
  end if;

  select usuario_id, curso_id
    into v_usuario_id, v_curso_id
  from public.solicitudes_inscripcion
  where id = p_solicitud_id;

  if not found then
    raise exception 'La solicitud no existe';
  end if;

  delete from public.solicitudes_inscripcion
  where id = p_solicitud_id;

  if p_borrar_suscripcion then
    select count(*)
      into v_pagos
    from public.pagos
    where usuario_id = v_usuario_id and curso_id = v_curso_id;

    if v_pagos > 0 then
      raise exception 'Este alumno tiene pagos registrados en este curso. La solicitud se borró, pero la suscripción no: borrá primero el historial de pagos.';
    end if;

    delete from public.inscripciones
    where usuario_id = v_usuario_id and curso_id = v_curso_id;

    delete from public.suscripciones
    where usuario_id = v_usuario_id and curso_id = v_curso_id;
  end if;
end;
$function$;

revoke all on function public.eliminar_solicitud(uuid, boolean) from public, anon;
grant execute on function public.eliminar_solicitud(uuid, boolean) to authenticated;
