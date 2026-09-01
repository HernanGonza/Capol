-- Notificaciones automáticas al alumno (mail + aviso en la bandeja) para:
--   1. Solicitud de inscripción aceptada.
--   2. Acceso a un curso habilitado (pago registrado al día, o pago diferido).
--
-- El mail lo manda la Edge Function "send-account-notification" (mismo formato
-- que los mails de Supabase). El aviso de bandeja lo inserta _notificar_alumno
-- con remitente NULL + es_sistema = true (ver migración 20260901020146).
--
-- Todo va envuelto en begin/exception: si falla el mail o el insert, se
-- registra un warning pero nunca rompe la operación real (aprobar la
-- solicitud / registrar el pago).

create extension if not exists pg_net;

create or replace function public._notificar_alumno(
  p_tipo text,
  p_usuario_id uuid,
  p_curso_id uuid,
  p_contenido text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  begin
    insert into public.mensajes (remitente_id, destinatario_id, curso_id, contenido, es_sistema)
    values (null, p_usuario_id, p_curso_id, p_contenido, true);
  exception when others then
    raise warning '_notificar_alumno mensaje (% / %): %', p_tipo, p_usuario_id, sqlerrm;
  end;

  begin
    perform net.http_post(
      url := 'https://jpzicnrimbsqxjezehdf.supabase.co/functions/v1/send-account-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('tipo', p_tipo, 'usuario_id', p_usuario_id, 'curso_id', p_curso_id),
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning '_notificar_alumno mail (% / %): %', p_tipo, p_usuario_id, sqlerrm;
  end;
end;
$function$;

-- Suscripción habilitada: SOLO cuando entra en un estado con acceso desde uno
-- sin acceso (o se crea ya con acceso). No re-notifica en renovaciones
-- mensuales (active -> active).
create or replace function public.notificar_suscripcion_habilitada()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_titulo text;
  v_tipo text;
  v_contenido text;
  v_fecha text;
begin
  if new.estado not in ('active', 'pago_diferido') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.estado in ('active', 'pago_diferido') then
    return new;
  end if;

  select titulo into v_titulo from public.cursos where id = new.curso_id;
  v_titulo := coalesce(v_titulo, 'tu curso');

  if new.estado = 'pago_diferido' then
    v_tipo := 'suscripcion_diferida';
    v_fecha := to_char(new.pago_diferido_hasta at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY');
    v_contenido := 'Te habilitamos el acceso al curso ' || v_titulo || ' con pago diferido. Ya podes entrar a las clases.'
      || case
           when new.pago_diferido_hasta is not null
             then ' Recorda completar el pago antes del ' || v_fecha || '.'
           else ''
         end;
  else
    v_tipo := 'suscripcion_habilitada';
    v_contenido := 'Registramos tu pago del curso ' || v_titulo || '. Tu acceso ya esta activo: entra cuando quieras desde Mis Cursos.';
  end if;

  perform public._notificar_alumno(v_tipo, new.usuario_id, new.curso_id, v_contenido);
  return new;
end;
$function$;

drop trigger if exists trg_notificar_suscripcion_habilitada on public.suscripciones;
create trigger trg_notificar_suscripcion_habilitada
  after insert or update of estado on public.suscripciones
  for each row execute function public.notificar_suscripcion_habilitada();

-- Solicitud aprobada: extendemos el trigger que ya creaba la inscripción.
create or replace function public.handle_solicitud_aprobada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_titulo text;
begin
  if new.estado = 'aprobada' and old.estado is distinct from 'aprobada' then
    insert into public.inscripciones (usuario_id, curso_id, inscripto_en)
    values (new.usuario_id, new.curso_id, now())
    on conflict (usuario_id, curso_id) do nothing;

    select titulo into v_titulo from public.cursos where id = new.curso_id;

    perform public._notificar_alumno(
      'solicitud_aprobada',
      new.usuario_id,
      new.curso_id,
      'Tu solicitud de inscripcion al curso ' || coalesce(v_titulo, 'tu curso') ||
      ' fue aceptada. Nos vamos a poner en contacto para coordinar el pago.'
    );
  end if;
  return new;
end;
$function$;
