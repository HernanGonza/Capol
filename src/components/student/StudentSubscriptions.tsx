import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCurrencyConversion } from "@/hooks/use-currency-conversion";
import { estadoSuscripcionDisplay } from "@/lib/paymentCutoff";

const StudentSubscriptions = () => {
  const { user } = useAuth();
  const { toUsd } = useCurrencyConversion();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["student-billing", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select(`
          *,
          cursos (titulo)
        `)
        .eq("usuario_id", user!.id)
        .order("creado_en", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Mi Suscripción</h1>
          <p className="text-muted-foreground">Gestiona tus pagos y estados de acceso</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : subscriptions && subscriptions.length > 0 ? (
          <div className="grid gap-4">
            {subscriptions.map((sub) => {
              const display = estadoSuscripcionDisplay(sub);
              const label = {
                activa: "Activa",
                pago_pendiente: "Pago pendiente",
                pago_diferido: "Pago comprometido",
                suspendida: "Suspendida",
                vencida: "Vencida",
                cancelada: "Cancelada",
              }[display];
              const esAmbar = display === 'pago_pendiente' || display === 'pago_diferido';
              return (
              <Card key={sub.id} className="border-none shadow-card overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className={`w-2 md:w-3 ${display === 'activa' ? 'bg-success' : esAmbar ? 'bg-amber-500' : 'bg-destructive'}`} />
                  <CardContent className="p-6 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{sub.cursos?.titulo}</h3>
                        <Badge
                          variant={display === 'activa' ? 'default' : esAmbar ? 'outline' : 'destructive'}
                          className={display === 'activa' ? 'bg-success/10 text-success border-none' : esAmbar ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900' : ''}
                        >
                          {label}
                        </Badge>
                      </div>
                      {display === 'pago_diferido' && sub.pago_diferido_hasta && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          Te comprometiste a pagar antes del {format(new Date(sub.pago_diferido_hasta), "PPP", { locale: es })}.
                        </p>
                      )}
                      {display === 'suspendida' && (
                        <p className="text-xs text-destructive font-medium">
                          Acceso suspendido por administración. Contactate para reactivarlo.
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 shrink-0" />
                          {sub.price != null ? (
                            <>
                              ${sub.price} {sub.moneda || "ARS"} / mes
                              <span className="text-muted-foreground/70">
                                (≈ USD {toUsd(sub.price, sub.moneda || "ARS").toLocaleString("es-AR", { maximumFractionDigits: 2 })})
                              </span>
                            </>
                          ) : (
                            "Monto no cargado"
                          )}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 shrink-0" />
                          Próximo vencimiento: {sub.fin_en ? format(new Date(sub.fin_en), "PPP", { locale: es }) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {display === 'activa' ? (
                        <div className="flex items-center gap-2 text-success font-semibold text-sm bg-success/5 px-4 py-2 rounded-full">
                          <CheckCircle2 className="w-4 h-4" /> Al día
                        </div>
                      ) : esAmbar ? (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm bg-amber-500/10 px-4 py-2 rounded-full">
                          <AlertCircle className="w-4 h-4" /> {display === 'pago_diferido' ? 'Pago comprometido' : 'Pago pendiente'}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-destructive font-semibold text-sm bg-destructive/5 px-4 py-2 rounded-full">
                          <AlertCircle className="w-4 h-4" /> {display === 'cancelada' ? 'Cancelada' : display === 'suspendida' ? 'Suspendida' : 'Vencida'}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center border-dashed border-2 bg-transparent">
            <CreditCard className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">No hay suscripciones registradas</h3>
            <p className="text-muted-foreground mt-1">Si ya realizaste un pago, contacta al administrador.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default StudentSubscriptions;