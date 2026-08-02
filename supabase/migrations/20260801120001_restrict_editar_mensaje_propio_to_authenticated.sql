-- "revoke ... from public" no le saca el permiso a "anon": ese rol recibe
-- EXECUTE por privilegios por defecto al crear la función, aparte de PUBLIC
-- (mismo problema ya resuelto para eliminar_mensaje_propio/fijar_mensaje_foro
-- en 20260730144000_restrict_new_message_functions_to_authenticated.sql).
revoke execute on function public.editar_mensaje_propio(uuid, text) from anon;
