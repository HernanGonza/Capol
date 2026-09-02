-- Al dar de baja a un alumno, vencer también sus suscripciones en 'pago_diferido'.
--
-- Antes cascada_baja_alumno() solo tocaba 'active' y 'pago_pendiente', así que
-- un alumno dado de baja con un pago diferido seguía teniendo acceso al curso
-- (la RLS de contenido concede acceso a 'pago_diferido' mientras suspendida_en
-- sea NULL) y seguía contando como deuda esperada en el Panel Financiero.

create or replace function public.cascada_baja_alumno()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.activo = false and old.activo = true then
    update public.suscripciones
    set estado = 'expired'
    where usuario_id = new.id
      and estado in ('active', 'pago_pendiente', 'pago_diferido');
  end if;
  return new;
end;
$function$;
