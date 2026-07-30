-- Fecha en la que se dio por terminada esta edición del curso (para poder
-- ordenar/mostrar la lista de "Terminados" por fecha).
alter table public.cursos add column fecha_fin date;
