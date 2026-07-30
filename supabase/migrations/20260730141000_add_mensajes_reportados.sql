create table public.mensajes_reportados (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references public.mensajes(id) on delete cascade,
  reportado_por uuid not null references public.perfiles(id) on delete cascade,
  motivo text,
  creado_en timestamptz not null default now(),
  resuelto boolean not null default false
);

create index idx_mensajes_reportados_mensaje_id on public.mensajes_reportados(mensaje_id);
create index idx_mensajes_reportados_resuelto on public.mensajes_reportados(resuelto);

alter table public.mensajes_reportados enable row level security;

grant select, insert, update on public.mensajes_reportados to authenticated;

-- Solo se puede reportar un mensaje que ya se podía ver (mismo criterio que
-- la policy de SELECT de "mensajes": remitente, destinatario, o miembro del
-- curso si es de foro).
create policy "Reportar un mensaje que se puede ver"
on public.mensajes_reportados for insert
to authenticated
with check (
  reportado_por = (select auth.uid())
  and exists (
    select 1 from mensajes m
    where m.id = mensaje_id
      and (
        m.remitente_id = (select auth.uid())
        or m.destinatario_id = (select auth.uid())
        or (
          m.destinatario_id is null and m.curso_id is not null and (
            has_role((select auth.uid()), 'admin'::app_role)
            or exists (select 1 from docentes_cursos dc where dc.curso_id = m.curso_id and dc.docente_id = (select auth.uid()))
            or exists (select 1 from suscripciones s where s.curso_id = m.curso_id and s.usuario_id = (select auth.uid()) and s.estado = 'active')
          )
        )
      )
  )
);

create policy "Admin ve todos los reportes"
on public.mensajes_reportados for select
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role));

create policy "Reportante ve sus propios reportes"
on public.mensajes_reportados for select
to authenticated
using (reportado_por = (select auth.uid()));

create policy "Admin resuelve reportes"
on public.mensajes_reportados for update
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));
