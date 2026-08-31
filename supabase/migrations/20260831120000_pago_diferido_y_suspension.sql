-- Pago diferido + suspensión de suscripciones (solo cursos en vivo).
--
-- Nuevo estado de suscripción: 'pago_diferido'
--   - Da acceso al contenido igual que 'active'.
--   - NO entra en el ciclo mensual del curso en vivo (fin_en queda NULL, no hay
--     corte automático). proxima_fecha_pago = fecha comprometida por el alumno.
--   - Al pasar esa fecha NO se bloquea solo: solo genera una alarma para el admin.
--
-- Columna 'suspendida_en': si != NULL, el acceso queda bloqueado sin importar el
-- estado. Es reversible (se vuelve a poner en NULL). Sirve para "apretar" a un
-- alumno cortándole el curso.

-- 1. Columnas nuevas (nullable, sin reescritura de filas existentes).
alter table public.suscripciones
  add column if not exists pago_diferido_hasta timestamptz,
  add column if not exists suspendida_en timestamptz,
  add column if not exists nota_admin text;

comment on column public.suscripciones.pago_diferido_hasta is
  'Fecha que el alumno se comprometió a pagar (estado pago_diferido). Fuente de la alarma para el admin.';
comment on column public.suscripciones.suspendida_en is
  'Si != NULL, el acceso al curso está bloqueado sin importar el estado. Reversible.';
comment on column public.suscripciones.nota_admin is
  'Motivo del pago diferido o de la suspensión (texto libre, opcional).';

-- 2. Trigger de normalización: saltear el ciclo mensual para pago_diferido.
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

  -- Cursos grabados no tienen ciclo mensual.
  if v_modalidad is distinct from 'en_vivo'::curso_modalidad then
    return new;
  end if;

  -- Pago diferido: acceso concedido a mano, sin ciclo mensual y sin corte
  -- automático. La fecha comprometida se refleja en proxima_fecha_pago para que
  -- se vea en el panel; fin_en queda NULL para que la RLS no corte el acceso.
  if new.estado = 'pago_diferido' then
    new.inicio_en := coalesce(new.inicio_en, now());
    new.fin_en := null;
    new.proxima_fecha_pago := new.pago_diferido_hasta;
    return new;
  end if;

  -- Una suscripción pendiente no tiene un período pagado todavía.
  if new.estado = 'pago_pendiente' then
    new.inicio_en := null;
    new.proxima_fecha_pago := null;
    new.fin_en := null;
    return new;
  end if;

  -- Si el curso en vivo no tiene fecha de inicio, conservamos el comportamiento
  -- anterior para no romper suscripciones históricas de cursos sin fecha.
  if new.estado <> 'active' or v_fecha_inicio is null then
    return new;
  end if;

  v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  -- El primer período empieza siempre en la fecha de inicio del curso.
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

  -- El acceso termina un segundo antes de comenzar el siguiente período.
  new.fin_en := new.proxima_fecha_pago - interval '1 second';

  return new;
end;
$function$;

-- 3. El trigger tiene que dispararse también cuando cambia pago_diferido_hasta.
drop trigger if exists trg_normalizar_suscripcion_en_vivo on public.suscripciones;
create trigger trg_normalizar_suscripcion_en_vivo
  before insert or update of estado, curso_id, inicio_en, fin_en, proxima_fecha_pago, pago_diferido_hasta
  on public.suscripciones
  for each row execute function public.normalizar_suscripcion_en_vivo();

-- 4. La inscripción se crea también con pago_diferido (el alumno figura inscripto).
create or replace function public.sync_inscripcion_desde_suscripcion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.estado in ('active', 'pago_diferido') then
    insert into public.inscripciones (usuario_id, curso_id)
    values (new.usuario_id, new.curso_id)
    on conflict (usuario_id, curso_id) do nothing;
  end if;
  return new;
end;
$function$;

-- 5. RLS de contenido: 'pago_diferido' da acceso; 'suspendida_en' lo corta.
drop policy if exists "Subscribed students view lessons" on public.lecciones;
create policy "Subscribed students view lessons"
  on public.lecciones
  for select
  to authenticated
  using (
    (exists (
      select 1
      from public.suscripciones s
      where s.curso_id = lecciones.curso_id
        and s.usuario_id = (select auth.uid())
        and s.suspendida_en is null
        and (
          (s.estado = 'active' and (s.fin_en > now() or s.fin_en is null))
          or s.estado = 'pago_diferido'
        )
    ))
    or has_role((select auth.uid()), 'admin'::app_role)
  );

drop policy if exists "Subscribed students view exercises" on public.ejercicios;
create policy "Subscribed students view exercises"
  on public.ejercicios
  for select
  to authenticated
  using (
    (exists (
      select 1
      from public.lecciones l
        join public.suscripciones s on s.curso_id = l.curso_id
      where l.id = ejercicios.leccion_id
        and s.usuario_id = (select auth.uid())
        and s.suspendida_en is null
        and (
          (s.estado = 'active' and (s.fin_en > now() or s.fin_en is null))
          or s.estado = 'pago_diferido'
        )
    ))
    or (exists (
      select 1
      from public.lecciones l
        join public.docentes_cursos dc on dc.curso_id = l.curso_id
      where l.id = ejercicios.leccion_id
        and dc.docente_id = (select auth.uid())
    ))
    or has_role((select auth.uid()), 'admin'::app_role)
  );

-- 6. RPC: habilitar pago diferido (crea o reutiliza la suscripción). Solo admin.
create or replace function public.habilitar_pago_diferido(
  p_usuario_id uuid,
  p_curso_id uuid,
  p_fecha_limite date,
  p_nota text default null
)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suscripcion_id uuid;
  v_modalidad public.curso_modalidad;
  v_hoy date;
  v_limite timestamptz;
begin
  if not public.has_role((select auth.uid()), 'admin'::public.app_role) then
    raise exception 'Solo un administrador puede habilitar pagos diferidos';
  end if;

  select modalidad into v_modalidad
  from public.cursos
  where id = p_curso_id;

  if not found then
    raise exception 'Curso inexistente';
  end if;

  if v_modalidad is distinct from 'en_vivo'::public.curso_modalidad then
    raise exception 'El pago diferido solo aplica a cursos en vivo';
  end if;

  v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  if p_fecha_limite is null or p_fecha_limite < v_hoy then
    raise exception 'La fecha comprometida no puede ser anterior a hoy';
  end if;

  -- Fin del día AR de la fecha comprometida.
  v_limite := make_timestamptz(
    extract(year from p_fecha_limite)::integer,
    extract(month from p_fecha_limite)::integer,
    extract(day from p_fecha_limite)::integer,
    23, 59, 59,
    'America/Argentina/Buenos_Aires'
  );

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
      usuario_id, curso_id, nombre_plan, estado,
      pago_diferido_hasta, nota_admin, suspendida_en
    ) values (
      p_usuario_id, p_curso_id, 'Pago diferido', 'pago_diferido',
      v_limite, nullif(trim(p_nota), ''), null
    )
    returning id into v_suscripcion_id;
  else
    update public.suscripciones
    set estado = 'pago_diferido',
        pago_diferido_hasta = v_limite,
        nota_admin = nullif(trim(p_nota), ''),
        suspendida_en = null
    where id = v_suscripcion_id;
  end if;

  return v_suscripcion_id;
end;
$function$;

revoke all on function public.habilitar_pago_diferido(uuid, uuid, date, text) from public, anon;
grant execute on function public.habilitar_pago_diferido(uuid, uuid, date, text) to authenticated;

-- 7. Registrar el pago real reutiliza la fila diferida y limpia los campos.
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
    v_monto_esperado,
    coalesce(v_costo_publicidad, 5000),
    coalesce(v_costo_plataforma, 4500)
  );

  return v_suscripcion_id;
end;
$function$;
