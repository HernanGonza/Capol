-- Supabase otorga EXECUTE por defecto a anon/authenticated en funciones nuevas
-- del schema public (default privileges), así que el "revoke ... from public"
-- de la migración anterior no alcanzaba: anon seguía teniendo el grant directo.
revoke execute on function public.existe_hilo_mensajes(uuid, uuid) from anon;
