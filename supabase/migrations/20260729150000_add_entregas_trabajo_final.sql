create table public.entregas_trabajo_final (
  id uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null check (tipo in ('archivo','link')),
  url text not null,
  nombre_archivo text,
  creado_en timestamptz not null default now(),
  unique (leccion_id, usuario_id)
);

alter table public.entregas_trabajo_final enable row level security;

grant select, insert, update on public.entregas_trabajo_final to authenticated;

create policy "Los alumnos ven su propia entrega"
on public.entregas_trabajo_final for select
to authenticated
using (usuario_id = auth.uid());

create policy "Los alumnos crean su propia entrega"
on public.entregas_trabajo_final for insert
to authenticated
with check (usuario_id = auth.uid());

create policy "Los alumnos actualizan su propia entrega"
on public.entregas_trabajo_final for update
to authenticated
using (usuario_id = auth.uid())
with check (usuario_id = auth.uid());

create policy "Admins ven todas las entregas"
on public.entregas_trabajo_final for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Profesores ven entregas de sus cursos"
on public.entregas_trabajo_final for select
to authenticated
using (
  exists (
    select 1 from public.lecciones l
    join public.docentes_cursos dc on dc.curso_id = l.curso_id
    where l.id = entregas_trabajo_final.leccion_id
      and dc.docente_id = auth.uid()
  )
);

-- Bucket privado para los archivos de trabajos finales (no public: solo el
-- dueño del archivo o staff pueden verlo, vía URLs firmadas con expiración).
insert into storage.buckets (id, name, public)
values ('trabajos-finales', 'trabajos-finales', false)
on conflict (id) do nothing;

create policy "Los alumnos suben su propio trabajo final"
on storage.objects for insert
to authenticated
with check (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Los alumnos actualizan su propio trabajo final"
on storage.objects for update
to authenticated
using (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Los alumnos ven su propio trabajo final"
on storage.objects for select
to authenticated
using (bucket_id = 'trabajos-finales' and (storage.foldername(name))[1] = auth.uid()::text);
