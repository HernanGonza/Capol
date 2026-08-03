-- Cotización ARS/USD específica de este curso, editable a mano por el admin
-- junto al precio. Si queda vacía, el precio automático (PriceTag) usa el
-- fallback fijo global de $1500 (ARS_FIXED_RATE en src/lib/currency.ts).
alter table public.cursos add column cotizacion_ars numeric;
