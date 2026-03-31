import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const StudentSubscriptions = () => {
  const { user } = useAuth();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["student-billing", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          courses (title)
        `)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

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
            {subscriptions.map((sub) => (
              <Card key={sub.id} className="border-none shadow-card overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className={`w-2 md:w-3 ${sub.status === 'active' ? 'bg-success' : 'bg-destructive'}`} />
                  <CardContent className="p-6 flex-1 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{sub.courses?.title}</h3>
                        <Badge variant={sub.status === 'active' ? 'default' : 'destructive'} className={sub.status === 'active' ? 'bg-success/10 text-success border-none' : ''}>
                          {sub.status === 'active' ? 'Activa' : 'Vencida'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4" /> 
                          ${sub.price} / mes
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          Próximo vencimiento: {sub.ends_at ? format(new Date(sub.ends_at), "PPP", { locale: es }) : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {sub.status === 'active' ? (
                        <div className="flex items-center gap-2 text-success font-semibold text-sm bg-success/5 px-4 py-2 rounded-full">
                          <CheckCircle2 className="w-4 h-4" /> Al día
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-destructive font-semibold text-sm bg-destructive/5 px-4 py-2 rounded-full">
                          <AlertCircle className="w-4 h-4" /> Pago pendiente
                        </div>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
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