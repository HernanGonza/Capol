import { useQuery } from "@tanstack/react-query";
import { startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { estaVencidoEsteMes, estaPorVencer } from "@/lib/paymentCutoff";

export interface EstadoPagoCurso {
  cursoId: string;
  cursoTitulo: string;
  pagoEsteMes: boolean;
  bloqueado: boolean;
  porVencer: boolean;
}

// Estado de pago del mes en curso para cada suscripción activa del alumno —
// lo usa tanto CourseView (para cortar el acceso) como el banner de aviso
// en AppLayout (para avisar antes del corte).
export const usePaymentStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ["payment-status", userId],
    queryFn: async (): Promise<EstadoPagoCurso[]> => {
      const { data: subs, error } = await supabase
        .from("suscripciones")
        .select("curso_id, cursos:curso_id(titulo)")
        .eq("usuario_id", userId!)
        .eq("estado", "active");
      if (error) throw error;
      if (!subs?.length) return [];

      const { data: pagos, error: errorPagos } = await supabase
        .from("pagos")
        .select("curso_id")
        .eq("usuario_id", userId!)
        .gte("pagado_en", startOfMonth(new Date()).toISOString());
      if (errorPagos) throw errorPagos;

      const pagaronEsteMes = new Set((pagos || []).map((p) => p.curso_id));

      return subs.map((s: any) => {
        const pagoEsteMes = pagaronEsteMes.has(s.curso_id);
        return {
          cursoId: s.curso_id,
          cursoTitulo: s.cursos?.titulo || "Curso",
          pagoEsteMes,
          bloqueado: estaVencidoEsteMes(pagoEsteMes),
          porVencer: estaPorVencer(pagoEsteMes),
        };
      });
    },
    enabled: !!userId,
  });
