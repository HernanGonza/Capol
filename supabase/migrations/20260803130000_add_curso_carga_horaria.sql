-- Carga horaria total del curso en horas (ej: 32), para mostrar en el
-- certificado ("completó satisfactoriamente 32 horas de curso"). Columna
-- independiente de "duracion" (que es texto libre tipo "8 semanas").
alter table public.cursos add column carga_horaria integer;
