-- Bitácora de acciones de administración con su motivo.
--
-- Pedido: toda acción con consecuencias (aprobar/rechazar solicitudes, registrar
-- pagos, dar de baja o pausar suscripciones, quitar alumnos de un curso, etc.)
-- tiene que pedir confirmación y permitir escribir un motivo, y esos motivos
-- tienen que quedar guardados para poder medirlos después (motivos de rechazo,
-- de baja, etc.).
--
-- Esta tabla es append-only: nunca se edita ni se borra una fila. Cada acción
-- deja un registro con quién la hizo, sobre quién/qué curso, y el motivo.

create table if not exists public.movimientos_admin (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  -- Sin FKs a propósito: si se borra un usuario o un curso, el registro de la
  -- acción tiene que sobrevivir igual.
  actor_id uuid not null,
  usuario_id uuid,
  curso_id uuid,
  suscripcion_id uuid,
  -- 'solicitud_aprobada' | 'solicitud_rechazada' | 'pago_registrado' |
  -- 'suscripcion_suspendida' | 'suscripcion_reactivada' | 'suscripcion_eliminada' |
  -- 'pago_diferido_habilitado' | 'alumno_baja' | 'alumno_reactivado' |
  -- 'alumno_removido_curso' | 'mensajeria_bloqueada' | 'mensajeria_desbloqueada'
  accion text not null,
  motivo text,
  metadata jsonb
);

create index if not exists idx_movimientos_admin_creado_en on public.movimientos_admin (creado_en desc);
create index if not exists idx_movimientos_admin_accion on public.movimientos_admin (accion);
create index if not exists idx_movimientos_admin_usuario on public.movimientos_admin (usuario_id);

alter table public.movimientos_admin enable row level security;

-- Solo admin. Insert: además, el actor tiene que ser uno mismo (no se puede
-- registrar una acción "a nombre de otro"). Sin update ni delete para nadie.
create policy "Admin lee movimientos_admin"
  on public.movimientos_admin for select
  to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role));

create policy "Admin inserta movimientos_admin"
  on public.movimientos_admin for insert
  to authenticated
  with check (
    has_role((select auth.uid()), 'admin'::app_role)
    and actor_id = (select auth.uid())
  );

-- Motivo de resolución de una solicitud (rechazo o aprobación), guardado también
-- en la propia fila para poder verlo sin cruzar con la bitácora.
alter table public.solicitudes_inscripcion
  add column if not exists nota_resolucion text;

comment on column public.solicitudes_inscripcion.nota_resolucion is
  'Motivo que cargó el admin al aprobar o rechazar la solicitud (uso interno).';
