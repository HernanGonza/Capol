-- Modalidad de dictado, independiente de "estado" (que ya describe el ciclo
-- de vida de la edición: proximamente/activo/finalizado). "grabado" es un
-- curso on-demand: el alumno accede a todo el contenido cuando quiere, sin
-- el gating de fecha_desbloqueo que sí aplica a los cursos "en_vivo".
create type public.curso_modalidad as enum ('en_vivo', 'grabado');

alter table public.cursos
  add column modalidad public.curso_modalidad not null default 'en_vivo';

comment on column public.cursos.modalidad is 'Modalidad de dictado: "en_vivo" (cursada con fechas/cohorte) o "grabado" (acceso libre, sin gating de fecha_desbloqueo). Independiente de "estado".';
