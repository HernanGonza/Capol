-- Chequeo automático de seguridad, programado con pg_cron cada 10 minutos.
-- Busca dos patrones:
--   1. Ráfaga de visitas: mismo visitante (visitor_id) o mismo país no-AR
--      con 5+ cargas de la Landing en el mismo minuto (como la ráfaga de
--      Países Bajos que disparó todo esto).
--   2. Ráfaga de registros: 5+ cuentas nuevas creadas en el mismo minuto
--      (señal de un bot creando cuentas en masa).
-- Cada incidente puntual (mismo minuto + mismo visitante/país) se guarda
-- una sola vez en alertas_seguridad, aunque la ventana de 20 minutos lo
-- vuelva a detectar en corridas siguientes — y el mail se manda como
-- máximo una vez por hora por tipo de alerta, para no spamear si la
-- ráfaga sigue activa.
create extension if not exists pg_cron;

create or replace function public.detectar_anomalias_seguridad()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  datos_actual jsonb;
  ya_registrado boolean;
  ya_alertado_esta_hora boolean;
begin
  -- Ráfagas de visitas por visitante o por país (últimos 20 minutos, para
  -- no perderse ráfagas que caen justo en el borde de la corrida anterior).
  for r in (
    select visitor_id, pais_code, date_trunc('minute', visited_at) as minuto, count(*) as cantidad
    from public.landing_visits
    where visited_at > now() - interval '20 minutes'
      and (visitor_id is not null or (pais_code is not null and pais_code <> 'AR'))
    group by visitor_id, pais_code, date_trunc('minute', visited_at)
    having count(*) >= 5
  )
  loop
    datos_actual := jsonb_build_object('visitor_id', r.visitor_id, 'pais_code', r.pais_code, 'minuto', r.minuto, 'cantidad', r.cantidad);

    select exists(
      select 1 from public.alertas_seguridad where tipo = 'rafaga_visitas' and datos = datos_actual
    ) into ya_registrado;
    if ya_registrado then
      continue;
    end if;

    select exists(
      select 1 from public.alertas_seguridad
      where tipo = 'rafaga_visitas' and creado_en > now() - interval '1 hour'
    ) into ya_alertado_esta_hora;

    insert into public.alertas_seguridad (tipo, detalle, datos)
    values (
      'rafaga_visitas',
      format('%s visitas en 1 minuto (%s) — visitante %s, país %s',
        r.cantidad, to_char(r.minuto, 'DD/MM HH24:MI'), coalesce(r.visitor_id::text, 'sin identificar'), coalesce(r.pais_code, 'sin detectar')),
      datos_actual
    );

    if not ya_alertado_esta_hora then
      begin
        perform net.http_post(
          url := 'https://jpzicnrimbsqxjezehdf.supabase.co/functions/v1/send-security-alert',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'tipo', 'Ráfaga de visitas',
            'detalle', format('%s visitas en 1 minuto — visitante %s, país %s',
              r.cantidad, coalesce(r.visitor_id::text, 'sin identificar'), coalesce(r.pais_code, 'sin detectar')),
            'datos', datos_actual
          ),
          timeout_milliseconds := 15000
        );
      exception when others then
        raise warning 'No se pudo mandar la alerta de ráfaga de visitas: %', sqlerrm;
      end;
    end if;
  end loop;

  -- Ráfagas de registros de cuentas nuevas (últimos 20 minutos).
  for r in (
    select date_trunc('minute', creado_en) as minuto, count(*) as cantidad
    from public.perfiles
    where creado_en > now() - interval '20 minutes'
    group by date_trunc('minute', creado_en)
    having count(*) >= 5
  )
  loop
    datos_actual := jsonb_build_object('minuto', r.minuto, 'cantidad', r.cantidad);

    select exists(
      select 1 from public.alertas_seguridad where tipo = 'rafaga_registros' and datos = datos_actual
    ) into ya_registrado;
    if ya_registrado then
      continue;
    end if;

    select exists(
      select 1 from public.alertas_seguridad
      where tipo = 'rafaga_registros' and creado_en > now() - interval '1 hour'
    ) into ya_alertado_esta_hora;

    insert into public.alertas_seguridad (tipo, detalle, datos)
    values (
      'rafaga_registros',
      format('%s cuentas nuevas registradas en 1 minuto (%s)', r.cantidad, to_char(r.minuto, 'DD/MM HH24:MI')),
      datos_actual
    );

    if not ya_alertado_esta_hora then
      begin
        perform net.http_post(
          url := 'https://jpzicnrimbsqxjezehdf.supabase.co/functions/v1/send-security-alert',
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'tipo', 'Ráfaga de registros',
            'detalle', format('%s cuentas nuevas registradas en 1 minuto', r.cantidad),
            'datos', datos_actual
          ),
          timeout_milliseconds := 15000
        );
      exception when others then
        raise warning 'No se pudo mandar la alerta de ráfaga de registros: %', sqlerrm;
      end;
    end if;
  end loop;
end;
$$;

revoke execute on function public.detectar_anomalias_seguridad() from public;
revoke execute on function public.detectar_anomalias_seguridad() from anon;
revoke execute on function public.detectar_anomalias_seguridad() from authenticated;

select cron.schedule(
  'chequeo-seguridad',
  '*/10 * * * *',
  $$select public.detectar_anomalias_seguridad();$$
);
