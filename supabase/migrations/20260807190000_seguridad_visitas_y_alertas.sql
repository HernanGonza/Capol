-- Monitoreo de seguridad: ampliamos "landing_visits" con más datos por
-- visita (antes solo guardaba país + fecha) y agregamos una tabla de
-- alertas para poder detectar y dejar registro de patrones raros (ráfagas
-- de visitas o de registros de cuentas nuevas en poco tiempo).
--
-- - visitor_id: UUID generado en el navegador y guardado en localStorage —
--   no identifica a la persona, pero permite distinguir "una sola visita
--   recargando la página muchas veces" de "muchos visitantes distintos".
-- - user_agent: para poder distinguir tráfico de navegador real de bots
--   (curl, scrapers, etc. suelen tener un user-agent característico o vacío).
-- - ip: la misma IP que ya se usaba para geolocalizar el país (viene de la
--   respuesta de ipwho.is), ahora también se guarda.
alter table public.landing_visits
  add column if not exists visitor_id uuid,
  add column if not exists user_agent text,
  add column if not exists ip text;

create index if not exists idx_landing_visits_visitor_id on public.landing_visits (visitor_id);
create index if not exists idx_landing_visits_visited_at on public.landing_visits (visited_at);

-- Historial de alertas de seguridad detectadas automáticamente (y a futuro,
-- cualquier otra que se quiera cargar a mano). No se borra nunca — se
-- marca "resuelta" cuando el admin ya la revisó.
create table public.alertas_seguridad (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, -- 'rafaga_visitas' | 'rafaga_registros'
  detalle text not null,
  datos jsonb,
  creado_en timestamptz not null default now(),
  resuelta boolean not null default false,
  resuelta_en timestamptz
);

alter table public.alertas_seguridad enable row level security;

create policy "Admins manage alertas_seguridad"
on public.alertas_seguridad for all
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
