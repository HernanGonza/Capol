import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DollarSign, CreditCard, CheckCircle } from "lucide-react";
import PriceTag from "@/components/PriceTag";

// Prefijo para "cuotas"/"clase" (ej: "3x", "8 clases x"); el monto en sí se
// muestra con PriceTag, que lo convierte a la moneda del alumno.
export const precioPrefijo = (course: any) => {
  if (!course.cantidad_cuotas) return "";
  if (course.tipo_precio === "cuotas") return `${course.cantidad_cuotas}x `;
  if (course.tipo_precio === "clase") return `${course.cantidad_cuotas} clases x `;
  return "";
};

interface Props {
  course: any | null;
  onClose: () => void;
}

// Modal de solicitud de inscripción/compra — se usa tanto desde la tarjeta
// del catálogo (StudentDashboard) como desde el botón "Comprar" del banner
// de muestra gratis (CourseView), para que sea el mismo flujo sin importar
// desde dónde se abra: inserta en solicitudes_inscripcion, el admin
// coordina el pago y recién ahí crea la suscripción que da acceso real.
const EnrollmentDialog = ({ course, onClose }: Props) => {
  const { user } = useAuth();
  const [solicitando, setSolicitando] = useState(false);
  const [yaSolicitado, setYaSolicitado] = useState(false);

  // Cada vez que se abre para un curso distinto, arrancar de cero (si no,
  // al cerrar y volver a abrir para otro curso quedaría pegado el estado
  // "solicitud enviada" del curso anterior).
  useEffect(() => {
    setYaSolicitado(false);
  }, [course?.id]);

  const { data: mediosDePago } = useQuery({
    queryKey: ["config-medios-pago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracion_global").select("valor").eq("clave", "medios_de_pago").single();
      return (data?.valor as string[]) || [];
    },
  });

  const handleSolicitar = async () => {
    if (!course || !user) return;
    setSolicitando(true);
    try {
      const { error } = await supabase.from("solicitudes_inscripcion").insert({
        usuario_id: user.id,
        curso_id: course.id,
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("Ya enviaste una solicitud para este curso. Te contactaremos pronto.");
        } else throw error;
      } else {
        toast.success("¡Solicitud enviada! Te contactaremos para coordinar el pago.");
        setYaSolicitado(true);
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[460px]">
        {course && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-1">Solicitud de inscripción</p>
              <DialogTitle asChild>
                <h2 className="text-xl font-black leading-tight">{course.titulo}</h2>
              </DialogTitle>
              <DialogDescription className="sr-only">Confirmá tu solicitud de inscripción a este curso</DialogDescription>
            </div>

            {(course.url_flyer || course.url_imagen) && (
              <div className="rounded-xl overflow-hidden h-32">
                {course.tipo_flyer === "video"
                  ? <video src={course.url_flyer} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                  : <img src={course.url_flyer || course.url_imagen} className="w-full h-full object-cover" alt={course.titulo} />}
              </div>
            )}

            {course.precio ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/60 rounded-full flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wide">Precio del curso</p>
                  <p className="font-black text-xl text-emerald-800 dark:text-emerald-300">
                    {precioPrefijo(course)}
                    <PriceTag
                      usdAmount={course.precio}
                      suffix={course.tipo_precio === "mensual" ? "/mes" : ""}
                      showUsdReference
                      arsRate={course.cotizacion_ars}
                    />
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-muted border rounded-xl p-4">
                <p className="text-sm text-muted-foreground">El precio se acordará al momento del contacto.</p>
              </div>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed">
              Estás a punto de solicitar {course.modalidad === "grabado" ? "la compra" : "tu inscripción"} del curso <strong className="text-foreground">"{course.titulo}"</strong>.
              Podrás ingresar al mismo una vez que se acredite tu pago.
              <br /><br />
              <strong className="text-foreground">Nos estaremos comunicando con vos para coordinar el pago.</strong>
            </p>

            {mediosDePago && mediosDePago.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Medios de pago disponibles
                </p>
                <div className="flex flex-wrap gap-2">
                  {mediosDePago.map((medio: string, i: number) => (
                    <span key={i} className="bg-muted text-foreground text-xs font-semibold px-3 py-1.5 rounded-full border">{medio}</span>
                  ))}
                </div>
              </div>
            )}

            {yaSolicitado ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle className="w-5 h-5" /> Solicitud enviada — te contactaremos pronto
              </div>
            ) : (
              <button
                onClick={handleSolicitar}
                disabled={solicitando}
                className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {solicitando ? "Enviando solicitud..." : course.modalidad === "grabado" ? "Confirmar compra" : "Confirmar solicitud de inscripción"}
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnrollmentDialog;
