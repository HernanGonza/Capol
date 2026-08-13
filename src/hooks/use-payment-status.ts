import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { estaVencido, estaPorVencer } from "@/lib/paymentCutoff";

export interface EstadoPagoCurso {
  cursoId: string;
  cursoTitulo: string;
  finEn: string | null;
  bloqueado: boolean;
  porVencer: boolean;
}

// Estado de vencimiento de cada suscripción activa del alumno — lo usa tanto
// CourseView (para cortar el acceso) como el banner de aviso en AppLayout
// (para avisar antes del corte). Se basa en "fin_en" de la suscripción, el
// mismo campo que edita el admin en el panel de Suscripciones.
export const usePaymentStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ["payment-status", userId],
    queryFn: async (): Promise<EstadoPagoCurso[]> => {
      const { data: subs, error } = await supabase
        .from("suscripciones")
        .select("curso_id, fin_en, cursos:curso_id(titulo, modalidad)")
        .eq("usuario_id", userId!)
        .in("estado", ["active", "pago_pendiente"]);
      if (error) throw error;
      if (!subs?.length) return [];

      return subs.map((s: any) => {
        // Los cursos grabados se compran una sola vez, sin pago recurrente
        // — no tiene sentido exigirles vencimiento mensual, o perderían el
        // acceso al mes de haber comprado.
        const esGrabado = s.cursos?.modalidad === "grabado";
        return {
          cursoId: s.curso_id,
          cursoTitulo: s.cursos?.titulo || "Curso",
          finEn: s.fin_en,
          bloqueado: !esGrabado && estaVencido(s.fin_en),
          porVencer: !esGrabado && estaPorVencer(s.fin_en),
        };
      });
    },
    enabled: !!userId,
  });
