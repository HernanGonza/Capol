import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Calendar,
  CalendarClock,
  Edit2,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Wallet,
  ExternalLink,
  CreditCard,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import CurrencyConverter from "@/components/CurrencyConverter";
import { ARS_FIXED_RATE } from "@/lib/currency";
import {
  estaVencido,
  estaPorVencer,
  diferidoVencido,
  diferidoPorVencer,
  estadoSuscripcionDisplay,
  type EstadoSuscripcionDisplay,
} from "@/lib/paymentCutoff";

// Fecha mínima (hoy, local) para el input de fecha comprometida del pago diferido.
const hoyISODate = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const AdminSubscriptions = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [tab, setTab] =
    useState<"en_vivo" | "grabado">("en_vivo");

  const [form, setForm] = useState({
    usuario_id: "",
    curso_id: "",
    price: "",
    proveedor_pago: "",
    estado: "pago_pendiente",
  });

  // Diálogo de pago diferido (habilitar o extender). Guarda la suscripción sobre
  // la que se opera + la fecha comprometida + una nota opcional.
  const [diferido, setDiferido] = useState<{
    sub: any;
    fecha: string;
    nota: string;
  } | null>(null);

  // Confirmación de suspender / reactivar una suscripción.
  const [confirmSuspension, setConfirmSuspension] = useState<{
    sub: any;
    suspender: boolean;
  } | null>(null);

  const precioCursoArs = (course: any) => {
    const precioUsd = Number(course?.precio);
    const cotizacionArs = Number(course?.cotizacion_ars) || ARS_FIXED_RATE;

    return Number.isFinite(precioUsd) && precioUsd > 0
      ? Math.round(precioUsd * cotizacionArs * 100) / 100
      : null;
  };

  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("roles_usuario")
        .select("usuario_id")
        .eq("rol", "student");

      if (!roles?.length) return [];

      const { data: profiles, error } =
        await supabase
          .from("perfiles")
          .select("*")
          .in(
            "id",
            roles.map((r) => r.usuario_id)
          )
          .eq("activo", true)
          .order("nombre_completo");

      if (error) throw error;

      return profiles || [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select(
          "id, titulo, modalidad, fecha_inicio, precio, moneda, tipo_precio, cotizacion_ars"
        )
        .order("titulo");

      if (error) throw error;

      return data || [];
    },
  });

  const { data: mediosDePago } = useQuery({
    queryKey: ["config-medios-pago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracion_global")
        .select("valor")
        .eq("clave", "medios_de_pago")
        .single();

      return (data?.valor as string[]) || [];
    },
  });

  const checkAndSyncSubscriptionStatuses =
    async (subs: any[]) => {
      const ahora = new Date();

      const activasEnVivo = subs.filter(
        (sub) =>
          sub.cursos?.modalidad === "en_vivo" &&
          sub.estado === "active"
      );

      const aExpirar = activasEnVivo
        .filter((sub) =>
          estaVencido(sub.fin_en, ahora)
        )
        .map((sub) => sub.id);

      if (aExpirar.length === 0) return;

      const { error } = await supabase
        .from("suscripciones")
        .update({
          estado: "pago_pendiente",
        })
        .in("id", aExpirar);

      if (error) {
        console.error(
          "No se pudieron sincronizar suscripciones vencidas:",
          error
        );
        return;
      }

      queryClient.invalidateQueries({
        queryKey: ["all-subscriptions"],
      });
    };

  const { data: subscriptions } = useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select(`
          *,
          perfiles:usuario_id (
            nombre_completo,
            email
          ),
          cursos:curso_id (
            titulo,
            modalidad,
            fecha_inicio,
            precio,
            moneda,
            tipo_precio,
            cotizacion_ars
          )
        `)
        .order("creado_en", {
          ascending: false,
        });

      if (error) throw error;

      if (data) {
        void checkAndSyncSubscriptionStatuses(
          data
        );
      }

      return data || [];
    },
  });

  const filteredSubs = useMemo(() => {
    if (!subscriptions) return [];

    return subscriptions
      .filter((sub: any) => {
        const fullName = (
          sub.perfiles?.nombre_completo || ""
        ).toLowerCase();

        const email = (
          sub.perfiles?.email || ""
        ).toLowerCase();

        const courseTitle = (
          sub.cursos?.titulo || ""
        ).toLowerCase();

        const searchTerm =
          search.toLowerCase();

        const matchesSearch =
          fullName.includes(searchTerm) ||
          email.includes(searchTerm) ||
          courseTitle.includes(searchTerm);

        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "suspendida"
            ? !!sub.suspendida_en
            : !sub.suspendida_en && sub.estado === statusFilter;

        const matchesTab =
          (sub.cursos?.modalidad ||
            "en_vivo") === tab;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesTab
        );
      })
      // Prioridad de alarma: los pagos diferidos vencidos primero, después los
      // que están por vencer; el resto por fecha de creación (más nuevo arriba).
      .sort((a: any, b: any) => {
        const prio = (s: any) => {
          if (s.suspendida_en) return 3;
          if (s.estado !== "pago_diferido") return 2;
          if (diferidoVencido(s.pago_diferido_hasta)) return 0;
          if (diferidoPorVencer(s.pago_diferido_hasta)) return 1;
          return 2;
        };
        const pa = prio(a);
        const pb = prio(b);
        if (pa !== pb) return pa - pb;
        return (
          new Date(b.creado_en).getTime() -
          new Date(a.creado_en).getTime()
        );
      });
  }, [
    subscriptions,
    search,
    statusFilter,
    tab,
  ]);

  const countEnVivo = useMemo(
    () =>
      (subscriptions || []).filter(
        (s: any) =>
          (s.cursos?.modalidad ||
            "en_vivo") === "en_vivo"
      ).length,
    [subscriptions]
  );

  const countGrabado = useMemo(
    () =>
      (subscriptions || []).filter(
        (s: any) =>
          s.cursos?.modalidad === "grabado"
      ).length,
    [subscriptions]
  );

  const selectedCourse = useMemo(
    () =>
      courses?.find(
        (course: any) =>
          course.id === form.curso_id
      ),
    [courses, form.curso_id]
  );

  const abrirPago = (sub?: any) => {
    setEditingId(null);

    if (sub) {
      setForm({
        usuario_id: sub.usuario_id,
        curso_id: sub.curso_id,
        price: String(precioCursoArs(sub.cursos) ?? ""),
        proveedor_pago:
          sub.proveedor_pago || "",
        estado: sub.estado,
      });
    } else {
      setForm({
        usuario_id: "",
        curso_id: "",
        price: "",
        proveedor_pago: "",
        estado: "pago_pendiente",
      });
    }

    setOpen(true);
  };

  const handleEdit = (sub: any) => {
    setEditingId(sub.id);

    setForm({
      usuario_id: sub.usuario_id,
      curso_id: sub.curso_id,
      price:
        sub.price != null
          ? String(sub.price)
          : "",
      proveedor_pago:
        sub.proveedor_pago || "",
      estado: sub.estado,
    });

    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);

    setForm({
      usuario_id: "",
      curso_id: "",
      price: "",
      proveedor_pago: "",
      estado: "pago_pendiente",
    });
  };

  const registrarPagoMutation =
    useMutation({
      mutationFn: async () => {
        if (!form.usuario_id) {
          throw new Error(
            "Seleccioná un alumno."
          );
        }

        if (!form.curso_id) {
          throw new Error(
            "Seleccioná un curso."
          );
        }

        const monto =
          Number(form.price);

        const montoEsperado = precioCursoArs(selectedCourse);

        if (
          !Number.isFinite(monto) ||
          monto <= 0
        ) {
          throw new Error(
            "Ingresá un monto válido."
          );
        }

        if (montoEsperado == null) {
          throw new Error(
            "El curso no tiene un precio válido configurado."
          );
        }

        if (Math.abs(monto - montoEsperado) > 0.009) {
          throw new Error(
            `El pago debe ser exactamente $${montoEsperado.toLocaleString("es-AR")} ARS.`
          );
        }

        // RPC creada en Supabase.
        //
        // Hace todo en una sola transacción:
        // 1. busca la suscripción existente;
        // 2. la reutiliza, NO crea duplicados;
        // 3. pasa a active;
        // 4. el trigger calcula las fechas si es en vivo;
        // 5. registra el pago en public.pagos.
        const { error } = await supabase.rpc(
          "registrar_pago_suscripcion",
          {
            p_usuario_id:
              form.usuario_id,
            p_curso_id:
              form.curso_id,
            p_monto: monto,
            p_proveedor_pago:
              form.proveedor_pago ||
              null,
          }
        );

        if (error) throw error;
      },

      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [
            "all-subscriptions",
          ],
        });

        queryClient.invalidateQueries({
          queryKey: [
            "all-enrollments-with-subs",
          ],
        });

        queryClient.invalidateQueries({
          queryKey: ["pagos"],
        });

        queryClient.invalidateQueries({
          queryKey: ["payment-status"],
        });

        queryClient.invalidateQueries({
          queryKey: [
            "student-courses-progress",
          ],
        });

        toast.success(
          "Pago registrado y acceso actualizado"
        );

        handleClose();
      },

      onError: (e: any) => {
        toast.error(e.message);
      },
    });

  const editarMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;

      const { error } = await supabase
        .from("suscripciones")
        .update({
          price:
            form.price !== ""
              ? Number(form.price)
              : null,
          proveedor_pago:
            form.proveedor_pago ||
            null,
        })
        .eq("id", editingId);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["all-subscriptions"],
      });

      queryClient.invalidateQueries({
        queryKey: [
          "all-enrollments-with-subs",
        ],
      });

      queryClient.invalidateQueries({
        queryKey: ["payment-status"],
      });

      toast.success(
        "Suscripción actualizada"
      );

      handleClose();
    },

    onError: (e: any) => {
      toast.error(e.message);
    },
  });

  const submitForm = () => {
    if (editingId) {
      editarMutation.mutate();
    } else {
      registrarPagoMutation.mutate();
    }
  };

  const invalidarSuscripciones = () => {
    queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
    queryClient.invalidateQueries({ queryKey: ["payment-status"] });
    queryClient.invalidateQueries({ queryKey: ["student-courses-progress"] });
    queryClient.invalidateQueries({ queryKey: ["diferidos-vencidos-count"] });
    queryClient.invalidateQueries({ queryKey: ["admin-master-stats"] });
  };

  // Habilitar o extender un pago diferido: en ambos casos la RPC crea o reutiliza
  // la suscripción y le deja el estado 'pago_diferido' con la nueva fecha.
  const diferidoMutation = useMutation({
    mutationFn: async () => {
      if (!diferido) return;
      if (!diferido.fecha) {
        throw new Error("Elegí la fecha comprometida de pago.");
      }
      const { error } = await supabase.rpc("habilitar_pago_diferido", {
        p_usuario_id: diferido.sub.usuario_id,
        p_curso_id: diferido.sub.curso_id,
        p_fecha_limite: diferido.fecha,
        p_nota: diferido.nota || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarSuscripciones();
      toast.success(
        diferido?.sub?.estado === "pago_diferido"
          ? "Pago diferido extendido"
          : "Pago diferido habilitado — acceso concedido"
      );
      setDiferido(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const suspensionMutation = useMutation({
    mutationFn: async () => {
      if (!confirmSuspension) return;
      const { sub, suspender } = confirmSuspension;
      const { error } = await supabase
        .from("suscripciones")
        .update({
          suspendida_en: suspender ? new Date().toISOString() : null,
        })
        .eq("id", sub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarSuscripciones();
      toast.success(
        confirmSuspension?.suspender
          ? "Suscripción suspendida — el alumno perdió el acceso al curso"
          : "Suscripción reactivada — el alumno recuperó el acceso"
      );
      setConfirmSuspension(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor: Record<
    EstadoSuscripcionDisplay,
    string
  > = {
    activa:
      "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900",
    pago_pendiente:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    pago_diferido:
      "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900",
    suspendida:
      "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
    vencida:
      "bg-muted text-muted-foreground border-border",
    cancelada:
      "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
  };

  const statusLabel: Record<
    EstadoSuscripcionDisplay,
    string
  > = {
    activa: "AL DÍA",
    pago_pendiente:
      "PAGO PENDIENTE",
    pago_diferido: "PAGO DIFERIDO",
    suspendida: "SUSPENDIDA",
    vencida: "VENCIDA",
    cancelada: "CANCELADA",
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Panel de Suscripciones
            </h1>

            <p className="text-muted-foreground">
              Gestión de pagos y accesos
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              asChild
            >
              <a
                href="https://myaccount.payoneer.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Wallet className="w-4 h-4 mr-2" />

                Payoneer

                <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
              </a>
            </Button>

            <Dialog
              open={open}
              onOpenChange={(value) => {
                if (value) {
                  setOpen(true);
                } else {
                  handleClose();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={() =>
                    abrirPago()
                  }
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Cargar Pago
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingId
                      ? "Editar suscripción"
                      : "Registrar pago"}
                  </DialogTitle>

                  <DialogDescription>
                    {editingId
                      ? "Corrección administrativa del registro."
                      : "El pago habilita o renueva automáticamente el acceso."}
                  </DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitForm();
                  }}
                  className="space-y-4 pt-4"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Alumno</Label>

                      <Select
                        value={
                          form.usuario_id
                        }
                        onValueChange={(
                          value
                        ) =>
                          setForm({
                            ...form,
                            usuario_id:
                              value,
                          })
                        }
                        disabled={
                          !!editingId
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar alumno" />
                        </SelectTrigger>

                        <SelectContent>
                          {students?.map(
                            (student: any) => (
                              <SelectItem
                                key={
                                  student.id
                                }
                                value={
                                  student.id
                                }
                              >
                                {student.nombre_completo ||
                                  "Sin nombre"}{" "}
                                —{" "}
                                {student.email}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>Curso</Label>

                      <Select
                        value={
                          form.curso_id
                        }
                        onValueChange={(
                          value
                        ) => {
                          const curso =
                            courses?.find(
                              (
                                c: any
                              ) =>
                                c.id ===
                                value
                            );

                          setForm({
                            ...form,
                            curso_id:
                              value,
                            price:
                              String(
                                precioCursoArs(
                                  curso
                                ) ?? ""
                              ),
                          });
                        }}
                        disabled={
                          !!editingId
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar curso" />
                        </SelectTrigger>

                        <SelectContent>
                          {courses?.map(
                            (course: any) => (
                              <SelectItem
                                key={
                                  course.id
                                }
                                value={
                                  course.id
                                }
                              >
                                {course.titulo}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {course.modalidad === "grabado"
                                    ? "· grabado"
                                    : "· en vivo"}
                                </span>
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {!editingId &&
                      selectedCourse
                        ?.modalidad ===
                        "en_vivo" && (
                        <div className="col-span-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3 text-sm">
                          <p className="font-semibold">
                            Ciclo de
                            suscripción
                          </p>

                          {selectedCourse.fecha_inicio ? (
                            <p className="text-muted-foreground mt-1">
                              El ciclo está
                              anclado al{" "}
                              <strong>
                                {
                                  selectedCourse.fecha_inicio
                                }
                              </strong>
                              . Las fechas
                              se calculan
                              automáticamente
                              al registrar el
                              pago.
                            </p>
                          ) : (
                            <p className="text-amber-700 dark:text-amber-400 mt-1">
                              Este curso no
                              tiene fecha de
                              inicio cargada.
                              Conviene
                              configurarla
                              antes de
                              registrar
                              nuevas
                              mensualidades.
                            </p>
                          )}
                        </div>
                      )}

                    <div className="space-y-2">
                      <Label>
                        {editingId ? "Monto" : "Monto exacto (ARS)"}
                      </Label>

                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.price}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            price:
                              e.target
                                .value,
                          })
                        }
                        readOnly={!editingId}
                      />
                      {!editingId && selectedCourse && (
                        <p className="text-xs text-muted-foreground">
                          USD {Number(selectedCourse.precio || 0).toLocaleString("es-AR")} × ${Number(selectedCourse.cotizacion_ars || ARS_FIXED_RATE).toLocaleString("es-AR")} por USD. El importe se valida también en Supabase.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Medio de pago
                      </Label>

                      <Select
                        value={
                          form.proveedor_pago
                        }
                        onValueChange={(
                          value
                        ) =>
                          setForm({
                            ...form,
                            proveedor_pago:
                              value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>

                        <SelectContent>
                          {mediosDePago?.map(
                            (
                              medio: string
                            ) => (
                              <SelectItem
                                key={
                                  medio
                                }
                                value={
                                  medio
                                }
                              >
                                {medio}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>

                  {!editingId && (
                    <CurrencyConverter
                      compact
                      className="border-none shadow-none bg-muted/30"
                    />
                  )}

                  <Button
                    type="submit"
                    className="w-full gradient-primary text-primary-foreground"
                    disabled={
                      registrarPagoMutation.isPending ||
                      editarMutation.isPending
                    }
                  >
                    {editingId
                      ? "Guardar cambios"
                      : "Registrar pago y habilitar acceso"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() =>
              setTab("en_vivo")
            }
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
            onClick={() =>
              setTab("grabado")
            }
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "grabado"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Grabados ({countGrabado})
          </button>
        </div>

        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

              <Input
                placeholder="Buscar por alumno, email o curso..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />

              <Select
                value={statusFilter}
                onValueChange={
                  setStatusFilter
                }
              >
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    Todos los estados
                  </SelectItem>

                  <SelectItem value="active">
                    Al día
                  </SelectItem>

                  <SelectItem value="pago_pendiente">
                    Pago pendiente
                  </SelectItem>

                  <SelectItem value="pago_diferido">
                    Pago diferido
                  </SelectItem>

                  <SelectItem value="suspendida">
                    Suspendidas
                  </SelectItem>

                  <SelectItem value="expired">
                    Expirados
                  </SelectItem>

                  <SelectItem value="cancelled">
                    Cancelados
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {filteredSubs.map(
            (sub: any) => {
              const esGrabado =
                sub.cursos
                  ?.modalidad ===
                "grabado";

              const display =
                estadoSuscripcionDisplay(
                  sub
                );

              const isNearExp =
                !esGrabado &&
                sub.estado ===
                  "active" &&
                estaPorVencer(
                  sub.fin_en
                );

              const suspendida = !!sub.suspendida_en;
              const esDiferido =
                sub.estado === "pago_diferido" &&
                !suspendida;
              const diferidoVenc =
                esDiferido &&
                diferidoVencido(sub.pago_diferido_hasta);
              const diferidoPronto =
                esDiferido &&
                !diferidoVenc &&
                diferidoPorVencer(sub.pago_diferido_hasta);

              return (
                <Card
                  key={sub.id}
                  className={`overflow-hidden transition-all shadow-card ${
                    diferidoVenc
                      ? "border-red-500 ring-1 ring-red-500"
                      : isNearExp || diferidoPronto
                      ? "border-amber-500 ring-1 ring-amber-500"
                      : ""
                  }`}
                >
                  <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg">
                          {
                            sub
                              .perfiles
                              ?.nombre_completo
                          }
                        </h3>

                        <span className="text-sm text-muted-foreground">
                          {
                            sub
                              .perfiles
                              ?.email
                          }
                        </span>

                        <Badge
                          variant="outline"
                          className={
                            statusColor[
                              display
                            ]
                          }
                        >
                          {display ===
                            "activa" &&
                          esGrabado
                            ? "COMPRADO"
                            : statusLabel[
                                display
                              ]}
                        </Badge>

                        {isNearExp && (
                          <Badge className="bg-amber-500 text-white border-none animate-pulse">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            COBRAR PRONTO
                          </Badge>
                        )}

                        {esDiferido && (
                          <Badge
                            className={`border-none ${
                              diferidoVenc
                                ? "bg-red-600 text-white animate-pulse"
                                : diferidoPronto
                                ? "bg-amber-500 text-white animate-pulse"
                                : "bg-indigo-500 text-white"
                            }`}
                          >
                            <CalendarClock className="w-3 h-3 mr-1" />
                            {diferidoVenc
                              ? "DIFERIDO VENCIDO"
                              : "PAGA"}{" "}
                            {sub.pago_diferido_hasta
                              ? format(
                                  parseISO(sub.pago_diferido_hasta),
                                  "dd/MM"
                                )
                              : ""}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        <BookOpen className="w-4 h-4" />

                        {sub.cursos
                          ?.titulo ||
                          "Curso eliminado"}

                        <span className="text-foreground font-bold ml-2">
                          {sub.price !=
                          null
                            ? `$${sub.price}`
                            : "Sin monto cargado"}
                        </span>

                        {sub.proveedor_pago && (
                          <Badge
                            variant="outline"
                            className="gap-1 font-normal text-muted-foreground"
                          >
                            <Wallet className="w-3 h-3" />

                            {
                              sub.proveedor_pago
                            }
                          </Badge>
                        )}
                      </p>

                      <p className="text-[11px] text-muted-foreground mt-2">
                        Solicitud /
                        suscripción
                        creada:{" "}
                        {sub.creado_en
                          ? format(
                              parseISO(
                                sub.creado_en
                              ),
                              "dd/MM/yyyy HH:mm"
                            )
                          : "-"}
                      </p>
                    </div>

                    {esGrabado ? (
                      <div className="text-sm border-l border-r px-6 border-muted">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Compra
                          </span>

                          <span className="font-medium">
                            {sub.estado ===
                            "active"
                              ? sub.inicio_en
                                ? format(
                                    parseISO(
                                      sub.inicio_en
                                    ),
                                    "dd/MM/yyyy"
                                  )
                                : "-"
                              : "Pendiente"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm border-l border-r px-6 border-muted">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Inicio período
                          </span>

                          <span className="font-medium">
                            {sub.inicio_en
                              ? format(
                                  parseISO(
                                    sub.inicio_en
                                  ),
                                  "dd/MM/yyyy"
                                )
                              : "Pendiente"}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Próx. pago
                          </span>

                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {sub.proxima_fecha_pago
                              ? format(
                                  parseISO(
                                    sub.proxima_fecha_pago
                                  ),
                                  "dd/MM/yyyy"
                                )
                              : "-"}
                          </span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Acceso hasta
                          </span>

                          <span
                            className={
                              display ===
                              "vencida"
                                ? "text-destructive font-bold"
                                : "font-bold"
                            }
                          >
                            {sub.fin_en
                              ? format(
                                  parseISO(
                                    sub.fin_en
                                  ),
                                  "dd/MM/yyyy"
                                )
                              : esDiferido
                              ? "Sin corte (diferido)"
                              : "-"}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {(sub.estado ===
                        "pago_pendiente" ||
                        sub.estado ===
                          "pago_diferido") && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() =>
                            abrirPago(
                              sub
                            )
                          }
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Registrar pago
                        </Button>
                      )}

                      {!esGrabado &&
                        sub.estado ===
                          "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/40 border-green-200 dark:border-green-900"
                            onClick={() =>
                              abrirPago(
                                sub
                              )
                            }
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Registrar mensualidad
                          </Button>
                        )}

                      {/* Pago diferido: habilitar (desde pendiente/al día) o extender la fecha. Solo cursos en vivo. */}
                      {!esGrabado &&
                        !suspendida &&
                        (sub.estado ===
                          "pago_pendiente" ||
                          sub.estado ===
                            "active" ||
                          sub.estado ===
                            "pago_diferido") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                            onClick={() =>
                              setDiferido({
                                sub,
                                fecha:
                                  sub.pago_diferido_hasta
                                    ? String(
                                        sub.pago_diferido_hasta
                                      ).slice(0, 10)
                                    : "",
                                nota:
                                  sub.nota_admin || "",
                              })
                            }
                          >
                            <CalendarClock className="w-4 h-4 mr-2" />
                            {sub.estado ===
                            "pago_diferido"
                              ? "Extender diferido"
                              : "Pago diferido"}
                          </Button>
                        )}

                      {/* Suspender / reactivar. Solo cursos en vivo con acceso concedido. */}
                      {!esGrabado &&
                        (suspendida ||
                          sub.estado ===
                            "active" ||
                          sub.estado ===
                            "pago_diferido") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={
                              suspendida
                                ? "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                : "text-red-600 dark:text-red-400 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40"
                            }
                            onClick={() =>
                              setConfirmSuspension({
                                sub,
                                suspender:
                                  !suspendida,
                              })
                            }
                          >
                            {suspendida ? (
                              <>
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Reactivar
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-4 h-4 mr-2" />
                                Suspender
                              </>
                            )}
                          </Button>
                        )}

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Mandar mensaje"
                        onClick={() =>
                          navigate(
                            `/messages?with=${sub.usuario_id}&curso=${sub.curso_id}`
                          )
                        }
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() =>
                          handleEdit(
                            sub
                          )
                        }
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            }
          )}

          {filteredSubs.length === 0 && (
            <div className="p-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />

              <p className="text-muted-foreground">
                No se encontraron
                suscripciones con esos
                criterios.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pago diferido: habilitar o extender */}
      <Dialog
        open={!!diferido}
        onOpenChange={(v) => {
          if (!v) setDiferido(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {diferido?.sub?.estado === "pago_diferido"
                ? "Extender pago diferido"
                : "Habilitar pago diferido"}
            </DialogTitle>
            <DialogDescription>
              {diferido?.sub?.perfiles?.nombre_completo} —{" "}
              {diferido?.sub?.cursos?.titulo}. Le damos acceso al curso ahora y
              anotamos la fecha que se comprometió a pagar. El acceso no se corta
              solo: si no paga, usá "Suspender".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Fecha comprometida de pago</Label>
              <Input
                type="date"
                min={hoyISODate()}
                value={diferido?.fecha || ""}
                onChange={(e) =>
                  setDiferido((d) =>
                    d ? { ...d, fecha: e.target.value } : d
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Ej: arregló pagar el 5 por transferencia"
                value={diferido?.nota || ""}
                onChange={(e) =>
                  setDiferido((d) =>
                    d ? { ...d, nota: e.target.value } : d
                  )
                }
              />
            </div>

            <Button
              className="w-full gradient-primary text-primary-foreground"
              disabled={diferidoMutation.isPending}
              onClick={() => diferidoMutation.mutate()}
            >
              {diferido?.sub?.estado === "pago_diferido"
                ? "Guardar nueva fecha"
                : "Habilitar acceso con pago diferido"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmación de suspender / reactivar */}
      <AlertDialog
        open={!!confirmSuspension}
        onOpenChange={(v) => {
          if (!v) setConfirmSuspension(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmSuspension?.suspender
                ? "¿Suspender la suscripción?"
                : "¿Reactivar la suscripción?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSuspension?.suspender
                ? `${confirmSuspension?.sub?.perfiles?.nombre_completo} va a perder el acceso a "${confirmSuspension?.sub?.cursos?.titulo}" hasta que lo reactives. No se pierde ningún dato: la suscripción y las fechas quedan igual.`
                : `${confirmSuspension?.sub?.perfiles?.nombre_completo} recupera el acceso a "${confirmSuspension?.sub?.cursos?.titulo}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmSuspension?.suspender
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
              onClick={(e) => {
                e.preventDefault();
                suspensionMutation.mutate();
              }}
              disabled={suspensionMutation.isPending}
            >
              {confirmSuspension?.suspender ? "Suspender" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminSubscriptions;
