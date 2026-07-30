-- Configuración financiera: fila única (singleton) con los montos fijos de
-- la fórmula de reparto y el día de corte mensual único para toda la
-- plataforma. Es información sensible del negocio (cuánto se le paga al
-- profesor/plataforma), así que NO va en "configuracion_global" (esa tabla
-- es de lectura pública). Solo el admin puede leerla y editarla.
create table public.configuracion_financiera (
  id boolean primary key default true,
  costo_publicidad_ars numeric not null default 5000,
  costo_plataforma_ars numeric not null default 4500,
  dia_corte smallint not null default 25,
  actualizado_en timestamptz not null default now(),
  constraint configuracion_financiera_singleton check (id),
  constraint dia_corte_valido check (dia_corte between 1 and 28)
);

insert into public.configuracion_financiera (id) values (true);

alter table public.configuracion_financiera enable row level security;

grant select, update on public.configuracion_financiera to authenticated;

create policy "Solo admin ve y edita la configuracion financiera"
on public.configuracion_financiera for all
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));

-- Ledger de pagos: un registro INMUTABLE por cada pago efectivamente
-- cobrado (alta de suscripción nueva o renovación mensual). A diferencia de
-- "suscripciones" (que se pisa en cada renovación y solo refleja el estado
-- ACTUAL), esta tabla permite reportar por período histórico ("cuánto
-- entró en julio") y acumulados. Los costos se graban en el momento del
-- pago (snapshot), para que un cambio futuro en la configuración no altere
-- retroactivamente reportes de meses ya cerrados.
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  suscripcion_id uuid references public.suscripciones(id) on delete set null,
  monto numeric not null,
  costo_publicidad_ars numeric not null,
  costo_plataforma_ars numeric not null,
  pagado_en timestamptz not null default now()
);

create index idx_pagos_curso_id on public.pagos(curso_id);
create index idx_pagos_pagado_en on public.pagos(pagado_en);
create index idx_pagos_usuario_id on public.pagos(usuario_id);

alter table public.pagos enable row level security;

grant select, insert on public.pagos to authenticated;

create policy "Solo admin ve y carga pagos"
on public.pagos for all
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
