-- Optimización de disco (aviso de throughput de Supabase).
--
-- 1. Índice en pagos(suscripcion_id): lo usan el conteo de pagos por
--    suscripción (registrar_pago_suscripcion, métricas) y el FK
--    pagos_suscripcion_id_fkey, que no tenía índice.
-- 2. Se borran 7 índices que nunca se usaron (idx_scan = 0 desde el
--    22/07/2026, ninguno es unique ni respalda una constraint).
-- 3. cron.job_run_details nunca se purgaba: el chequeo de seguridad corre cada
--    10 minutos y cada corrida inserta y actualiza una fila. Se limpia el
--    historial y se programa una purga semanal que conserva 7 días.
--    La frecuencia del chequeo de seguridad no se toca.

create index if not exists idx_pagos_suscripcion_id
  on public.pagos (suscripcion_id);

drop index if exists public.idx_entregas_trabajo_final_usuario_id;
drop index if exists public.idx_solicitudes_inscripcion_resuelto_por;
drop index if exists public.idx_docentes_docente;
drop index if exists public.idx_subscriptions_dates;
drop index if exists public.idx_docentes_curso;
drop index if exists public.idx_errores_cliente_creado_en;
drop index if exists public.idx_movimientos_admin_accion;

delete from cron.job_run_details
where end_time < now() - interval '7 days';

select cron.unschedule(jobid)
from cron.job
where jobname = 'purgar-cron-historial';

-- Domingos 06:00 UTC (03:00 Argentina).
select cron.schedule(
  'purgar-cron-historial',
  '0 6 * * 0',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
