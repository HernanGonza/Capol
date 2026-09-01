-- Mensajes automáticos de la plataforma ("CapOL Escuela"): se guardan en la
-- misma tabla que la mensajería, con remitente_id NULL (no los "manda" una
-- persona) y es_sistema = true para que la bandeja los trate como un aviso de
-- solo lectura (no se pueden responder).

alter table public.mensajes
  add column if not exists es_sistema boolean not null default false;

alter table public.mensajes
  alter column remitente_id drop not null;

comment on column public.mensajes.es_sistema is
  'true = aviso automatico de la plataforma (remitente NULL, se muestra como CapOL Escuela y no se puede responder).';
