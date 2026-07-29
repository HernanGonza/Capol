import { toast } from "sonner";

interface OpenCertificateOptions {
  studentName: string;
  courseTitle: string;
  completionDate?: string | null;
}

// Genera el PDF del certificado y lo abre en una pestaña nueva (desde ahí el
// alumno lo puede descargar con el botón propio del visor de PDF del navegador).
//
// Ojo con el orden acá: `window.open` tiene que llamarse de forma síncrona
// dentro del handler del click para que el navegador no lo bloquee como
// pop-up — por eso abrimos la pestaña en blanco primero y recién after el
// `await` (armar el PDF) le cambiamos la URL.
export const openCertificate = async ({ studentName, courseTitle, completionDate }: OpenCertificateOptions) => {
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
      <CertificatePdfDocument studentName={studentName} courseTitle={courseTitle} completionDate={formattedDate} />
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
