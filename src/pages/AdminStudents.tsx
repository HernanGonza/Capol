import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Users, BookOpen, Trash2, Calendar, Search, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";

const AdminStudents = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  
  // Estados para filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const { data: enrollments } = useQuery({
    queryKey: ["all-enrollments-with-subs"],
    queryFn: async () => {
      const { data: enr } = await supabase.from("enrollments").select("*, courses(title), profiles:user_id(full_name)");
      const { data: subs } = await supabase.from("subscriptions").select("*");
      return enr?.map(e => ({
        ...e,
        subscription: subs?.find(s => s.user_id === e.user_id && s.course_id === e.course_id)
      })) || [];
    },
  });

  // Lógica de Filtrado y Ordenamiento
  const filteredEnrollments = useMemo(() => {
    if (!enrollments) return [];
    
    return enrollments
      .filter((e: any) => {
        const matchesSearch = (e.profiles?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
                            (e.courses?.title || "").toLowerCase().includes(search.toLowerCase());
        
        const subStatus = e.subscription?.status || "none";
        const matchesStatus = statusFilter === "all" || subStatus === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a: any, b: any) => (a.profiles?.full_name || "").localeCompare(b.profiles?.full_name || ""));
  }, [enrollments, search, statusFilter]);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("enrollments").insert({ user_id: selectedStudent, course_id: selectedCourse });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
      toast.success("Alumno inscripto");
      setOpen(false);
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("enrollments").delete().eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] }),
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Alumnos</h1>
            <p className="text-muted-foreground">Inscripciones y estados de pago</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary"><UserPlus className="w-4 h-4 mr-2" /> Inscribir Alumno</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nueva Inscripción</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar alumno" /></SelectTrigger>
                  <SelectContent>{students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                  <SelectContent>{courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
                <Button className="w-full gradient-primary" onClick={() => enrollMutation.mutate()}>Confirmar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* BARRA DE FILTROS */}
        <Card className="bg-muted/30 border-none shadow-none">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o curso..." 
                className="pl-9 bg-background" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Estado de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Al día</SelectItem>
                  <SelectItem value="expired">Vencidos</SelectItem>
                  <SelectItem value="none">Sin suscripción</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> 
              Alumnos Inscriptos ({filteredEnrollments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredEnrollments.map((e: any) => (
                <div key={e.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-muted/10 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(e.profiles?.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{e.profiles?.full_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {e.courses?.title}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Suscripción</p>
                      {e.subscription?.status === 'active' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">ACTIVA</Badge>
                      ) : e.subscription?.status === 'expired' ? (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">VENCIDA</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">PENDIENTE</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => unenrollMutation.mutate(e.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminStudents;