import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmWithReason from "@/components/ConfirmWithReason";
import { registrarMovimiento } from "@/lib/movimientosAdmin";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  BookOpen,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  DollarSign,
  Trash2,
} from "lucide-react";

const AdminSolicitudes = () => {
  const queryClient = useQueryClient();

  const [modalAlumno, setModalAlumno] = useState<any>(null);
  const [tab, setTab] = useState<"en_vivo" | "grabado">("en_vivo");

  // Confirmación de eliminar (borrado físico) una solicitud.
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [borrarSuscripcion, setBorrarSuscripcion] = useState(true);

  // Confirmación + motivo al aprobar / rechazar una solicitud.
  const [confirmResolver, setConfirmResolver] = useState<
    | { solicitud: any; estado: "aprobada" | "rechazada" }
    | null
  >(null);

  const pedirResolver = (solicitud: any, estado: "aprobada" | "rechazada") =>
    setConfirmResolver({ solicitud, estado });

  const { data: solicitudes, isLoading } = useQuery({
    queryKey: ["admin-solicitudes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitudes_inscripcion")
        .select(`
          *,
          perfiles:usuario_id (
            id,
            nombre_completo,
            url_avatar,
            telefono,
            biografia,
            dni,
            direccion,
            localidad,
            provincia,
            pais,
            email
          ),
          cursos:curso_id (
            titulo,
            precio,
            tipo_precio,
            cantidad_cuotas,
            moneda,
            modalidad,
            fecha_inicio
          )
        `)
        .order("creado_en", { ascending: false });

      if (error) throw error;

      return data || [];
    },
  });

  const resolverMutation = useMutation({
    mutationFn: async ({
      id,
      estado,
      usuarioId,
      cursoId,
      motivo,
    }: {
      id: string;
      estado: string;
      usuarioId: string;
      cursoId: string;
      motivo?: string;
    }) => {
      if (estado === "aprobada") {
        // Aprobar una solicitud NO implica pago ni acceso.
        //
        // Creamos una suscripción en pago_pendiente para que administración
        // pueda verla en el Panel de Suscripciones y registrar el cobro.
        //
        // No cargamos inicio_en, fin_en ni proxima_fecha_pago.
        // Esas fechas recién existen cuando se registra el primer pago.
        const { data: existente, error: existenteError } = await supabase
          .from("suscripciones")
          .select("id")
          .eq("usuario_id", usuarioId)
          .eq("curso_id", cursoId)
          .in("estado", ["active", "pago_pendiente"])
          .maybeSingle();

        if (existenteError) throw existenteError;

        if (!existente) {
          const { error: subError } = await supabase
            .from("suscripciones")
            .insert({
              usuario_id: usuarioId,
              curso_id: cursoId,
              estado: "pago_pendiente",
              nombre_plan: "Pendiente de pago",
              inicio_en: null,
              fin_en: null,
              proxima_fecha_pago: null,
            });

          if (subError) throw subError;
        }
      }

      const { error } = await supabase
        .from("solicitudes_inscripcion")
        .update({
          estado,
          resuelto_en: new Date().toISOString(),
          nota_resolucion: motivo?.trim() || null,
        })
        .eq("id", id);

      if (error) throw error;

      await registrarMovimiento({
        accion: estado === "aprobada" ? "solicitud_aprobada" : "solicitud_rechazada",
        usuarioId,
        cursoId,
        motivo,
        metadata: { solicitud_id: id },
      });
    },

    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-solicitudes"],
      });

      queryClient.invalidateQueries({
        queryKey: ["solicitudes-pendientes-count"],
      });

      queryClient.invalidateQueries({
        queryKey: ["all-subscriptions"],
      });

      setModalAlumno(null);
      setConfirmResolver(null);

      toast.success(
        vars.estado === "aprobada"
          ? "✅ Solicitud aprobada — pendiente de pago"
          : "Solicitud rechazada"
      );
    },

    onError: (e: any) => {
      toast.error(e.message);
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: async () => {
      if (!confirmDelete) return;
      const { error } = await supabase.rpc("eliminar_solicitud", {
        p_solicitud_id: confirmDelete.id,
        p_borrar_suscripcion: borrarSuscripcion,
      });
      if (error) throw error;

      await registrarMovimiento({
        accion: "solicitud_eliminada",
        usuarioId: confirmDelete.usuario_id,
        cursoId: confirmDelete.curso_id,
        metadata: { solicitud_id: confirmDelete.id, borro_suscripcion: borrarSuscripcion },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-solicitudes"] });
      queryClient.invalidateQueries({ queryKey: ["solicitudes-pendientes-count"] });
      queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
      queryClient.invalidateQueries({ queryKey: ["payment-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-master-stats"] });
      toast.success("Solicitud eliminada");
      setConfirmDelete(null);
      setModalAlumno(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const formatPrecio = (curso: any) => {
    if (!curso?.precio) {
      return "Sin precio definido";
    }

    const simbolo =
      curso.moneda === "USD"
        ? "U$S"
        : curso.moneda === "EUR"
          ? "€"
          : "$";

    const monto = new Intl.NumberFormat("es-AR").format(curso.precio);

    if (curso.tipo_precio === "mensual") {
      return `${simbolo} ${monto}/mes`;
    }

    if (curso.tipo_precio === "cuotas") {
      return `${curso.cantidad_cuotas}x ${simbolo} ${monto}`;
    }

    return `${simbolo} ${monto}`;
  };

  const estadoBadge = (estado: string) => {
    if (estado === "pendiente") {
      return (
        <Badge className="bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-400 border-none">
          <Clock className="w-3 h-3 mr-1" />
          Pendiente
        </Badge>
      );
    }

    if (estado === "aprobada") {
      return (
        <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-none">
          <CheckCircle className="w-3 h-3 mr-1" />
          Aprobada
        </Badge>
      );
    }

    return (
      <Badge className="bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-none">
        <XCircle className="w-3 h-3 mr-1" />
        Rechazada
      </Badge>
    );
  };

  const solicitudesTab =
    solicitudes?.filter(
      (s: any) =>
        (s.cursos?.modalidad || "en_vivo") === tab
    ) || [];

  const pendientes =
    solicitudesTab.filter(
      (s: any) => s.estado === "pendiente"
    ) || [];

  const resueltas =
    solicitudesTab.filter(
      (s: any) => s.estado !== "pendiente"
    ) || [];

  const countEnVivo =
    solicitudes?.filter(
      (s: any) =>
        (s.cursos?.modalidad || "en_vivo") === "en_vivo"
    ).length || 0;

  const countGrabado =
    solicitudes?.filter(
      (s: any) => s.cursos?.modalidad === "grabado"
    ).length || 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Solicitudes de Inscripción
          </h1>

          <p className="text-muted-foreground font-medium">
            {pendientes.length > 0
              ? `${pendientes.length} solicitud${
                  pendientes.length > 1 ? "es" : ""
                } pendiente${
                  pendientes.length > 1 ? "s" : ""
                } de revisión`
              : "Todo al día — no hay solicitudes pendientes"}
          </p>
        </div>

        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setTab("en_vivo")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "en_vivo"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            En vivo ({countEnVivo})
          </button>

          <button
            type="button"
            onClick={() => setTab("grabado")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "grabado"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Grabados ({countGrabado})
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-muted animate-pulse rounded-2xl"
              />
            ))}
          </div>
        ) : (
          <>
            {pendientes.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Pendientes
                </h2>

                {pendientes.map((s: any) => (
                  <Card
                    key={s.id}
                    className="border-yellow-200 dark:border-yellow-900 shadow-sm bg-yellow-50/40 dark:bg-yellow-950/20 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => setModalAlumno(s)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center overflow-hidden shrink-0">
                            {s.perfiles?.url_avatar ? (
                              <img
                                src={s.perfiles.url_avatar}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-indigo-400" />
                            )}
                          </div>

                          <div>
                            <p className="font-bold text-base">
                              {s.perfiles?.nombre_completo || "Alumno"}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {s.perfiles?.email}
                            </p>

                            {s.perfiles?.telefono && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {s.perfiles.telefono}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                <BookOpen className="w-3.5 h-3.5" />
                                {s.cursos?.titulo}
                              </span>

                              <span className="text-muted-foreground">
                                ·
                              </span>

                              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatPrecio(s.cursos)}
                              </span>
                            </div>

                            {s.cursos?.fecha_inicio &&
                              s.cursos?.modalidad === "en_vivo" && (
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1 font-medium">
                                  <Calendar className="w-3 h-3" />
                                  Inicio del curso:{" "}
                                  {new Date(
                                    `${s.cursos.fecha_inicio}T00:00:00`
                                  ).toLocaleDateString("es-AR")}
                                </p>
                              )}

                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />

                              {new Date(
                                s.creado_en
                              ).toLocaleDateString("es-AR", {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            disabled={resolverMutation.isPending}
                            onClick={() => pedirResolver(s, "rechazada")}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Rechazar
                          </Button>

                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={resolverMutation.isPending}
                            onClick={() => pedirResolver(s, "aprobada")}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Aprobar solicitud
                          </Button>

                          <Button
                            size="icon"
                            variant="ghost"
                            title="Eliminar solicitud"
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => {
                              setBorrarSuscripcion(true);
                              setConfirmDelete(s);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {resueltas.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Historial
                </h2>

                {resueltas.map((s: any) => (
                  <Card
                    key={s.id}
                    className="border-none shadow-sm bg-card opacity-70 cursor-pointer hover:opacity-100 transition-all"
                    onClick={() => setModalAlumno(s)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {s.perfiles?.url_avatar ? (
                              <img
                                src={s.perfiles.url_avatar}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-sm">
                              {s.perfiles?.nombre_completo}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {s.perfiles?.email}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {s.cursos?.titulo} ·{" "}
                              {formatPrecio(s.cursos)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <p className="text-xs text-muted-foreground">
                            {s.resuelto_en
                              ? new Date(
                                  s.resuelto_en
                                ).toLocaleDateString("es-AR")
                              : ""}
                          </p>

                          {estadoBadge(s.estado)}

                          <Button
                            size="icon"
                            variant="ghost"
                            title="Eliminar solicitud"
                            className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBorrarSuscripcion(true);
                              setConfirmDelete(s);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!pendientes.length && !resueltas.length && (
              <Card className="p-12 text-center border-none shadow-card bg-muted/50">
                <Clock className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />

                <h3 className="font-bold text-lg">
                  No hay solicitudes aún
                </h3>

                <p className="text-muted-foreground text-sm mt-1">
                  Cuando un alumno solicite inscribirse,
                  aparecerá aquí.
                </p>
              </Card>
            )}
          </>
        )}
      </div>

      <Dialog
        open={!!modalAlumno}
        onOpenChange={(open) => {
          if (!open) {
            setModalAlumno(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          {modalAlumno && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center overflow-hidden shrink-0">
                  {modalAlumno.perfiles?.url_avatar ? (
                    <img
                      src={modalAlumno.perfiles.url_avatar}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-indigo-400" />
                  )}
                </div>

                <div>
                  <DialogTitle asChild>
                    <h2 className="text-xl font-black">
                      {modalAlumno.perfiles?.nombre_completo}
                    </h2>
                  </DialogTitle>

                  <DialogDescription className="sr-only">
                    Datos de contacto y curso solicitado por este alumno
                  </DialogDescription>

                  <p className="text-xs text-muted-foreground">
                    {modalAlumno.perfiles?.email}
                  </p>

                  <div className="flex items-center gap-2 mt-0.5">
                    {estadoBadge(modalAlumno.estado)}

                    <span className="text-xs text-muted-foreground">
                      {new Date(
                        modalAlumno.creado_en
                      ).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-xl p-4 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />

                <div>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold uppercase tracking-wide">
                    Curso solicitado
                  </p>

                  <p className="font-bold text-base">
                    {modalAlumno.cursos?.titulo}
                  </p>

                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {formatPrecio(modalAlumno.cursos)}
                  </p>

                  {modalAlumno.cursos?.fecha_inicio &&
                    modalAlumno.cursos?.modalidad === "en_vivo" && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                        Inicio:{" "}
                        {new Date(
                          `${modalAlumno.cursos.fecha_inicio}T00:00:00`
                        ).toLocaleDateString("es-AR")}
                      </p>
                    )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Datos de contacto
                </p>

                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={modalAlumno.perfiles?.email}
                />

                <InfoRow
                  icon={Phone}
                  label="Teléfono"
                  value={modalAlumno.perfiles?.telefono}
                />

                <InfoRow
                  icon={CreditCard}
                  label="DNI"
                  value={modalAlumno.perfiles?.dni}
                />

                <InfoRow
                  icon={MapPin}
                  label="Dirección"
                  value={[
                    modalAlumno.perfiles?.direccion,
                    modalAlumno.perfiles?.localidad,
                    modalAlumno.perfiles?.provincia,
                    modalAlumno.perfiles?.pais,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              </div>

              {modalAlumno.estado === "pendiente" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    className="flex-1"
                    variant="outline"
                    disabled={resolverMutation.isPending}
                    onClick={() => pedirResolver(modalAlumno, "rechazada")}
                  >
                    <XCircle className="w-4 h-4 mr-2 text-red-500" />
                    Rechazar
                  </Button>

                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={resolverMutation.isPending}
                    onClick={() => pedirResolver(modalAlumno, "aprobada")}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprobar solicitud
                  </Button>
                </div>
              )}

              {modalAlumno.estado === "aprobada" && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                  La solicitud está aprobada. El acceso se habilitará
                  cuando administración registre el pago en
                  Suscripciones.
                </div>
              )}

              <Button
                variant="outline"
                className="w-full text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => {
                  setBorrarSuscripcion(true);
                  setConfirmDelete(modalAlumno);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar solicitud
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(v) => {
          if (!v) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Solicitud de {confirmDelete?.perfiles?.nombre_completo} a "
              {confirmDelete?.cursos?.titulo}". No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex items-start gap-2 text-sm rounded-lg border p-3 cursor-pointer">
            <Checkbox
              checked={borrarSuscripcion}
              onCheckedChange={(v) => setBorrarSuscripcion(v === true)}
              className="mt-0.5"
            />
            <span>
              Eliminar también la suscripción y la inscripción de este curso (si
              existen y no tienen pagos registrados). Dejá esto tildado si la
              solicitud fue un error.
            </span>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                eliminarMutation.mutate();
              }}
              disabled={eliminarMutation.isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmWithReason
        open={!!confirmResolver}
        onOpenChange={(v) => !v && setConfirmResolver(null)}
        title={
          confirmResolver?.estado === "aprobada"
            ? "¿Aprobar esta solicitud?"
            : "¿Rechazar esta solicitud?"
        }
        description={
          confirmResolver
            ? `${confirmResolver.solicitud?.perfiles?.nombre_completo || "El alumno"} — ${confirmResolver.solicitud?.cursos?.titulo || "curso"}.` +
              (confirmResolver.estado === "aprobada"
                ? " Se crea una suscripción pendiente de pago (no da acceso todavía)."
                : "")
            : undefined
        }
        confirmLabel={confirmResolver?.estado === "aprobada" ? "Aprobar" : "Rechazar"}
        destructive={confirmResolver?.estado === "rechazada"}
        motivoRequerido={confirmResolver?.estado === "rechazada"}
        motivoLabel={confirmResolver?.estado === "rechazada" ? "Motivo del rechazo" : "Nota"}
        loading={resolverMutation.isPending}
        onConfirm={(motivo) =>
          confirmResolver &&
          resolverMutation.mutate({
            id: confirmResolver.solicitud.id,
            estado: confirmResolver.estado,
            usuarioId: confirmResolver.solicitud.usuario_id,
            cursoId: confirmResolver.solicitud.curso_id,
            motivo,
          })
        }
      />
    </AppLayout>
  );
};

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value?: string | null;
}) => {
  if (!value) return null;

  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </p>

        <p className="text-sm font-semibold">
          {value}
        </p>
      </div>
    </div>
  );
};

export default AdminSolicitudes;