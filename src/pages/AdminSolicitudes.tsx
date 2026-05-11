import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, Clock, User, BookOpen,
  Calendar, Phone, Mail, MapPin, CreditCard, DollarSign, IdCard
} from "lucide-react";

const AdminSolicitudes = () => {
  const queryClient = useQueryClient();
  const [modalAlumno, setModalAlumno] = useState<any>(null);

  const { data: solicitudes, isLoading } = useQuery({
    queryKey: ["admin-solicitudes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitudes_inscripcion")
        .select(`
          *,
          perfiles:usuario_id (
            id, nombre_completo, url_avatar, telefono, biografia,
            dni, direccion, localidad, provincia, pais
          ),
          cursos:curso_id (titulo, precio, tipo_precio, cantidad_cuotas, moneda)
        `)
        .order("creado_en", { ascending: false });
      if (error) throw error;

      // Obtener emails desde auth.users para cada solicitud
      return data;
    },
  });

  // Buscar email del alumno cuando abre el modal
  const fetchEmail = async (usuarioId: string) => {
    const { data } = await supabase
      .from("perfiles")
      .select("id")
      .eq("id", usuarioId)
      .single();
    // El email está en auth.users, lo buscamos via RPC o simplemente mostramos lo que tenemos
    return null;
  };

  const resolverMutation = useMutation({
    mutationFn: async ({ id, estado, usuarioId, cursoId }: { id: string; estado: string; usuarioId: string; cursoId: string }) => {
      const { error } = await supabase
        .from("solicitudes_inscripcion")
        .update({ estado, resuelto_en: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

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
      setModalAlumno(null);
      toast.success(vars.estado === "aprobada" ? "✅ Inscripción aprobada — el alumno ya tiene acceso" : "Solicitud rechazada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatPrecio = (curso: any) => {
    if (!curso?.precio) return "Sin precio definido";
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

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-sm font-semibold text-foreground">{value}</p>
        </div>
      </div>
    );
  };

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
                  <Card key={s.id}
                    className="border-yellow-200 shadow-sm bg-yellow-50/40 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setModalAlumno(s)}>
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
                            {s.perfiles?.telefono && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {s.perfiles.telefono}
                              </p>
                            )}
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
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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

            {/* Historial */}
            {resueltas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Historial</h2>
                {resueltas.map((s: any) => (
                  <Card key={s.id}
                    className="border-none shadow-sm bg-white opacity-70 cursor-pointer hover:opacity-100 transition-all"
                    onClick={() => setModalAlumno(s)}>
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
                <p className="text-muted-foreground text-sm mt-1">Cuando un alumno solicite inscribirse, aparecerá aquí.</p>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Modal datos de contacto */}
      <Dialog open={!!modalAlumno} onOpenChange={(o) => { if (!o) setModalAlumno(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          {modalAlumno && (
            <div className="space-y-5">
              {/* Header alumno */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                  {modalAlumno.perfiles?.url_avatar
                    ? <img src={modalAlumno.perfiles.url_avatar} className="w-full h-full object-cover" />
                    : <User className="w-7 h-7 text-indigo-400" />}
                </div>
                <div>
                  <h2 className="text-xl font-black">{modalAlumno.perfiles?.nombre_completo}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {estadoBadge(modalAlumno.estado)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(modalAlumno.creado_en).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Curso */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Curso solicitado</p>
                  <p className="font-bold text-base">{modalAlumno.cursos?.titulo}</p>
                  <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />{formatPrecio(modalAlumno.cursos)}
                  </p>
                </div>
              </div>

              {/* Datos de contacto */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Datos de contacto</p>
                <InfoRow icon={Phone} label="Teléfono" value={modalAlumno.perfiles?.telefono} />
                <InfoRow icon={CreditCard} label="DNI" value={modalAlumno.perfiles?.dni} />
                <InfoRow icon={MapPin} label="Dirección" value={[
                  modalAlumno.perfiles?.direccion,
                  modalAlumno.perfiles?.localidad,
                  modalAlumno.perfiles?.provincia,
                  modalAlumno.perfiles?.pais,
                ].filter(Boolean).join(", ")} />
              </div>

              {/* Acciones si está pendiente */}
              {modalAlumno.estado === "pendiente" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button className="flex-1" variant="outline"
                    disabled={resolverMutation.isPending}
                    onClick={() => resolverMutation.mutate({ id: modalAlumno.id, estado: "rechazada", usuarioId: modalAlumno.usuario_id, cursoId: modalAlumno.curso_id })}
                    >
                    <XCircle className="w-4 h-4 mr-2 text-red-500" /> Rechazar
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={resolverMutation.isPending}
                    onClick={() => resolverMutation.mutate({ id: modalAlumno.id, estado: "aprobada", usuarioId: modalAlumno.usuario_id, cursoId: modalAlumno.curso_id })}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Aprobar acceso
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

// Componente auxiliar InfoRow
const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-indigo-500" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
};

export default AdminSolicitudes;