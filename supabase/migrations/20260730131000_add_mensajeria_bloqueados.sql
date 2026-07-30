-- Baneo puntual de mensajería: no desactiva la cuenta ni las suscripciones
-- (eso ya existe vía "perfiles.activo"), solo le impide a ese usuario
-- enviar mensajes directos o postear en foros. Tabla aparte (en vez de una
-- columna en "perfiles") para no tocar la policy "Users update own profile"
-- (evitaríamos que alguien se auto-desbanee).
create table public.mensajeria_bloqueados (
  usuario_id uuid primary key references public.perfiles(id) on delete cascade,
  bloqueado_por uuid references public.perfiles(id) on delete set null,
  motivo text,
  creado_en timestamptz not null default now()
);

alter table public.mensajeria_bloqueados enable row level security;

grant select, insert, delete on public.mensajeria_bloqueados to authenticated;

create policy "Admin gestiona bloqueos de mensajeria"
on public.mensajeria_bloqueados for all
to authenticated
using (has_role((select auth.uid()), 'admin'::app_role))
with check (has_role((select auth.uid()), 'admin'::app_role));

create policy "Usuario ve su propio estado de bloqueo"
on public.mensajeria_bloqueados for select
to authenticated
using (usuario_id = (select auth.uid()));

-- Un usuario bloqueado no puede insertar NINGÚN mensaje (ni directo ni de
-- foro), sin importar el resto de las condiciones.
drop policy "Enviar mensajes directo o foro" on public.mensajes;

create policy "Enviar mensajes directo o foro"
on public.mensajes for insert
to authenticated
with check (
  remitente_id = (select auth.uid())
  and not exists (
    select 1 from mensajeria_bloqueados b where b.usuario_id = (select auth.uid())
  )
  and (
    (
      destinatario_id is not null
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
        or existe_hilo_mensajes((select auth.uid()), destinatario_id)
      )
    )
    or
    (
      destinatario_id is null and curso_id is not null and (
        has_role((select auth.uid()), 'admin'::app_role)
        or exists (
          select 1 from docentes_cursos dc
          where dc.curso_id = curso_id and dc.docente_id = (select auth.uid())
        )
        or exists (
          select 1 from suscripciones s
          where s.curso_id = curso_id and s.usuario_id = (select auth.uid()) and s.estado = 'active'
        )
      )
    )
  )
);
