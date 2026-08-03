-- Marca si el usuario ya vio el tour interactivo de bienvenida completo
-- (llegó hasta el botón "Finalizar Tour"). Mientras esté en false, el tour
-- se vuelve a mostrar en cada login — cerrarlo antes de tiempo no cuenta
-- como visto.
alter table public.perfiles add column tour_completado boolean not null default false;
