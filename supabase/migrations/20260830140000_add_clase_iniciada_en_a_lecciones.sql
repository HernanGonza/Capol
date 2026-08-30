-- Marca cuándo el profesor abrió la video llamada de una clase en vivo.
-- Los alumnos no pueden entrar a la sala hasta que esto esté seteado: así el
-- profesor entra SIEMPRE primero y queda como moderador de Jitsi (si entra un
-- alumno antes, Jitsi lo hace moderador a él).
-- Se limpia al terminar la clase (junto con fecha_fin_clase).
alter table public.lecciones
  add column if not exists clase_iniciada_en timestamptz;

comment on column public.lecciones.clase_iniciada_en is
  'Timestamp de cuando el profesor abrió la video llamada. NULL = la sala todavía no está activa y los alumnos no pueden entrar.';
