-- Corrección de diseño: el cobro de plataforma/profesor no es un monto
-- global por mes, es por CURSO — el admin necesita saber puntualmente si
-- ya le pagó al profesor de "n8n" el período de julio, sin importar el
-- resto de los cursos. La tabla anterior (un solo registro por mes, sin
-- curso) todavía no tenía filas cargadas, así que se recrea directamente
-- en vez de migrar datos.
drop table if exists public.cortes_plataforma;

create table public.cortes_plataforma (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  periodo_mes text not null, -- formato "yyyy-MM", el mes elegido en el filtro
  periodo_inicio date not null,
  periodo_fin date not null,
  monto_plataforma numeric not null default 0,
  monto_profesor numeric not null default 0, -- 0 en cursos grabados (no hay profesor que pagar)
  pagado_en timestamptz not null default now(),
  notas text,
  unique (curso_id, periodo_mes)
);

alter table public.cortes_plataforma enable row level security;

create policy "Admins manage cortes_plataforma"
on public.cortes_plataforma for all
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
