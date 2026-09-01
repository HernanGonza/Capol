-- Sala de videollamada automática para las clases de cursos EN VIVO.
--
-- Antes "sala_jitsi" era un campo de texto libre que había que completar a mano
-- clase por clase (editor del profesor y del admin). Si quedaba vacío, la clase
-- no mostraba el botón "Entrar a la videollamada" aunque el curso fuera en vivo
-- (la UI lo esconde cuando sala_jitsi es null). Ahora se completa solo al crear
-- la clase, con el mismo formato que se venía usando a mano:
--   "Clase <n> en vivo: <título del curso>"
--
-- Solo aplica a cursos en vivo — los grabados no tienen clase en vivo. Un valor
-- puesto a mano nunca se pisa.

create or replace function public.set_sala_jitsi_default()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_modalidad curso_modalidad;
  v_titulo text;
begin
  -- Respetamos un valor cargado a mano.
  if new.sala_jitsi is not null and btrim(new.sala_jitsi) <> '' then
    return new;
  end if;

  select modalidad, titulo
    into v_modalidad, v_titulo
  from public.cursos
  where id = new.curso_id;

  -- Los cursos grabados no tienen clase en vivo.
  if v_modalidad is distinct from 'en_vivo'::curso_modalidad then
    return new;
  end if;

  new.sala_jitsi := 'Clase ' || (coalesce(new.orden, 0) + 1)
                 || ' en vivo: ' || coalesce(nullif(btrim(v_titulo), ''), 'CapOL');
  return new;
end;
$function$;

drop trigger if exists trg_set_sala_jitsi_default on public.lecciones;
create trigger trg_set_sala_jitsi_default
  before insert on public.lecciones
  for each row execute function public.set_sala_jitsi_default();

-- Backfill: clases de cursos en vivo que hoy están sin sala.
update public.lecciones l
set sala_jitsi = 'Clase ' || (coalesce(l.orden, 0) + 1)
              || ' en vivo: ' || coalesce(nullif(btrim(c.titulo), ''), 'CapOL')
from public.cursos c
where c.id = l.curso_id
  and c.modalidad = 'en_vivo'::curso_modalidad
  and (l.sala_jitsi is null or btrim(l.sala_jitsi) = '');
