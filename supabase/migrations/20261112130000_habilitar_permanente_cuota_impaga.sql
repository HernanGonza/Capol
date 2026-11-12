-- Alumnos en vivo que ya pagaron alguna cuota y quedaron en 'pago_pendiente'
-- porque venció fin_en (cuota impaga / "curso suspendido") no tenían forma de
-- volver a tener acceso sin registrar un pago nuevo. habilitar_acceso_permanente
-- ahora también acepta una suscripción 'pago_pendiente' con al menos un pago
-- real registrado: la pasa a 'active' con acceso permanente.

create or replace function public.habilitar_acceso_permanente(
  p_suscripcion_id uuid,
  p_nota text default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_estado text;
  v_pagos integer;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede habilitar el acceso permanente';
  end if;

  select estado::text into v_estado
  from public.suscripciones
  where id = p_suscripcion_id
  for update;

  if not found then
    raise exception 'Suscripción inexistente';
  end if;

  select count(*) into v_pagos from public.pagos where suscripcion_id = p_suscripcion_id;

  if not (v_estado = 'active' or (v_estado = 'pago_pendiente' and v_pagos > 0)) then
    raise exception 'Solo se puede habilitar acceso permanente a una suscripción al día o con cuota impaga que ya haya pagado algo';
  end if;

  update public.suscripciones
  set estado = 'active',
      acceso_permanente = true,
      fin_en = null,
      proxima_fecha_pago = null,
      pago_diferido_hasta = null,
      nota_admin = coalesce(nullif(trim(p_nota), ''), nota_admin)
  where id = p_suscripcion_id;

  return p_suscripcion_id;
end;
$function$;
