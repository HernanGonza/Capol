import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, User, BookOpen, Calendar } from "lucide-react";

const AdminSolicitudes = () => {
  const queryClient = useQueryClient();

  const { data: solicitudes, isLoading } = useQuery({
    queryKey: ["admin-solicitudes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitudes_inscripcion")
        .select(`
          *,
          perfiles:usuario_id (nombre_completo, url_avatar, telefono),
          cursos:curso_id (titulo, precio, tipo_precio, cantidad_cuotas, moneda)
        `)
        .order("creado_en", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resolverMutation = useMutation({
    mutationFn: async ({ id, estado, usuarioId, cursoId }: { id: string; estado: string; usuarioId: string; cursoId: string }) => {
      const { error } = await supabase.from("solicitudes_inscripcion")
        .update({ estado, resuelto_en: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Si se aprueba: crear suscripción activa
      if (estado === "aprobada") {
        const { error: subError } = await supabase.from("suscripciones").insert({
          usuario_id: usuarioId,
          curso_id: cursoId,
          estado: "active",
          nombre_plan: "Manual",
          inicio_en: new Date().toISOString(),
        });
        if (subError) throw subError;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-solicitudes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitudes-pendientes-count"] });
      toast.success(vars.estado === "aprobada" ? "✅ Inscripción aprobada — el alumno ya tiene acceso" : "Solicitud rechazada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatPrecio = (curso: any) => {
    if (!curso?.precio) return "Sin precio";
    const s = curso.moneda === "USD" ? "U$S" : curso.moneda === "EUR" ? "€" : "$";
    const m = new Intl.NumberFormat("es-AR").format(curso.precio);
    if (curso.tipo_precio === "mensual") return `${s} ${m}/mes`;
    if (curso.tipo_precio === "cuotas") return `${curso.cantidad_cuotas}x ${s} ${m}`;
    return `${s} ${m}`;
  };

  const estadoBadge = (estado: string) => {
    if (estado === "pendiente") return <Badge className="bg-yellow-100 text-yellow-700 border-none"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    if (estado === "aprobada") return <Badge className="bg-emerald-100 text-emerald-700 border-none"><CheckCircle className="w-3 h-3 mr-1" />Aprobada</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-none"><XCircle className="w-3 h-3 mr-1" />Rechazada</Badge>;
  };

  const pendientes = solicitudes?.filter(s => s.estado === "pendiente") || [];
  const resueltas = solicitudes?.filter(s => s.estado !== "pendiente") || [];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitudes de Inscripción</h1>
          <p className="text-muted-foreground font-medium">
            {pendientes.length > 0
              ? `${pendientes.length} solicitud${pendientes.length > 1 ? "es" : ""} pendiente${pendientes.length > 1 ? "s" : ""} de revisión`
              : "Todo al día — no hay solicitudes pendientes"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}</div>
        ) : (
          <>
            {/* Pendientes */}
            {pendientes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pendientes</h2>
                {pendientes.map((s: any) => (
                  <Card key={s.id} className="border-yellow-200 shadow-sm bg-yellow-50/40">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                            {s.perfiles?.url_avatar
                              ? <img src={s.perfiles.url_avatar} className="w-full h-full object-cover" />
                              : <User className="w-5 h-5 text-indigo-400" />}
                          </div>
                          <div>
                            <p className="font-bold text-base">{s.perfiles?.nombre_completo || "Alumno"}</p>
                            {s.perfiles?.telefono && <p className="text-xs text-muted-foreground">{s.perfiles.telefono}</p>}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <BookOpen className="w-3.5 h-3.5" /> {s.cursos?.titulo}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-sm font-semibold text-emerald-700">{formatPrecio(s.cursos)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(s.creado_en).toLocaleDateString("es-AR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            disabled={resolverMutation.isPending}
                            onClick={() => resolverMutation.mutate({ id: s.id, estado: "rechazada", usuarioId: s.usuario_id, cursoId: s.curso_id })}>
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Rechazar
                          </Button>
                          <Button size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={resolverMutation.isPending}
                            onClick={() => resolverMutation.mutate({ id: s.id, estado: "aprobada", usuarioId: s.usuario_id, cursoId: s.curso_id })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Aprobar acceso
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Resueltas */}
            {resueltas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Historial</h2>
                {resueltas.map((s: any) => (
                  <Card key={s.id} className="border-none shadow-sm bg-white opacity-70">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {s.perfiles?.url_avatar
                              ? <img src={s.perfiles.url_avatar} className="w-full h-full object-cover" />
                              : <User className="w-4 h-4 text-slate-400" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{s.perfiles?.nombre_completo}</p>
                            <p className="text-xs text-muted-foreground">{s.cursos?.titulo} · {formatPrecio(s.cursos)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-muted-foreground">
                            {s.resuelto_en ? new Date(s.resuelto_en).toLocaleDateString("es-AR") : ""}
                          </p>
                          {estadoBadge(s.estado)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!pendientes.length && !resueltas.length && (
              <Card className="p-12 text-center border-none shadow-card bg-slate-50/50">
                <Clock className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="font-bold text-lg">No hay solicitudes aún</h3>
                <p className="text-muted-foreground text-sm mt-1">Cuando un alumno solicite inscribirse a un curso, aparecerá aquí.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminSolicitudes;