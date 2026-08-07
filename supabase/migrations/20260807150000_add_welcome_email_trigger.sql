-- Mail de bienvenida automático: cuando un usuario confirma su cuenta
-- (email_confirmed_at pasa de null a una fecha), este trigger dispara la
-- Edge Function "send-welcome-email" (ver
-- src/integrations/supabase/functions/send-welcome-email/index.ts) vía
-- pg_net. Es aparte del mail de confirmación (ese lo maneja Supabase Auth
-- directo, plantilla en supabase/templates/confirmation.html) — este es el
-- segundo mail, de bienvenida, que llega recién cuando ya confirmó.
--
-- net.http_post es asincrónico (encola el pedido y sigue), así que no
-- frena el login/confirmación del usuario. Además el "begin/exception"
-- de adentro asegura que un error acá (por ej. la función caída) nunca
-- rompa la confirmación real de la cuenta — en el peor caso, no llega el
-- mail de bienvenida, pero la cuenta se confirma igual.
create extension if not exists pg_net;

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
        body := jsonb_build_object('user_id', new.id)
      );
    exception when others then
      raise warning 'No se pudo disparar el mail de bienvenida para %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
after update on auth.users
for each row
execute function public.handle_email_confirmado();
