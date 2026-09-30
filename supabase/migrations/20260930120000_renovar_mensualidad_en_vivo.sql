-- "Registrar mensualidad" sobre una suscripción en vivo que ya está active
-- no corría la fecha: el RPC dejaba proxima_fecha_pago como estaba y el
-- trigger normalizar_suscripcion_en_vivo la volvía a calcular sobre el
-- período actual (o no hacía nada si el curso no tiene fecha_inicio).
-- Resultado: el pago quedaba en public.pagos pero el vencimiento no se movía.
--
-- Arreglo:
-- 1. El trigger ya no recalcula fechas en un update active -> active del
--    mismo curso (es una renovación, las fechas vienen explícitas).
-- 2. El RPC, cuando la suscripción en vivo ya está active, suma un mes a
--    proxima_fecha_pago (y fin_en = proxima - 1s).

create or replace function public.normalizar_suscripcion_en_vivo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_modalidad curso_modalidad;
  v_fecha_inicio date;
  v_hoy date;
  v_inicio date;
  v_proximo date;
  v_meses integer;
  v_candidato date;
begin
  select modalidad, fecha_inicio
    into v_modalidad, v_fecha_inicio
  from public.cursos
  where id = new.curso_id;

  if v_modalidad is distinct from 'en_vivo'::curso_modalidad then
    return new;
  end if;

  if new.estado = 'pago_diferido' then
    new.inicio_en := coalesce(new.inicio_en, now());
    new.fin_en := null;
    new.proxima_fecha_pago := new.pago_diferido_hasta;
    return new;
  end if;

  if new.estado = 'pago_pendiente' then
    new.inicio_en := null;
    new.proxima_fecha_pago := null;
    new.fin_en := null;
    return new;
  end if;

  -- Renovación de mensualidad: ya estaba active en el mismo curso, las
  -- fechas las define quien actualiza (registrar_pago_suscripcion).
  if tg_op = 'UPDATE'
     and old.estado = 'active'
     and new.estado = 'active'
     and new.curso_id = old.curso_id then
    return new;
  end if;

  if new.estado <> 'active' or v_fecha_inicio is null then
    return new;
  end if;

  v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  if v_hoy <= v_fecha_inicio then
    v_inicio := v_fecha_inicio;
  else
    v_meses := (
      extract(year from age(v_hoy, v_fecha_inicio))::integer * 12
      + extract(month from age(v_hoy, v_fecha_inicio))::integer
    );

    v_candidato := (v_fecha_inicio + make_interval(months => v_meses))::date;
    if v_candidato > v_hoy then
      v_meses := v_meses - 1;
    end if;

    v_inicio := (v_fecha_inicio + make_interval(months => greatest(v_meses, 0)))::date;
  end if;

  v_proximo := (v_inicio + make_interval(months => 1))::date;

  new.inicio_en := make_timestamptz(
    extract(year from v_inicio)::integer,
    extract(month from v_inicio)::integer,
    extract(day from v_inicio)::integer,
    0, 0, 0,
    'America/Argentina/Buenos_Aires'
  );

  new.proxima_fecha_pago := make_timestamptz(
    extract(year from v_proximo)::integer,
    extract(month from v_proximo)::integer,
    extract(day from v_proximo)::integer,
    0, 0, 0,
    'America/Argentina/Buenos_Aires'
  );

  new.fin_en := new.proxima_fecha_pago - interval '1 second';

  return new;
end;
$function$;

create or replace function public.registrar_pago_suscripcion(p_usuario_id uuid, p_curso_id uuid, p_monto numeric, p_proveedor_pago text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suscripcion_id uuid;
  v_estado_actual text;
  v_proxima_actual timestamptz;
  v_nueva_proxima timestamptz;
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

  select id, estado::text, proxima_fecha_pago
    into v_suscripcion_id, v_estado_actual, v_proxima_actual
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

  elsif v_modalidad = 'en_vivo'::public.curso_modalidad and v_estado_actual = 'active' then
    -- Renovación: suma un mes al vencimiento actual. Si no tenía fecha,
    -- el mes arranca hoy.
    v_nueva_proxima := coalesce(
      v_proxima_actual,
      make_timestamptz(
        extract(year from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer,
        extract(month from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer,
        extract(day from (now() at time zone 'America/Argentina/Buenos_Aires'))::integer,
        0, 0, 0,
        'America/Argentina/Buenos_Aires'
      )
    ) + interval '1 month';

    update public.suscripciones
    set price = v_monto,
        proveedor_pago = nullif(trim(p_proveedor_pago), ''),
        nombre_plan = 'Mensual',
        inicio_en = coalesce(inicio_en, now()),
        proxima_fecha_pago = v_nueva_proxima,
        fin_en = v_nueva_proxima - interval '1 second',
        pago_diferido_hasta = null,
        nota_admin = null,
        suspendida_en = null
    where id = v_suscripcion_id;

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
