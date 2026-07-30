-- Marca de "hasta cuándo leyó el foro de este curso" por usuario, para poder
-- mostrar un indicador de actividad nueva sin tener que trackear "leído" por
-- mensaje (que no tiene sentido en un mensaje grupal).
create table public.foro_ultima_lectura (
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  leido_hasta timestamptz not null default now(),
  primary key (usuario_id, curso_id)
);

alter table public.foro_ultima_lectura enable row level security;

grant select, insert, update on public.foro_ultima_lectura to authenticated;

create policy "Cada usuario gestiona su propia marca de lectura"
on public.foro_ultima_lectura for all
to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));
