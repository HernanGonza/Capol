-- Se agrega firma_url a lo que expone perfiles_publicos(): un alumno
-- necesita poder leer la firma del profesor de su curso para armar el
-- certificado del lado del cliente (RLS le bloquea leer la fila de
-- "perfiles" de otra persona directamente). Mismo criterio no-sensible que
-- nombre_completo/url_avatar.
--
-- Postgres no permite cambiar el tipo de retorno con CREATE OR REPLACE, así
-- que hay que dropear la función primero. Único caller actual: Messages.tsx
-- (desestructura id/nombre_completo/url_avatar — un 4to campo es aditivo).
drop function if exists public.perfiles_publicos(uuid[]);

create function public.perfiles_publicos(p_ids uuid[])
returns table(id uuid, nombre_completo text, url_avatar text, firma_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nombre_completo, p.url_avatar, p.firma_url
  from perfiles p
  where p.id = any(p_ids);
$$;

revoke all on function public.perfiles_publicos(uuid[]) from public;
grant execute on function public.perfiles_publicos(uuid[]) to authenticated;
revoke execute on function public.perfiles_publicos(uuid[]) from anon;
