-- BUG: la policy "Authenticated users preview first lesson of recorded
-- courses" comparaba lecciones.orden contra un
-- "select min(orden) from lecciones where curso_id = ..." sobre la MISMA
-- tabla que está protegiendo. Postgres necesita re-evaluar la RLS de
-- "lecciones" para resolver ese subquery, lo que vuelve a disparar la misma
-- policy → recursión infinita (error 42P17). Esto rompía CUALQUIER lectura
-- de "lecciones" para usuarios autenticados, no solo la de cursos grabados
-- (por eso un profesor dejó de poder ver la cantidad de clases de un curso
-- en vivo que tiene asignado).
--
-- Fix: mover el cálculo del "primer orden" a una función SECURITY DEFINER.
-- Al ejecutarse con los privilegios del dueño de la función (no del usuario
-- que hace la consulta), no queda sujeta a la RLS de "lecciones" y corta la
-- recursión.
create or replace function public.primer_orden_leccion(curso_id_param uuid)
returns integer
language sql
stable security definer
set search_path to 'public'
as $$
  select min(orden) from public.lecciones where curso_id = curso_id_param;
$$;

revoke execute on function public.primer_orden_leccion(uuid) from public;
revoke execute on function public.primer_orden_leccion(uuid) from anon;
grant execute on function public.primer_orden_leccion(uuid) to authenticated;

drop policy "Authenticated users preview first lesson of recorded courses" on public.lecciones;

create policy "Authenticated users preview first lesson of recorded courses"
on public.lecciones for select
to authenticated
using (
  orden = public.primer_orden_leccion(curso_id)
  and exists (
    select 1 from public.cursos c
    where c.id = lecciones.curso_id
      and c.modalidad = 'grabado'
      and c.publicado = true
  )
);
