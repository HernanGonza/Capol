-- "Dar por saldado" un pago diferido también saca la suspensión manual, así no
-- hace falta un paso previo de "Sacar suspensión".

create or replace function public.condonar_pago_diferido(
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
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede dar por saldado un pago diferido';
  end if;

  select estado::text into v_estado
  from public.suscripciones
  where id = p_suscripcion_id
  for update;

  if not found then
    raise exception 'Suscripción inexistente';
  end if;

  if v_estado <> 'pago_diferido' then
    raise exception 'Solo se puede dar por saldada una suscripción en pago diferido';
  end if;

  update public.suscripciones
  set estado = 'active',
      acceso_permanente = true,
      deuda_condonada_en = now(),
      suspendida_en = null,
      fin_en = null,
      proxima_fecha_pago = null,
      pago_diferido_hasta = null,
      nota_admin = coalesce(nullif(trim(p_nota), ''), nota_admin)
  where id = p_suscripcion_id;

  return p_suscripcion_id;
end;
$function$;
