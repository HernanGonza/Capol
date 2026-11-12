-- Acceso permanente: alumnos que ya pagaron TODO el curso (todas las cuotas)
-- no deben perder el acceso cuando termina el mes pagado.
--
-- Hasta ahora el acceso en vivo dependía de suscripciones.fin_en (un mes por
-- pago). Se agrega la marca acceso_permanente: con ella la suscripción queda
-- active con fin_en = NULL (la RLS de lecciones/ejercicios ya trata fin_en NULL
-- como "sin vencimiento") y ningún trigger ni RPC le vuelve a calcular fechas.
-- La suspensión manual (suspendida_en) sigue pudiendo cortarle el acceso.

alter table public.suscripciones
  add column if not exists acceso_permanente boolean not null default false;

alter table public.suscripciones
  add column if not exists deuda_condonada_en timestamptz;

comment on column public.suscripciones.deuda_condonada_en is
  'Si != NULL, la suscripción era pago_diferido y se dio por saldada sin registrar pago (el curso terminó). Tiene acceso permanente pero NO cuenta como "pagó" en las métricas.';

comment on column public.suscripciones.acceso_permanente is
  'Si es true, el alumno tiene acceso al curso para siempre (pagó todo): fin_en queda NULL y las fechas no se recalculan. suspendida_en lo sigue pudiendo cortar.';

-- 1. Trigger de normalización: no recalcula fechas de suscripciones permanentes.
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
  if new.acceso_permanente and new.estado = 'active' then
    new.fin_en := null;
    new.proxima_fecha_pago := null;
    return new;
  end if;

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

drop trigger if exists trg_normalizar_suscripcion_en_vivo on public.suscripciones;
create trigger trg_normalizar_suscripcion_en_vivo
  before insert or update of estado, curso_id, inicio_en, fin_en, proxima_fecha_pago, pago_diferido_hasta, acceso_permanente
  on public.suscripciones
  for each row execute function public.normalizar_suscripcion_en_vivo();

-- 2. Al cargar la fecha de inicio de un curso, no tocar las permanentes.
create or replace function public.recalcular_suscripciones_al_cargar_fecha_inicio()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_hoy date;
  v_inicio date;
  v_proximo date;
  v_meses integer;
  v_candidato date;
begin
  if new.modalidad is distinct from 'en_vivo'::curso_modalidad
     or old.fecha_inicio is not null
     or new.fecha_inicio is null then
    return new;
  end if;

  v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  if v_hoy <= new.fecha_inicio then
    v_inicio := new.fecha_inicio;
  else
    v_meses := (
      extract(year from age(v_hoy, new.fecha_inicio))::integer * 12
      + extract(month from age(v_hoy, new.fecha_inicio))::integer
    );

    v_candidato := (new.fecha_inicio + make_interval(months => v_meses))::date;
    if v_candidato > v_hoy then
      v_meses := v_meses - 1;
    end if;

    v_inicio := (new.fecha_inicio + make_interval(months => greatest(v_meses, 0)))::date;
  end if;

  v_proximo := (v_inicio + make_interval(months => 1))::date;

  update public.suscripciones
  set
    inicio_en = make_timestamptz(
      extract(year from v_inicio)::integer,
      extract(month from v_inicio)::integer,
      extract(day from v_inicio)::integer,
      0, 0, 0, 'America/Argentina/Buenos_Aires'
    ),
    proxima_fecha_pago = make_timestamptz(
      extract(year from v_proximo)::integer,
      extract(month from v_proximo)::integer,
      extract(day from v_proximo)::integer,
      0, 0, 0, 'America/Argentina/Buenos_Aires'
    ),
    fin_en = make_timestamptz(
      extract(year from v_proximo)::integer,
      extract(month from v_proximo)::integer,
      extract(day from v_proximo)::integer,
      0, 0, 0, 'America/Argentina/Buenos_Aires'
    ) - interval '1 second'
  where curso_id = new.id
    and estado = 'active'
    and not acceso_permanente;

  return new;
end;
$function$;

-- 3. RPC: habilitar acceso permanente a una suscripción al día. Solo admin.
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

  if v_estado <> 'active' then
    raise exception 'Solo se puede habilitar acceso permanente a una suscripción al día (registrá el pago primero)';
  end if;

  update public.suscripciones
  set acceso_permanente = true,
      fin_en = null,
      proxima_fecha_pago = null,
      pago_diferido_hasta = null,
      nota_admin = coalesce(nullif(trim(p_nota), ''), nota_admin)
  where id = p_suscripcion_id;

  return p_suscripcion_id;
