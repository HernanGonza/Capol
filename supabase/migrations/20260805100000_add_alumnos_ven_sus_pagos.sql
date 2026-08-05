-- El bloqueo de acceso por falta de pago mensual (día 10/11) se calcula en
-- el cliente comparando las suscripciones activas del alumno contra sus
-- propios pagos del mes en curso. Hasta ahora "pagos" solo era legible por
-- el admin, así que el alumno no podía leer ni sus propios registros.
create policy "Los alumnos ven sus propios pagos"
on public.pagos for select
to authenticated
using (usuario_id = (select auth.uid()));
