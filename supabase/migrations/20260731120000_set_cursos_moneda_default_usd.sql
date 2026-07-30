-- Los cursos ahora se cargan siempre en USD (se convierte a la moneda del
-- alumno al mostrarse, con la cotización del día). Ajustamos el default
-- para nuevas filas; no tocamos los cursos existentes.
alter table public.cursos alter column moneda set default 'USD';