end;
$function$;

revoke all on function public.habilitar_acceso_permanente(uuid, text) from public, anon;
grant execute on function public.habilitar_acceso_permanente(uuid, text) to authenticated;

-- 4. registrar_pago_suscripcion: un pago sobre una suscripción permanente se
-- registra pero no mueve fechas.
create or replace function public.registrar_pago_suscripcion(p_usuario_id uuid, p_curso_id uuid, p_monto numeric, p_proveedor_pago text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suscripcion_id uuid;
  v_estado_actual text;
  v_permanente boolean;
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

  select id, estado::text, proxima_fecha_pago, acceso_permanente
    into v_suscripcion_id, v_estado_actual, v_proxima_actual, v_permanente
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

  elsif coalesce(v_permanente, false) and v_estado_actual = 'active' then
    -- Acceso permanente: el pago queda registrado pero no se toca ninguna fecha.
    update public.suscripciones
    set price = v_monto,
        proveedor_pago = nullif(trim(p_proveedor_pago), ''),
        deuda_condonada_en = null,
        suspendida_en = null
    where id = v_suscripcion_id;

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


-- 5. Quitar el acceso permanente: la suscripción vuelve al ciclo mensual, con
-- el período que contiene a hoy según cursos.fecha_inicio (si el curso no
-- tiene fecha de inicio, queda sin vencimiento como estaba).
create or replace function public.quitar_acceso_permanente(
  p_suscripcion_id uuid,
  p_nota text default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_curso_id uuid;
  v_permanente boolean;
  v_condonada timestamptz;
  v_fecha_inicio date;
  v_hoy date;
  v_inicio date;
  v_proximo date;
  v_meses integer;
  v_candidato date;
  v_proxima timestamptz;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede quitar el acceso permanente';
  end if;

  select curso_id, acceso_permanente, deuda_condonada_en
    into v_curso_id, v_permanente, v_condonada
  from public.suscripciones
  where id = p_suscripcion_id
  for update;

  if not found then
    raise exception 'Suscripción inexistente';
  end if;

  if not v_permanente then
    raise exception 'La suscripción no tiene acceso permanente';
  end if;

  select fecha_inicio into v_fecha_inicio from public.cursos where id = v_curso_id;

  if v_fecha_inicio is not null then
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
    v_proxima := make_timestamptz(
      extract(year from v_proximo)::integer,
      extract(month from v_proximo)::integer,
      extract(day from v_proximo)::integer,
      0, 0, 0, 'America/Argentina/Buenos_Aires'
    );
  end if;

  -- Una deuda condonada nunca pagó: vuelve a pago_pendiente (sin acceso hasta
  -- que se registre un pago real). Una suscripción que sí pagó vuelve al ciclo.
  if v_condonada is not null then
    update public.suscripciones
    set acceso_permanente = false,
        deuda_condonada_en = null,
        estado = 'pago_pendiente',
        nota_admin = coalesce(nullif(trim(p_nota), ''), nota_admin)
    where id = p_suscripcion_id;
  else
    update public.suscripciones
    set acceso_permanente = false,
        proxima_fecha_pago = v_proxima,
        fin_en = v_proxima - interval '1 second',
        nota_admin = coalesce(nullif(trim(p_nota), ''), nota_admin)
    where id = p_suscripcion_id;
  end if;

  return p_suscripcion_id;
end;
$function$;

revoke all on function public.quitar_acceso_permanente(uuid, text) from public, anon;
grant execute on function public.quitar_acceso_permanente(uuid, text) to authenticated;

-- 6. Dar por saldado un pago diferido SIN registrar un pago (el curso terminó y
-- no hay nada más que cobrar). No toca la tabla pagos, así que no mueve
-- ingresos. El alumno queda con acceso permanente y marcado como condonado,
-- para que las métricas no lo cuenten como "pagó".
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
      fin_en = null,
      proxima_fecha_pago = null,
      pago_diferido_hasta = null,
      nota_admin = coalesce(nullif(trim(p_nota), ''), nota_admin)
  where id = p_suscripcion_id;

  return p_suscripcion_id;
end;
$function$;

revoke all on function public.condonar_pago_diferido(uuid, text) from public, anon;
grant execute on function public.condonar_pago_diferido(uuid, text) to authenticated;
