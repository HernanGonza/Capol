import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, AlertTriangle, Eye, Globe, Fingerprint } from "lucide-react";

const AdminSeguridad = () => {
  const queryClient = useQueryClient();

  const { data: alertas, isLoading: cargandoAlertas } = useQuery({
    queryKey: ["alertas-seguridad"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_seguridad")
        .select("*")
        .order("creado_en", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Últimas visitas, para poder inspeccionar a mano — ip/user-agent/id de
  // visitante son justo lo que hace falta para distinguir tráfico humano
  // real de bots, más allá de lo que ya marquen las alertas automáticas.
  const { data: visitas, isLoading: cargandoVisitas } = useQuery({
    queryKey: ["landing-visits-detalle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_visits")
        .select("*")
        .order("visited_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const resolverMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alertas_seguridad")
        .update({ resuelta: true, resuelta_en: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-seguridad"] });
      toast.success("Alerta marcada como resuelta");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendientes = alertas?.filter((a) => !a.resuelta) || [];
  const resueltas = alertas?.filter((a) => a.resuelta) || [];

  const visitantesUnicos = new Set((visitas || []).map((v) => v.visitor_id).filter(Boolean)).size;
  const paisesDistintos = new Set((visitas || []).map((v) => v.pais_code).filter(Boolean)).size;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seguridad</h1>
          <p className="text-muted-foreground">
            Un chequeo automático revisa cada 10 minutos si hay ráfagas de visitas o de registros de cuentas nuevas,
            y avisa por mail a plataformacapol@gmail.com si encuentra algo.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Alertas pendientes</CardTitle>
              <ShieldAlert className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendientes.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Sin revisar todavía</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Alertas resueltas</CardTitle>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{resueltas.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Ya revisadas</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Visitantes distintos</CardTitle>
              <Fingerprint className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{visitantesUnicos}</div>
              <p className="text-xs text-muted-foreground mt-1">De las últimas {visitas?.length || 0} visitas</p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Países distintos</CardTitle>
              <Globe className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paisesDistintos}</div>
              <p className="text-xs text-muted-foreground mt-1">De las últimas {visitas?.length || 0} visitas</p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alertas detectadas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {cargandoAlertas ? (
                <p className="text-center text-sm text-muted-foreground py-10">Cargando...</p>
              ) : alertas?.length ? (
                alertas.map((a) => (
                  <div key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={a.resuelta
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                          : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900"}>
                          {a.resuelta ? "Resuelta" : "Pendiente"}
                        </Badge>
                        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{a.tipo}</span>
                      </div>
                      <p className="text-sm font-medium mt-1">{a.detalle}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.creado_en).toLocaleDateString("es-AR")} a las {new Date(a.creado_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {!a.resuelta && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolverMutation.isPending}
                        onClick={() => resolverMutation.mutate(a.id)}
                      >
                        Marcar resuelta
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-10">Todavía no se detectó ninguna alerta.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Visitas recientes, para inspección manual */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" /> Últimas visitas a la Landing
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {cargandoVisitas ? (
              <p className="text-center text-sm text-muted-foreground py-10">Cargando...</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-left p-3 font-semibold">Fecha</th>
                    <th className="text-left p-3 font-semibold">País</th>
                    <th className="text-left p-3 font-semibold">IP</th>
                    <th className="text-left p-3 font-semibold">Visitante</th>
                    <th className="text-left p-3 font-semibold">Navegador</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visitas?.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/10">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {new Date(v.visited_at).toLocaleDateString("es-AR")} {new Date(v.visited_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-3">{v.pais_code || "—"}</td>
                      <td className="p-3 font-mono text-xs">{v.ip || "—"}</td>
                      <td className="p-3 font-mono text-xs" title={v.visitor_id || ""}>
                        {v.visitor_id ? `${v.visitor_id.slice(0, 8)}…` : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground truncate max-w-[280px]" title={v.user_agent || ""}>
                        {v.user_agent || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!cargandoVisitas && visitas?.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-10">Todavía no hay visitas registradas.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminSeguridad;
