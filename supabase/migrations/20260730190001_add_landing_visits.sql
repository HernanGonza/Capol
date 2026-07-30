create table public.landing_visits (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now()
);

alter table public.landing_visits enable row level security;

-- Cualquier visitante (logueado o no) dispara un registro de visita al
-- entrar a la Landing.
create policy "cualquiera puede registrar una visita"
on public.landing_visits for insert
to anon, authenticated
with check (true);

-- Solo el admin puede leer el conteo de visitas.
create policy "admin puede leer las visitas"
on public.landing_visits for select
to authenticated
using (public.has_role((select auth.uid()), 'admin'));
