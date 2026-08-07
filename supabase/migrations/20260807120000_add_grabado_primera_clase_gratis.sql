-- Los cursos grabados necesitan mostrar la primera clase gratis, como
-- muestra, para que un alumno logueado (sin haber comprado el curso
-- todavía) pueda ver de qué se trata antes de pagar. Antes de esto,
-- "lecciones" solo era visible con una suscripción activa — era imposible
-- ver ni la primera clase sin comprar.
create policy "Authenticated users preview first lesson of recorded courses"
on public.lecciones for select
to authenticated
using (
  orden = (
    select min(l2.orden) from public.lecciones l2 where l2.curso_id = lecciones.curso_id
  )
  and exists (
    select 1 from public.cursos c
    where c.id = lecciones.curso_id
      and c.modalidad = 'grabado'
      and c.publicado = true
  )
);

-- Para poder mostrar el temario completo (solo títulos, sin contenido ni
-- video) de un curso grabado a cualquier alumno logueado que todavía no lo
-- compró — así ve qué incluye el curso antes de pagar, sin que la API
-- filtre el material pago de las clases bloqueadas (RLS es a nivel de fila,
-- no de columna, así que dar SELECT sobre toda la tabla expondría el
-- contenido completo de todas las clases).
create or replace function public.obtener_temario_curso(curso_id_param uuid)
returns table (id uuid, titulo text, orden integer)
language sql
stable security definer
set search_path to 'public'
as $$
  select l.id, l.titulo, l.orden
  from lecciones l
  join cursos c on c.id = l.curso_id
  where l.curso_id = curso_id_param
    and c.modalidad = 'grabado'
    and c.publicado = true
  order by l.orden;
$$;

-- Por defecto Postgres le da EXECUTE a PUBLIC (que en Supabase incluye al rol
-- "anon") cuando se crea una función — hay que sacárselo explícitamente para
-- que solo la puedan llamar usuarios logueados.
revoke execute on function public.obtener_temario_curso(uuid) from public;
revoke execute on function public.obtener_temario_curso(uuid) from anon;
grant execute on function public.obtener_temario_curso(uuid) to authenticated;
