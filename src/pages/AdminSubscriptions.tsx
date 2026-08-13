import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Plus, Search, Filter, Calendar, Edit2, RefreshCw, AlertTriangle, MessageSquare, Wallet, ExternalLink } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";
import CurrencyConverter from "@/components/CurrencyConverter";
import { estaVencido, estaPorVencer, estadoSuscripcionDisplay, type EstadoSuscripcionDisplay } from "@/lib/paymentCutoff";

const AdminSubscriptions = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados para filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState<"en_vivo" | "grabado">("en_vivo");
  
  const [form, setForm] = useState({
    usuario_id: "",
    curso_id: "",
    nombre_plan: "Mensual",
    price: "",
    estado: "active",
    inicio_en: format(new Date(), "yyyy-MM-dd"),
    proxima_fecha_pago: "",
    fin_en: "",
    proveedor_pago: "",
  });

  // Registra un pago en el ledger histórico (tabla "pagos"), snapshoteando
  // los costos fijos vigentes en este momento — así un cambio futuro en la
  // configuración financiera no altera retroactivamente meses ya cerrados.
  const registrarPago = async ({
    usuario_id,
    curso_id,
    suscripcion_id,
    monto,
  }: {
    usuario_id: string;
    curso_id: string;
    suscripcion_id: string;
    monto: number;
  }) => {
    const { data: config } = await supabase.from("configuracion_financiera").select("*").single();
    const { error } = await supabase.from("pagos").insert({
      usuario_id,
      curso_id,
      suscripcion_id,
      monto,
      costo_publicidad_ars: config?.costo_publicidad_ars ?? 5000,
      costo_plataforma_ars: config?.costo_plataforma_ars ?? 4500,
    });
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["pagos"] });
  };

  // --- LÓGICA DE SINCRONIZACIÓN AUTOMÁTICA DE ESTADOS POR FECHA ---
  // Una suscripción "en vivo" recorre 3 estados según sus propias fechas
  // (las mismas que se editan acá como "Próx. Cobro" y "Vence Acceso"):
  //   active --(pasó proxima_fecha_pago)--> pago_pendiente --(pasó fin_en)--> expired
  // CourseView hace el mismo chequeo de fin_en en vivo (ver paymentCutoff.ts),
  // así que el corte real de acceso no depende de que este panel se haya
  // abierto — esto solo mantiene "estado" al día para mostrarlo bien acá y
  // en "Mi Suscripción".
  //
  // Si "proxima_fecha_pago"/"fin_en" están vacíos (por ejemplo, una
  // suscripción creada al aprobar una solicitud sin fechas cargadas) no se
  // mueve sola: hay que asignarle fechas a mano para que esta regla aplique.
  //
  // Esto SOLO aplica a cursos en_vivo: los grabados se compran una sola vez
  // (sin pago recurrente), así que no tiene sentido exigirles vencimiento
  // mensual — si se les aplicara esta regla, perderían el acceso al mes de
  // haber comprado, aunque ya hayan pagado todo el curso.
  const checkAndSyncSubscriptionStatuses = async (subs: any[]) => {
    const ahora = new Date();
    const enVivoActivas = subs.filter((sub) => sub.cursos?.modalidad === "en_vivo" && (sub.estado === "active" || sub.estado === "pago_pendiente"));

    const aExpirar = enVivoActivas.filter((sub) => estaVencido(sub.fin_en, ahora)).map((s) => s.id);
    const aPagoPendiente = enVivoActivas
      .filter((sub) => sub.estado === "active" && !estaVencido(sub.fin_en, ahora) && sub.proxima_fecha_pago && new Date(sub.proxima_fecha_pago) <= ahora)
      .map((s) => s.id);

    if (aExpirar.length > 0) {
      await supabase.from("suscripciones").update({ estado: 'expired' }).in("id", aExpirar);
    }
    if (aPagoPendiente.length > 0) {
      await supabase.from("suscripciones").update({ estado: 'pago_pendiente' }).in("id", aPagoPendiente);
    }
    if (aExpirar.length > 0 || aPagoPendiente.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
    }
  };

  // Queries
  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("roles_usuario").select("usuario_id").eq("rol", "student");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("perfiles")
        .select("*")
        .in("id", roles.map((r) => r.usuario_id))
        .eq("activo", true)
        .order("nombre_completo");
      return profiles || [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, titulo").order("titulo");
      return data || [];
    },
  });

  // Mismos medios de pago que el admin configura en Cursos ("Medios de
  // Pago") — así el select queda consistente con lo que ya se le muestra al
  // alumno, en vez de que cada admin tipee el nombre distinto cada vez.
  const { data: mediosDePago } = useQuery({
    queryKey: ["config-medios-pago"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracion_global").select("valor").eq("clave", "medios_de_pago").single();
      return (data?.valor as string[]) || [];
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("*, perfiles:usuario_id(nombre_completo, email), cursos:curso_id(titulo, modalidad)")
        .order("creado_en", { ascending: false });
      
      if (error) throw error;
      if (data) checkAndSyncSubscriptionStatuses(data);
      return data || [];
    },
  });

  // --- LÓGICA DE FILTRADO ---
  const filteredSubs = useMemo(() => {
    if (!subscriptions) return [];

    return subscriptions.filter((sub: any) => {
      const fullName = (sub.perfiles?.nombre_completo || "").toLowerCase();
      const email = (sub.perfiles?.email || "").toLowerCase();
      const courseTitle = (sub.cursos?.titulo || "").toLowerCase();
      const searchTerm = search.toLowerCase();

      const matchesSearch = fullName.includes(searchTerm) || email.includes(searchTerm) || courseTitle.includes(searchTerm);
      const matchesStatus = statusFilter === "all" || sub.estado === statusFilter;
      const matchesTab = (sub.cursos?.modalidad || "en_vivo") === tab;

      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [subscriptions, search, statusFilter, tab]);

  const countEnVivo = useMemo(
    () => (subscriptions || []).filter((s: any) => (s.cursos?.modalidad || "en_vivo") === "en_vivo").length,
    [subscriptions]
  );
  const countGrabado = useMemo(
    () => (subscriptions || []).filter((s: any) => s.cursos?.modalidad === "grabado").length,
    [subscriptions]
  );

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        usuario_id: form.usuario_id,
        curso_id: form.curso_id,
        nombre_plan: form.nombre_plan,
        price: parseFloat(form.price) || 0,
        estado: form.estado,
        inicio_en: new Date(form.inicio_en).toISOString(),
        proxima_fecha_pago: form.proxima_fecha_pago ? new Date(form.proxima_fecha_pago).toISOString() : null,
        fin_en: form.fin_en ? new Date(form.fin_en).toISOString() : null,
        proveedor_pago: form.proveedor_pago.trim() || null,
      };

      // Si estamos creando una suscripción activa nueva, chequeamos antes que no
      // haya ya otra activa para el mismo alumno + curso (la base también lo
      // impide con una restricción, pero acá damos un mensaje más claro).
      if (!editingId && (form.estado === "active" || form.estado === "pago_pendiente")) {
        const { data: existente } = await supabase
          .from("suscripciones")
          .select("id")
          .eq("usuario_id", form.usuario_id)
          .eq("curso_id", form.curso_id)
          .in("estado", ["active", "pago_pendiente"])
          .maybeSingle();
        if (existente) {
          throw new Error("Este alumno ya tiene una suscripción activa a este curso.");
        }
      }

      if (editingId) {
        const { error } = await supabase.from("suscripciones").update(payload).eq("id", editingId);
        if (error) throw error;
        // Una edición es una corrección administrativa, no un pago nuevo —
        // no se registra en el ledger de "pagos".
      } else {
        const { data: nueva, error } = await supabase.from("suscripciones").insert(payload).select("id").single();
        if (error) throw error;
        if (form.estado === "active" && nueva) {
          await registrarPago({
            usuario_id: payload.usuario_id,
            curso_id: payload.curso_id,
            suscripcion_id: nueva.id,
            monto: payload.price,
          });
        }
      }
      // Nota: no hace falta crear la inscripción a mano acá. El trigger
      // "on_suscripcion_activa" en la base la asegura automáticamente
      // cuando la suscripción queda "active".
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
      toast.success(editingId ? "Suscripción actualizada" : "Pago registrado");
      handleClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleQuickRenew = async (sub: any) => {
    const newStarts = new Date().toISOString();
    const newNextPayment = addDays(new Date(), 25).toISOString();
    const newEnds = addDays(new Date(), 30).toISOString();

    const { error } = await supabase
      .from("suscripciones")
      .update({
        estado: 'active',
        inicio_en: newStarts,
        proxima_fecha_pago: newNextPayment,
        fin_en: newEnds
      })
      .eq("id", sub.id);

    if (error) {
      toast.error("Error al renovar");
      return;
    }

    try {
      await registrarPago({
        usuario_id: sub.usuario_id,
        curso_id: sub.curso_id,
        suscripcion_id: sub.id,
        monto: sub.price || 0,
      });
    } catch (e: any) {
      toast.error("La suscripción se renovó, pero no se pudo registrar el pago en Finanzas: " + e.message);
    }

    queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
    queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
    toast.success("Mensualidad renovada (30 días añadidos)");
  };

  const handleEdit = (sub: any) => {
    setEditingId(sub.id);
    setForm({
      usuario_id: sub.usuario_id,
      curso_id: sub.curso_id,
      nombre_plan: sub.nombre_plan,
      price: sub.price != null ? sub.price.toString() : "",
      estado: sub.estado,
      inicio_en: sub.inicio_en ? format(parseISO(sub.inicio_en), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      proxima_fecha_pago: sub.proxima_fecha_pago ? format(parseISO(sub.proxima_fecha_pago), "yyyy-MM-dd") : "",
      fin_en: sub.fin_en ? format(parseISO(sub.fin_en), "yyyy-MM-dd") : "",
      proveedor_pago: sub.proveedor_pago || "",
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
    setForm({ usuario_id: "", curso_id: "", nombre_plan: "Mensual", price: "", estado: "active", inicio_en: format(new Date(), "yyyy-MM-dd"), proxima_fecha_pago: "", fin_en: "", proveedor_pago: "" });
  };

  const statusColor: Record<EstadoSuscripcionDisplay, string> = {
    activa: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900",
    pago_pendiente: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900",
    vencida: "bg-muted text-muted-foreground border-border",
    cancelada: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
  };

  const statusLabel: Record<EstadoSuscripcionDisplay, string> = {
    activa: "AL DÍA",
    pago_pendiente: "PAGO PENDIENTE",
    vencida: "VENCIDA",
    cancelada: "CANCELADA",
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Panel de Suscripciones</h1>
            <p className="text-muted-foreground">Gestión manual de pagos y accesos</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <a href="https://myaccount.payoneer.com/" target="_blank" rel="noopener noreferrer">
                <Wallet className="w-4 h-4 mr-2" /> Payoneer <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60" />
              </a>
            </Button>
            <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" /> Cargar Pago Nuevo
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Registro" : "Registrar Pago"}</DialogTitle>
                <DialogDescription>Suscripción, monto y medio de pago del alumno</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); upsertMutation.mutate(); }} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Alumno</Label>
                    <Select value={form.usuario_id} onValueChange={(v) => setForm({ ...form, usuario_id: v })} disabled={!!editingId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar alumno" /></SelectTrigger>
                      <SelectContent>
                        {students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre_completo || "Sin nombre"} — {s.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Curso</Label>
                    <Select value={form.curso_id} onValueChange={(v) => setForm({ ...form, curso_id: v })} disabled={!!editingId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                      <SelectContent>
                        {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Inicio</Label>
                    <Input type="date" value={form.inicio_en} onChange={(e) => setForm({ ...form, inicio_en: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vence Acceso</Label>
                    <Input type="date" value={form.fin_en} onChange={(e) => setForm({ ...form, fin_en: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Próx. Cobro</Label>
                    <Input type="date" value={form.proxima_fecha_pago} onChange={(e) => setForm({ ...form, proxima_fecha_pago: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto ($)</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Medio de pago</Label>
                    <Select value={form.proveedor_pago} onValueChange={(v) => setForm({ ...form, proveedor_pago: v })}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar medio de pago" /></SelectTrigger>
                      <SelectContent>
                        {mediosDePago?.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        {!mediosDePago?.length && (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">
                            No hay medios de pago configurados — cargalos en "Cursos → Medios de Pago".
                          </p>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Estado Manual</Label>
                    <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo (Pagado)</SelectItem>
                        <SelectItem value="pago_pendiente">Pago pendiente</SelectItem>
                        <SelectItem value="expired">Expirado (Deuda)</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <CurrencyConverter compact className="border-none shadow-none bg-muted/30" />
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={upsertMutation.isPending}>
                  {editingId ? "Actualizar Registro" : "Guardar Pago"}
                </Button>
              </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs En vivo / Grabados — las suscripciones de un curso en vivo son
            pagos mensuales recurrentes, las de un curso grabado son una
            compra única, así que se gestionan distinto y conviene no
            mezclarlas en la misma lista. */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setTab("en_vivo")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "en_vivo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            En vivo ({countEnVivo})
          </button>
          <button
            type="button"
            onClick={() => setTab("grabado")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "grabado" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Grabados ({countGrabado})
          </button>
        </div>

        {/* BARRA DE FILTROS */}
        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por alumno, email o curso..."
                className="pl-9 bg-background" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Al día</SelectItem>
                  <SelectItem value="pago_pendiente">Pago pendiente</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {filteredSubs.map((sub: any) => {
            const esGrabado = sub.cursos?.modalidad === "grabado";
            const display = estadoSuscripcionDisplay(sub);
            const isNearExp = !esGrabado && sub.estado === 'active' && estaPorVencer(sub.fin_en);

            return (
              <Card key={sub.id} className={`overflow-hidden transition-all shadow-card ${isNearExp ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}>
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">{(sub.perfiles as any)?.nombre_completo}</h3>
                      <span className="text-sm text-muted-foreground">{(sub.perfiles as any)?.email}</span>
                      <Badge variant="outline" className={statusColor[display]}>
                        {display === 'activa' && esGrabado ? 'COMPRADO' : statusLabel[display]}
                      </Badge>
                      {isNearExp && (
                        <Badge className="bg-amber-500 text-white border-none animate-pulse">
                          <AlertTriangle className="w-3 h-3 mr-1" /> COBRAR PRONTO
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <BookOpen className="w-4 h-4" /> {(sub.cursos as any)?.titulo || "Curso eliminado"}
                      <span className="text-foreground font-bold ml-2">
                        {sub.price != null ? `$${sub.price}` : "Sin monto cargado"}
                      </span>
                      {sub.proveedor_pago && (
                        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                          <Wallet className="w-3 h-3" /> {sub.proveedor_pago}
                        </Badge>
                      )}
                    </p>
                  </div>

                  {esGrabado ? (
                    // Compra única: no hay "próximo cobro" ni vencimiento, solo
                    // interesa cuándo se compró.
                    <div className="text-sm border-l border-r px-6 border-muted">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Comprado el</span>
                        <span className="font-medium">{sub.inicio_en ? format(parseISO(sub.inicio_en), "dd/MM/yyyy") : "-"}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm border-l border-r px-6 border-muted">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Inicio</span>
                        <span className="font-medium">{sub.inicio_en ? format(parseISO(sub.inicio_en), "dd/MM/yyyy") : "-"}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Próx. Cobro</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                          {sub.proxima_fecha_pago ? format(parseISO(sub.proxima_fecha_pago), "dd/MM/yyyy") : "-"}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Vencimiento</span>
                        <span className={display === 'vencida' ? 'text-destructive font-bold' : 'font-bold'}>
                          {sub.fin_en ? format(parseISO(sub.fin_en), "dd/MM/yyyy") : "-"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {!esGrabado && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/40 border-green-200 dark:border-green-900"
                        onClick={() => handleQuickRenew(sub)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> Renovar Mes
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-primary/10"
                      title="Mandar mensaje"
                      onClick={() => navigate(`/messages?with=${sub.usuario_id}&curso=${sub.curso_id}`)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-primary/10" onClick={() => handleEdit(sub)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          
          {filteredSubs.length === 0 && (
            <div className="p-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
              <p className="text-muted-foreground">No se encontraron suscripciones con esos criterios.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminSubscriptions;