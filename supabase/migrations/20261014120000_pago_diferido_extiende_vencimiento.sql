-- Registrar el pago de un alumno en vivo que estaba pago_diferido (o expired)
-- y ya tenía pagos previos no movía el vencimiento: la rama "else" de
-- registrar_pago_suscripcion lo pasa a active y el trigger
-- normalizar_suscripcion_en_vivo recalcula el período que contiene a HOY según
-- cursos.fecha_inicio, que es justo el período que ya había pagado.
--
-- Arreglo: después de reactivar, si el curso es en vivo y la suscripción ya
-- tenía pagos, se fija el vencimiento en
--   greatest(vencimiento recalculado, fecha_inicio + (pagos previos + 1) meses)
-- con un segundo update active -> active (que el trigger no toca).

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
  v_fecha_inicio date;
  v_pagos_previos integer;
  v_proxima_por_pagos timestamptz;
  v_costo_publicidad numeric;
  v_costo_plataforma numeric;
  v_monto numeric;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede registrar pagos';
  end if;

  select modalidad, fecha_inicio
    into v_modalidad, v_fecha_inicio
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

    -- Reactivación de un alumno en vivo que ya había pagado antes: el trigger
    -- le recalculó el período en curso (el ya pagado); se extiende al
    -- siguiente.
    if v_modalidad = 'en_vivo'::public.curso_modalidad
       and v_estado_actual in ('pago_diferido', 'expired')
       and v_fecha_inicio is not null then
      select count(*)
        into v_pagos_previos
      from public.pagos
      where suscripcion_id = v_suscripcion_id;

      if v_pagos_previos >= 1 then
        v_proxima_por_pagos := make_timestamptz(
          extract(year from (v_fecha_inicio + make_interval(months => v_pagos_previos + 1)))::integer,
          extract(month from (v_fecha_inicio + make_interval(months => v_pagos_previos + 1)))::integer,
          extract(day from (v_fecha_inicio + make_interval(months => v_pagos_previos + 1)))::integer,
          0, 0, 0,
          'America/Argentina/Buenos_Aires'
        );

        update public.suscripciones
        set proxima_fecha_pago = greatest(proxima_fecha_pago, v_proxima_por_pagos),
            fin_en = greatest(proxima_fecha_pago, v_proxima_por_pagos) - interval '1 second'
        where id = v_suscripcion_id;
      end if;
    end if;
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
