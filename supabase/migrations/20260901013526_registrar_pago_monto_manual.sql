-- Los cursos se cargan en USD y la cotización a ARS se define a mano por
-- curso (o cae a la fija global de 1500). Hasta ahora `registrar_pago_suscripcion`
-- exigía que el monto fuera EXACTAMENTE precio_usd × cotización: si el admin
-- había cobrado un número redondo que no coincidía al centavo con esa cuenta
-- (por ej. $45.000 cuando la cuenta daba $45.150), el pago se rechazaba. Peor
-- aún, si el curso no tenía `precio` en USD el mensaje era "El curso no tiene
-- un precio válido configurado", confuso cuando el precio sí estaba.
--
-- A partir de acá el monto se carga a mano: la función confía en `p_monto`
-- (el importe realmente recibido en ARS) y solo valida que sea > 0 y —para
-- cursos en vivo— que supere los costos de publicidad + plataforma. El aviso
-- de "esto no coincide con la cotización de mercado" vive en el front, como
-- confirmación, no como bloqueo.

create or replace function public.registrar_pago_suscripcion(
  p_usuario_id uuid,
  p_curso_id uuid,
  p_monto numeric,
  p_proveedor_pago text default null::text
)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suscripcion_id uuid;
  v_modalidad public.curso_modalidad;
  v_costo_publicidad numeric;
  v_costo_plataforma numeric;
  v_monto numeric;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede registrar pagos';
  end if;

  select modalidad
    into v_modalidad
  from public.cursos
  where id = p_curso_id;

  if not found then
    raise exception 'Curso inexistente';
  end if;

  v_monto := round(p_monto, 2);

  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero';
  end if;

  select costo_publicidad_ars, costo_plataforma_ars
    into v_costo_publicidad, v_costo_plataforma
  from public.configuracion_financiera
  where id = true;

  if v_modalidad = 'en_vivo'::public.curso_modalidad
     and v_monto <= coalesce(v_costo_publicidad, 5000) + coalesce(v_costo_plataforma, 4500) then
    raise exception 'El monto (% ARS) no supera los costos de publicidad y plataforma', v_monto;
  end if;

  select id into v_suscripcion_id
  from public.suscripciones
  where usuario_id = p_usuario_id
    and curso_id = p_curso_id
    and estado in ('active', 'pago_pendiente', 'expired', 'pago_diferido')
  order by creado_en desc
  limit 1
  for update;

  if v_suscripcion_id is null then
    insert into public.suscripciones (
      usuario_id, curso_id, nombre_plan, estado, price,
      proveedor_pago, inicio_en, proxima_fecha_pago, fin_en
    ) values (
      p_usuario_id,
      p_curso_id,
      case when v_modalidad = 'en_vivo'::public.curso_modalidad then 'Mensual' else 'Compra única' end,
      'active',
      v_monto,
      nullif(trim(p_proveedor_pago), ''),
      case when v_modalidad = 'grabado'::public.curso_modalidad then now() else null end,
      null,
      null
    )
    returning id into v_suscripcion_id;
  else
    update public.suscripciones
    set estado = 'active',
        price = v_monto,
        proveedor_pago = nullif(trim(p_proveedor_pago), ''),
        nombre_plan = case when v_modalidad = 'en_vivo'::public.curso_modalidad then 'Mensual' else 'Compra única' end,
        inicio_en = case when v_modalidad = 'grabado'::public.curso_modalidad then coalesce(inicio_en, now()) else inicio_en end,
        proxima_fecha_pago = case when v_modalidad = 'grabado'::public.curso_modalidad then null else proxima_fecha_pago end,
        fin_en = case when v_modalidad = 'grabado'::public.curso_modalidad then null else fin_en end,
        pago_diferido_hasta = null,
        nota_admin = null,
        suspendida_en = null
    where id = v_suscripcion_id;
  end if;

  insert into public.pagos (
    usuario_id, curso_id, suscripcion_id, monto,
    costo_publicidad_ars, costo_plataforma_ars
  ) values (
    p_usuario_id,
    p_curso_id,
    v_suscripcion_id,
    v_monto,
    coalesce(v_costo_publicidad, 5000),
    coalesce(v_costo_plataforma, 4500)
  );

  return v_suscripcion_id;
end;
$function$;

revoke execute on function public.registrar_pago_suscripcion(uuid, uuid, numeric, text)
  from public, anon;
grant execute on function public.registrar_pago_suscripcion(uuid, uuid, numeric, text)
  to authenticated, service_role;
