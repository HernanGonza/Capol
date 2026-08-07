-- Registro de los cobros mensuales del costo de plataforma (lo que la
-- escuela le paga a Hernán, dueño de la plataforma, en cada corte
-- mensual). Antes no existía ningún registro persistente de esto — el
-- panel de Finanzas solo calculaba "cuánto correspondería" en caliente a
-- partir de "pagos", sin ninguna forma de marcar un período como ya
-- cobrado. Este registro es aparte, un período que ya se pagó queda
-- siempre visible (nunca se borra), solo cambia a "pagado".
create table public.cortes_plataforma (
  id uuid primary key default gen_random_uuid(),
  periodo_mes text not null unique, -- formato "yyyy-MM", el mes que se eligió en el filtro
  periodo_inicio date not null,
  periodo_fin date not null,
  monto numeric not null,
  pagado_en timestamptz not null default now(),
  notas text
);

alter table public.cortes_plataforma enable row level security;

create policy "Admins manage cortes_plataforma"
on public.cortes_plataforma for all
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
