-- Tercer estado de curso: "finalizado" (una edición/cohorte que ya terminó).
-- Es una decisión explícita del admin, igual que "proximamente"/"activo" —
-- no se calcula solo por fecha, para que el admin tenga el control.
alter type public.curso_estado add value 'finalizado';
