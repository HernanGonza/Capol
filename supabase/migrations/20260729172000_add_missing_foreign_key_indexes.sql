create index if not exists idx_cursos_creado_por on public.cursos(creado_por);
create index if not exists idx_entregas_trabajo_final_usuario_id on public.entregas_trabajo_final(usuario_id);
create index if not exists idx_solicitudes_inscripcion_curso_id on public.solicitudes_inscripcion(curso_id);
create index if not exists idx_solicitudes_inscripcion_resuelto_por on public.solicitudes_inscripcion(resuelto_por);
