-- Firma digital del profesor: se dibuja una vez (canvas, a mano) y se
-- reutiliza en todos los certificados de sus cursos. Nullable — un profesor
-- sin firma cargada simplemente no aparece en el PDF, no bloquea la emisión
-- del certificado.
alter table public.perfiles add column firma_url text;
comment on column public.perfiles.firma_url is 'URL pública de la imagen de firma del profesor (bucket "firmas"), para certificados.';
