import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type AccionAdmin =
  | "solicitud_aprobada"
  | "solicitud_rechazada"
  | "solicitud_eliminada"
  | "pago_registrado"
  | "suscripcion_suspendida"
  | "suscripcion_reactivada"
  | "suscripcion_eliminada"
  | "pago_diferido_habilitado"
  | "alumno_baja"
  | "alumno_reactivado"
  | "alumno_removido_curso"
  | "mensajeria_bloqueada"
  | "mensajeria_desbloqueada";

interface RegistrarMovimientoInput {
  accion: AccionAdmin;
  usuarioId?: string | null;
  cursoId?: string | null;
  suscripcionId?: string | null;
  motivo?: string | null;
  metadata?: Json | null;
}

// Deja registro de una acción de administración en la bitácora (movimientos_admin).
// Best-effort: si falla, no rompe la acción que ya se hizo — solo se loguea.
export const registrarMovimiento = async (input: RegistrarMovimientoInput): Promise<void> => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const actorId = userData.user?.id;
    if (!actorId) return;

    const motivo = input.motivo?.trim() || null;

    const { error } = await supabase.from("movimientos_admin").insert({
      actor_id: actorId,
      usuario_id: input.usuarioId ?? null,
      curso_id: input.cursoId ?? null,
      suscripcion_id: input.suscripcionId ?? null,
      accion: input.accion,
      motivo,
      metadata: input.metadata ?? null,
    });

    if (error) console.warn("No se pudo registrar el movimiento de admin:", error.message);
  } catch (e) {
    console.warn("No se pudo registrar el movimiento de admin:", e);
  }
};
