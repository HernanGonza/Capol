-- Texto libre con la duración del curso (ej: "8 semanas") — mismo criterio
-- que "horarios": se muestra en la tarjeta solo si está cargada.
alter table public.cursos add column duracion text;
comment on column public.cursos.duracion is 'Texto libre con la duración del curso (ej: "8 semanas"). Se muestra en la tarjeta solo si está cargada.';
