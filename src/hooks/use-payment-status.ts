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

// Solo una suscripción ACTIVE da acceso.
//
// "pago_pendiente" significa:
// - solicitud aprobada;
// - alumno autorizado;
// - todavía no abonó;
// - NO tiene acceso al curso.
//
// Para cursos en vivo además verificamos fin_en.
// Para cursos grabados, una vez active, el acceso no vence.
export const usePaymentStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ["payment-status", userId],
    queryFn: async (): Promise<EstadoPagoCurso[]> => {
      const { data: subs, error } = await supabase
        .from("suscripciones")
        .select(
          "curso_id, fin_en, cursos:curso_id(titulo, modalidad)"
        )
        .eq("usuario_id", userId!)
        .eq("estado", "active");

      if (error) throw error;
      if (!subs?.length) return [];

      return subs.map((s: any) => {
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