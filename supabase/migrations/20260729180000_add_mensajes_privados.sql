-- Bandeja de mensajes: admin <-> alumnos, profesor <-> alumnos de sus cursos.
-- Modelo plano (sin tabla de "conversaciones"): un hilo entre dos personas es
-- simplemente el conjunto de filas donde (remitente, destinatario) son ese
-- par en cualquier orden. curso_id es metadata opcional (desde qué curso se
-- originó el mensaje), no delimita el hilo.
create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  remitente_id uuid not null references public.perfiles(id) on delete cascade,
  destinatario_id uuid not null references public.perfiles(id) on delete cascade,
  curso_id uuid references public.cursos(id) on delete set null,
  contenido text not null,
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);

create index idx_mensajes_destinatario on public.mensajes(destinatario_id);
create index idx_mensajes_remitente on public.mensajes(remitente_id);
create index idx_mensajes_curso on public.mensajes(curso_id);
create index idx_mensajes_creado_en on public.mensajes(creado_en desc);

alter table public.mensajes enable row level security;

grant select, insert, update on public.mensajes to authenticated;

create policy "Ver mensajes propios"
on public.mensajes for select
to authenticated
using (remitente_id = (select auth.uid()) or destinatario_id = (select auth.uid()));

create policy "Marcar como leido el propio mensaje recibido"
on public.mensajes for update
to authenticated
using (destinatario_id = (select auth.uid()))
with check (destinatario_id = (select auth.uid()));

-- Puede enviar: el admin a cualquiera, un profesor a alumnos activos de sus
-- cursos, un alumno a los profesores de sus cursos activos, o cualquiera de
-- los dos lados de un hilo que ya existe (permite responder siempre).
create policy "Enviar mensajes segun rol o hilo existente"
on public.mensajes for insert
to authenticated
with check (
  remitente_id = (select auth.uid())
  and (
    has_role((select auth.uid()), 'admin'::app_role)
    or exists (
      select 1 from docentes_cursos dc
      join suscripciones s on s.curso_id = dc.curso_id
      where dc.docente_id = (select auth.uid())
        and s.usuario_id = destinatario_id
        and s.estado = 'active'
    )
    or exists (
      select 1 from docentes_cursos dc
      join suscripciones s on s.curso_id = dc.curso_id
      where dc.docente_id = destinatario_id
        and s.usuario_id = (select auth.uid())
        and s.estado = 'active'
    )
    or exists (
      select 1 from mensajes m
      where (m.remitente_id = (select auth.uid()) and m.destinatario_id = destinatario_id)
         or (m.remitente_id = destinatario_id and m.destinatario_id = (select auth.uid()))
    )
  )
);
