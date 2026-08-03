import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OpenCertificateOptions {
  studentName: string;
  courseTitle: string;
  completionDate?: string | null;
  cargaHoraria?: number | null;
  teacherName?: string | null;
  teacherSignatureUrl?: string | null;
  directorSignatureUrl?: string | null;
}

// Resuelve profesor + firmas de un curso en un solo helper — para usar en
// componentes donde no se puede llamar a un hook (ej: dentro de un .map())
// justo antes de abrir el certificado.
export const fetchCertificateSignatures = async (courseId: string) => {
  const { data: docentes } = await supabase
    .from("docentes_cursos")
    .select("docente_id")
    .eq("curso_id", courseId)
    .limit(1);
  const teacherId = docentes?.[0]?.docente_id;

  const [{ data: perfiles }, { data: config }] = await Promise.all([
    teacherId
      ? supabase.rpc("perfiles_publicos", { p_ids: [teacherId] })
      : Promise.resolve({ data: null } as any),
    supabase.from("configuracion_global").select("valor").eq("clave", "firma_director").maybeSingle(),
  ]);

  const perfil = perfiles?.[0];
  return {
    teacherName: perfil?.nombre_completo || null,
    teacherSignatureUrl: perfil?.firma_url || null,
    directorSignatureUrl: (config?.valor as { url?: string } | null)?.url || null,
  };
};

// Genera el PDF del certificado y lo abre en una pestaña nueva (desde ahí el
// alumno lo puede descargar con el botón propio del visor de PDF del navegador).
//
// Ojo con el orden acá: `window.open` tiene que llamarse de forma síncrona
// dentro del handler del click para que el navegador no lo bloquee como
// pop-up — por eso abrimos la pestaña en blanco primero y recién after el
// `await` (armar el PDF) le cambiamos la URL.
export const openCertificate = async ({
  studentName,
  courseTitle,
  completionDate,
  cargaHoraria,
  teacherName,
  teacherSignatureUrl,
  directorSignatureUrl,
}: OpenCertificateOptions) => {
  const tab = window.open("", "_blank");
  try {
    const [{ pdf }, { default: CertificatePdfDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/CertificatePdfDocument"),
    ]);

    const formattedDate = new Date(completionDate || Date.now()).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const blob = await pdf(
      <CertificatePdfDocument
        studentName={studentName}
        courseTitle={courseTitle}
        completionDate={formattedDate}
        cargaHoraria={cargaHoraria}
        teacherName={teacherName}
        teacherSignatureUrl={teacherSignatureUrl}
        directorSignatureUrl={directorSignatureUrl}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);

    if (tab) {
      tab.location.href = url;
    } else {
      toast.error("El navegador bloqueó la ventana emergente. Permití pop-ups para ver el certificado.");
    }
  } catch (e) {
    tab?.close();
    toast.error("No se pudo generar el certificado.");
  }
};
