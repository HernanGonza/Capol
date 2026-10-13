-- Cuando a un curso en vivo se le carga la fecha de inicio DESPUÉS de que ya
-- hay alumnos con pago registrado, esas suscripciones active quedaban con las
-- fechas viejas: el trigger normalizar_suscripcion_en_vivo solo calcula al
-- pasar a active, y en un update active -> active no toca nada.
--
-- Este trigger, al pasar cursos.fecha_inicio de NULL a una fecha en un curso
-- en vivo, recalcula inicio_en / proxima_fecha_pago / fin_en de las
-- suscripciones active de ese curso con la misma regla del trigger de
-- suscripciones. Solo se dispara desde NULL: si el curso ya tenía fecha y se
-- cambia, no se pisan los vencimientos (pueden tener renovaciones sumadas).
-- pago_diferido y pago_pendiente no se tocan.

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
    and estado = 'active';

  return new;
end;
$function$;

drop trigger if exists trg_recalcular_suscripciones_fecha_inicio on public.cursos;
create trigger trg_recalcular_suscripciones_fecha_inicio
  after update of fecha_inicio on public.cursos
  for each row execute function public.recalcular_suscripciones_al_cargar_fecha_inicio();
