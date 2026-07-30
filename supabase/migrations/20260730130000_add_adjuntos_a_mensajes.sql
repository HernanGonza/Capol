-- Adjuntos en mensajes (directos o de foro). El path en storage se arma como
-- "<mensaje_id>/<nombre_archivo>" — el cliente genera el id ANTES de subir el
-- archivo, y lo usa como id explícito al insertar la fila del mensaje. Así la
-- policy de storage puede validar el acceso haciendo join contra "mensajes"
-- por ese mismo id, sin necesitar una tabla intermedia.
alter table public.mensajes
  add column adjunto_path text,
  add column adjunto_nombre text;

insert into storage.buckets (id, name, public)
values ('mensajes-adjuntos', 'mensajes-adjuntos', false)
on conflict (id) do nothing;

create policy "Subir adjuntos de mensajes"
on storage.objects for insert
to authenticated
with check (bucket_id = 'mensajes-adjuntos');

create policy "Ver adjuntos de mensajes propios o del foro"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mensajes-adjuntos' and exists (
    select 1 from public.mensajes m
    where m.id::text = (storage.foldername(objects.name))[1]
      and (
        m.remitente_id = (select auth.uid())
        or m.destinatario_id = (select auth.uid())
        or (
          m.destinatario_id is null and m.curso_id is not null and (
            has_role((select auth.uid()), 'admin'::app_role)
            or exists (
              select 1 from docentes_cursos dc
              where dc.curso_id = m.curso_id and dc.docente_id = (select auth.uid())
            )
            or exists (
              select 1 from suscripciones s
              where s.curso_id = m.curso_id and s.usuario_id = (select auth.uid()) and s.estado = 'active'
            )
          )
        )
      )
  )
);
