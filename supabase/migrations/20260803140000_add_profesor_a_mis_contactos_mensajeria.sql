-- Faltaba la rama "profesor" en mis_contactos_mensajeria(): un profesor
-- tiene que poder iniciar conversación con los alumnos inscriptos en SUS
-- cursos (docentes_cursos), no solo verlos si el alumno le escribe primero.
-- El insert de mensajes directos ya lo permitía (ver policy "Enviar mensajes
-- directo o foro"), lo que faltaba era la forma de listarlos en el picker de
-- "Nuevo Mensaje" del lado del profesor.
create or replace function public.mis_contactos_mensajeria()
returns table(id uuid, nombre_completo text, url_avatar text, rol text, curso_titulo text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (p.id) p.id, p.nombre_completo, p.url_avatar, contactos.rol, c.titulo
  from (
    select s2.usuario_id as contacto_id, 'compañero' as rol, s1.curso_id
    from suscripciones s1
    join suscripciones s2 on s2.curso_id = s1.curso_id and s2.usuario_id <> s1.usuario_id
    where s1.usuario_id = (select auth.uid()) and s1.estado = 'active' and s2.estado = 'active'
    union
    select dc.docente_id as contacto_id, 'profesor' as rol, dc.curso_id
    from docentes_cursos dc
    join suscripciones s on s.curso_id = dc.curso_id
    where s.usuario_id = (select auth.uid()) and s.estado = 'active'
    union
    select s.usuario_id as contacto_id, 'alumno' as rol, s.curso_id
    from docentes_cursos dc
    join suscripciones s on s.curso_id = dc.curso_id
    where dc.docente_id = (select auth.uid()) and s.estado = 'active'
  ) contactos
  join perfiles p on p.id = contactos.contacto_id
  join cursos c on c.id = contactos.curso_id
  order by p.id, contactos.rol;
$$;

revoke all on function public.mis_contactos_mensajeria() from public;
grant execute on function public.mis_contactos_mensajeria() to authenticated;
revoke execute on function public.mis_contactos_mensajeria() from anon;
