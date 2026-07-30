-- Agrupa las distintas ediciones (copias) de un mismo curso bajo un mismo
-- grupo_id, para poder mostrar en la Landing una sola tarjeta por curso sin
-- depender de comparar títulos (frágil ante ediciones de texto).
alter table public.cursos add column grupo_id uuid references public.cursos(id) on delete set null;

-- Todo curso ya existente pasa a ser la raíz de su propio grupo.
update public.cursos set grupo_id = id where grupo_id is null;

create or replace function public.set_curso_grupo_id()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.grupo_id is null then
    new.grupo_id := new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_curso_grupo_id on public.cursos;
create trigger trg_set_curso_grupo_id
before insert on public.cursos
for each row execute function public.set_curso_grupo_id();
