-- Los cursos se publican en USD, pero el ledger financiero y sus costos
-- fijos están expresados en ARS. Un pago válido debe coincidir exactamente
-- con el precio visible en Argentina: precio USD por la cotización propia
-- del curso, o por la cotización fija global de 1500 cuando no se cargó una.
--
-- El CHECK queda NOT VALID para conservar el pago histórico de prueba de $0;
-- aun así se aplica a toda fila nueva.
alter table public.pagos
  add constraint pagos_monto_positivo
  check (monto > 0) not valid;

revoke insert on public.pagos from authenticated;

create or replace function public.registrar_pago_suscripcion(
  p_usuario_id uuid,
  p_curso_id uuid,
  p_monto numeric,
  p_proveedor_pago text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_suscripcion_id uuid;
  v_modalidad public.curso_modalidad;
  v_precio_usd numeric;
  v_cotizacion_ars numeric;
  v_monto_esperado numeric;
  v_costo_publicidad numeric;
  v_costo_plataforma numeric;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede registrar pagos';
  end if;

  select modalidad, precio, coalesce(nullif(cotizacion_ars, 0), 1500)
    into v_modalidad, v_precio_usd, v_cotizacion_ars
  from public.cursos
  where id = p_curso_id;

  if not found then
    raise exception 'Curso inexistente';
  end if;

  if v_precio_usd is null or v_precio_usd <= 0 then
    raise exception 'El curso no tiene un precio válido configurado';
  end if;

  v_monto_esperado := round(v_precio_usd * v_cotizacion_ars, 2);

  if p_monto is null or round(p_monto, 2) <> v_monto_esperado then
    raise exception 'El monto debe ser exactamente % ARS', v_monto_esperado;
  end if;

  select costo_publicidad_ars, costo_plataforma_ars
    into v_costo_publicidad, v_costo_plataforma
  from public.configuracion_financiera
  where id = true;

  if v_modalidad = 'en_vivo'::public.curso_modalidad
     and v_monto_esperado <= coalesce(v_costo_publicidad, 5000) + coalesce(v_costo_plataforma, 4500) then
    raise exception 'El precio del curso debe superar los costos de publicidad y plataforma';
  end if;

  select id into v_suscripcion_id
  from public.suscripciones
  where usuario_id = p_usuario_id
    and curso_id = p_curso_id
    and estado in ('active', 'pago_pendiente', 'expired')
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
      v_monto_esperado,
      nullif(trim(p_proveedor_pago), ''),
      case when v_modalidad = 'grabado'::public.curso_modalidad then now() else null end,
      null,
      null
    )
    returning id into v_suscripcion_id;
  else
    update public.suscripciones
    set estado = 'active',
        price = v_monto_esperado,
        proveedor_pago = nullif(trim(p_proveedor_pago), ''),
        nombre_plan = case when v_modalidad = 'en_vivo'::public.curso_modalidad then 'Mensual' else 'Compra única' end,
        inicio_en = case when v_modalidad = 'grabado'::public.curso_modalidad then coalesce(inicio_en, now()) else inicio_en end,
        proxima_fecha_pago = case when v_modalidad = 'grabado'::public.curso_modalidad then null else proxima_fecha_pago end,
        fin_en = case when v_modalidad = 'grabado'::public.curso_modalidad then null else fin_en end
    where id = v_suscripcion_id;
  end if;

  insert into public.pagos (
    usuario_id, curso_id, suscripcion_id, monto,
    costo_publicidad_ars, costo_plataforma_ars
  ) values (
    p_usuario_id,
    p_curso_id,
    v_suscripcion_id,
    v_monto_esperado,
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
