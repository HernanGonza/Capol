create type public.curso_estado as enum ('proximamente', 'activo');

alter table public.cursos
  add column estado public.curso_estado not null default 'activo';

comment on column public.cursos.estado is 'Estado visible del curso (badge): "proximamente" o "activo". Independiente de "publicado", que controla si aparece en la landing.';
