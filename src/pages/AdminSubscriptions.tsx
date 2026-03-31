import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BookOpen, Plus, Search, Filter, Calendar, Edit2, RefreshCw, AlertTriangle } from "lucide-react";
import { format, isBefore, parseISO, addDays } from "date-fns";

const AdminSubscriptions = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados para filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  const [form, setForm] = useState({ 
    user_id: "", 
    course_id: "", 
    plan_name: "Mensual", 
    price: "", 
    status: "active",
    starts_at: format(new Date(), "yyyy-MM-dd"),
    next_payment_date: "",
    ends_at: ""
  });

  // --- LÓGICA DE AUTO-EXPIRACIÓN ---
  const checkAndExpireSubscriptions = async (subs: any[]) => {
    const now = new Date();
    const toExpire = subs.filter(sub => 
      sub.status === 'active' && 
      sub.ends_at && 
      isBefore(parseISO(sub.ends_at), now)
    );

    if (toExpire.length > 0) {
      const ids = toExpire.map(s => s.id);
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: 'expired' })
        .in("id", ids);
      
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
      }
    }
  };

  // Queries
  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", roles.map((r) => r.user_id));
      return profiles || [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, profiles:user_id(full_name), courses:course_id(title)")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      if (data) checkAndExpireSubscriptions(data);
      return data || [];
    },
  });

  // --- LÓGICA DE FILTRADO ---
  const filteredSubs = useMemo(() => {
    if (!subscriptions) return [];
    
    return subscriptions.filter((sub: any) => {
      const fullName = (sub.profiles?.full_name || "").toLowerCase();
      const courseTitle = (sub.courses?.title || "").toLowerCase();
      const searchTerm = search.toLowerCase();
      
      const matchesSearch = fullName.includes(searchTerm) || courseTitle.includes(searchTerm);
      const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, search, statusFilter]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: form.user_id,
        course_id: form.course_id,
        plan_name: form.plan_name,
        price: parseFloat(form.price) || 0,
        status: form.status,
        starts_at: new Date(form.starts_at).toISOString(),
        next_payment_date: form.next_payment_date ? new Date(form.next_payment_date).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };

      if (editingId) {
        const { error } = await supabase.from("subscriptions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscriptions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
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
      .from("subscriptions")
      .update({
        status: 'active',
        starts_at: newStarts,
        next_payment_date: newNextPayment,
        ends_at: newEnds
      })
      .eq("id", sub.id);

    if (error) {
      toast.error("Error al renovar");
    } else {
      queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
      toast.success("Mensualidad renovada (30 días añadidos)");
    }
  };

  const handleEdit = (sub: any) => {
    setEditingId(sub.id);
    setForm({
      user_id: sub.user_id,
      course_id: sub.course_id,
      plan_name: sub.plan_name,
      price: sub.price.toString(),
      status: sub.status,
      starts_at: sub.starts_at ? format(parseISO(sub.starts_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      next_payment_date: sub.next_payment_date ? format(parseISO(sub.next_payment_date), "yyyy-MM-dd") : "",
      ends_at: sub.ends_at ? format(parseISO(sub.ends_at), "yyyy-MM-dd") : "",
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
    setForm({ user_id: "", course_id: "", plan_name: "Mensual", price: "", status: "active", starts_at: format(new Date(), "yyyy-MM-dd"), next_payment_date: "", ends_at: "" });
  };

  const statusColor: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Panel de Suscripciones</h1>
            <p className="text-muted-foreground">Gestión manual de pagos y accesos</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Cargar Pago Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "Editar Registro" : "Registrar Pago"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); upsertMutation.mutate(); }} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Alumno</Label>
                    <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })} disabled={!!editingId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar alumno" /></SelectTrigger>
                      <SelectContent>
                        {students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Curso</Label>
                    <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })} disabled={!!editingId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                      <SelectContent>
                        {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Inicio</Label>
                    <Input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Vence Acceso</Label>
                    <Input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Próx. Cobro</Label>
                    <Input type="date" value={form.next_payment_date} onChange={(e) => setForm({ ...form, next_payment_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto ($)</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Estado Manual</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo (Pagado)</SelectItem>
                        <SelectItem value="expired">Expirado (Deuda)</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={upsertMutation.isPending}>
                  {editingId ? "Actualizar Registro" : "Guardar Pago"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* BARRA DE FILTROS */}
        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por alumno o curso..." 
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
                  <SelectItem value="expired">Expirados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {filteredSubs.map((sub: any) => {
            const isNearExp = sub.ends_at && sub.status === 'active' && 
                             isBefore(parseISO(sub.ends_at), addDays(new Date(), 3));

            return (
              <Card key={sub.id} className={`overflow-hidden transition-all shadow-card ${isNearExp ? 'border-amber-500 ring-1 ring-amber-500' : ''}`}>
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <h3 className="font-bold text-lg">{(sub.profiles as any)?.full_name}</h3>
                      <Badge variant="outline" className={statusColor[sub.status]}>
                        {sub.status === 'active' ? 'AL DÍA' : sub.status.toUpperCase()}
                      </Badge>
                      {isNearExp && (
                        <Badge className="bg-amber-500 text-white border-none animate-pulse">
                          <AlertTriangle className="w-3 h-3 mr-1" /> COBRAR PRONTO
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> {(sub.courses as any)?.title} 
                      <span className="text-foreground font-bold ml-2">${sub.price}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2 text-sm border-l border-r px-6 border-muted">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Inicio</span>
                      <span className="font-medium">{sub.starts_at ? format(parseISO(sub.starts_at), "dd/MM/yyyy") : "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Próx. Cobro</span>
                      <span className="text-blue-600 font-bold">
                        {sub.next_payment_date ? format(parseISO(sub.next_payment_date), "dd/MM/yyyy") : "-"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Vencimiento</span>
                      <span className={sub.status === 'expired' ? 'text-destructive font-bold' : 'font-bold'}>
                        {sub.ends_at ? format(parseISO(sub.ends_at), "dd/MM/yyyy") : "-"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                      onClick={() => handleQuickRenew(sub)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Renovar Mes
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