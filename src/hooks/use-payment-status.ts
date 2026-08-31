import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { estaVencido, estaPorVencer } from "@/lib/paymentCutoff";

export interface EstadoPagoCurso {
  cursoId: string;
  cursoTitulo: string;
  finEn: string | null;
  bloqueado: boolean;
  porVencer: boolean;
  // Suscripción pausada por administración: el acceso está cortado a mano.
  suspendida: boolean;
  // Pago diferido: acceso concedido con una fecha comprometida de pago.
  esDiferido: boolean;
  diferidoHasta: string | null;
}

// Dan acceso al contenido:
//  - 'active'        = pagó / al día (para cursos en vivo, mientras no venza fin_en).
//  - 'pago_diferido' = acceso concedido a mano, con fecha comprometida de pago.
//
// Cualquiera de los dos con "suspendida_en" cargado queda BLOQUEADO: es la
// palanca de administración para cortarle el curso a alguien.
//
// "pago_pendiente" = solicitud aprobada pero sin abonar todavía → sin acceso.
export const usePaymentStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ["payment-status", userId],
    queryFn: async (): Promise<EstadoPagoCurso[]> => {
      const { data: subs, error } = await supabase
        .from("suscripciones")
        .select(
          "curso_id, estado, fin_en, suspendida_en, pago_diferido_hasta, cursos:curso_id(titulo, modalidad)"
        )
        .eq("usuario_id", userId!)
        .in("estado", ["active", "pago_diferido"]);

      if (error) throw error;
      if (!subs?.length) return [];

      return subs.map((s: any) => {
        const esGrabado = s.cursos?.modalidad === "grabado";
        const esDiferido = s.estado === "pago_diferido";
        const suspendida = !!s.suspendida_en;

        return {
          cursoId: s.curso_id,
          cursoTitulo: s.cursos?.titulo || "Curso",
          finEn: s.fin_en,
          // El diferido nunca bloquea por fecha; solo la suspensión (o, para
          // 'active' en vivo, que se haya vencido fin_en) corta el acceso.
          bloqueado:
            suspendida ||
            (!esDiferido && !esGrabado && estaVencido(s.fin_en)),
          porVencer:
            !suspendida &&
            !esDiferido &&
            !esGrabado &&
            estaPorVencer(s.fin_en),
          suspendida,
          esDiferido,
          diferidoHasta: s.pago_diferido_hasta ?? null,
        };
      });
    },
    enabled: !!userId,
  });
