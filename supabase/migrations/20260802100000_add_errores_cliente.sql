-- Registro de errores de render no controlados (React ErrorBoundary), para
-- poder ver el stack real la próxima vez que le pase a un usuario en vez de
-- depender de que alguien nos mande una captura de pantalla. Puede dispararse
-- antes de loguearse (ej: mientras alguien se está registrando), por eso el
-- insert queda abierto a anon además de authenticated, y usuario_id es
-- nullable.
create table public.errores_cliente (
  id uuid primary key default gen_random_uuid(),
  mensaje text not null,
  stack text,
  component_stack text,
  url text,
  user_agent text,
  usuario_id uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);

create index idx_errores_cliente_creado_en on public.errores_cliente(creado_en desc);

alter table public.errores_cliente enable row level security;

grant insert on public.errores_cliente to anon, authenticated;
grant select on public.errores_cliente to authenticated;

create policy "Cualquiera puede reportar un error de cliente"
on public.errores_cliente for insert
to anon, authenticated
with check (true);

create policy "Solo admin puede ver los errores de cliente"
on public.errores_cliente for select
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role));
