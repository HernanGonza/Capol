-- pg_net le da 5 segundos por default a la llamada a la Edge Function, y a
-- veces no alcanza (arranque en frío de la función + login SMTP + envío
-- del mail). Lo subimos a 15 segundos para que no se corte de más.
create or replace function public.handle_email_confirmado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    begin
      perform net.http_post(
        url := 'https://jpzicnrimbsqxjezehdf.supabase.co/functions/v1/send-welcome-email',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('user_id', new.id),
        timeout_milliseconds := 15000
      );
    exception when others then
      raise warning 'No se pudo disparar el mail de bienvenida para %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;
