import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { CreditCard, Plus } from "lucide-react";

const AdminSubscriptions = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", plan_name: "", price: "", status: "active" });

  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", roles.map((r) => r.user_id));
      return profiles || [];
    },
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("*, profiles:user_id(full_name)");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subscriptions").insert({
        user_id: form.user_id,
        plan_name: form.plan_name,
        price: parseFloat(form.price) || 0,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-subscriptions"] });
      toast.success("Suscripción creada");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusColor: Record<string, string> = {
    active: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive",
    expired: "bg-muted text-muted-foreground",
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Suscripciones</h1>
            <p className="text-muted-foreground">Gestiona planes y pagos (preparado para Mercado Pago)</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Nueva Suscripción
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Suscripción</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Alumno</Label>
                  <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name || s.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Input value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="Ej: Mensual, Anual" required />
                </div>
                <div className="space-y-2">
                  <Label>Precio (ARS)</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={createMutation.isPending}>
                  Crear
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Todas las suscripciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-2">
                {subscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{(sub.profiles as any)?.full_name || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{sub.plan_name} — ${sub.price} {sub.currency}</p>
                    </div>
                    <Badge className={statusColor[sub.status] || ""}>{sub.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay suscripciones</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminSubscriptions;
