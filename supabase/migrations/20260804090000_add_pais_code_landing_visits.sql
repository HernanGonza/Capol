-- País del visitante (código ISO, ej "AR"), detectado por IP del lado del
-- cliente (mismo mecanismo que ya usa el precio automático — ver
-- detectCountryCode() en src/lib/currency.ts) y mandado junto con el
-- registro de la visita. Nullable: si la geolocalización falla, la visita
-- se sigue contando igual, solo queda sin país conocido.
alter table public.landing_visits add column pais_code text;
