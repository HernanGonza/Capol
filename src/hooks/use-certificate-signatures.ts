import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Resuelve profesor + firmas (propia y de dirección) de UN curso en
// contexto, para armar el certificado. Si un curso tiene más de un docente
// asignado, se usa el primero — simplificación aceptada, esta app no soporta
// certificados con varias firmas de profesor.
export function useCertificateSignatures(courseId: string | undefined, enabled: boolean) {
  const { data: teachers } = useQuery({
    queryKey: ["course-teachers-for-cert", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("docentes_cursos")
        .select("docente_id")
        .eq("curso_id", courseId!)
        .limit(1);
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!courseId,
  });
  const teacherId = teachers?.[0]?.docente_id;

  const { data: perfiles } = useQuery({
    queryKey: ["perfiles-publicos-cert", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("perfiles_publicos", { p_ids: [teacherId!] });
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!teacherId,
  });

  const { data: config } = useQuery({
    queryKey: ["firma-director"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracion_global").select("valor").eq("clave", "firma_director").maybeSingle();
      return (data?.valor as { url?: string } | null) || null;
    },
    enabled,
  });

  return {
    teacherName: perfiles?.[0]?.nombre_completo || null,
    teacherSignatureUrl: perfiles?.[0]?.firma_url || null,
    directorSignatureUrl: config?.url || null,
  };
}
