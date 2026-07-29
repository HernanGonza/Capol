alter table public.cursos
  add column fecha_inicio date,
  add column horarios text;

comment on column public.cursos.fecha_inicio is 'Fecha de inicio del curso (opcional) — se muestra en la tarjeta solo si está cargada.';
comment on column public.cursos.horarios is 'Texto libre con los horarios de cursada (ej: "Martes y Jueves de 21 a 22hs") — se muestra en la tarjeta solo si está cargado.';
