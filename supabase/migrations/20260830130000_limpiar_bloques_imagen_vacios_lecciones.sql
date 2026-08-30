-- Todas las lecciones tenían (o algunas) un bloque de imagen sin URL cargada
-- ("value":""), que se agregó en el editor y nunca se completó. En el front
-- se veía como una imagen rota / recuadro de error en el medio de la clase.
-- Los sacamos del content. Solo bloques de imagen con value exactamente vacío;
-- no toca ningún otro tipo de bloque ni ninguna imagen con URL.
--
-- Aplicada a producción el 2026-08-30 (92 lecciones afectadas, 91 quedaron
-- con content vacío = solo tenían ese bloque fantasma).
update public.lecciones l
set content = sub.j_clean::text
from (
  select id,
    (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(content::jsonb) elem
      where not (
        coalesce(elem->>'type', '') = 'image'
        and coalesce(elem->>'value', '') = ''
      )
    ) as j_clean
  from public.lecciones
  where content is not null and content <> ''
) sub
where l.id = sub.id
  and l.content is not null
  and l.content <> ''
  and l.content::jsonb is distinct from sub.j_clean;
