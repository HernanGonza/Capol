import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { UserPlus, Users, BookOpen, Trash2, Search, Filter, UserX, UserCheck, GraduationCap, MessageSquare } from "lucide-react";

const AdminStudents = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  // Estados para filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Lista de alumnos (a nivel cuenta, con su estado activo/inactivo)
  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("roles_usuario").select("usuario_id").eq("rol", "student");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("perfiles")
        .select("*")
        .in("id", roles.map((r) => r.usuario_id))
        .order("nombre_completo");
      return profiles || [];
    },
  });

  const activeStudents = useMemo(() => students?.filter((s) => s.activo) || [], [students]);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data } = await supabase.from("cursos").select("id, titulo").order("titulo");
      return data || [];
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["all-enrollments-with-subs"],
    queryFn: async () => {
      const { data: enr } = await supabase.from("inscripciones").select("*, cursos(titulo), perfiles:usuario_id(nombre_completo)");
      const { data: subs } = await supabase.from("suscripciones").select("*");
      return enr?.map(e => ({
        ...e,
        subscription: subs?.find(s => s.usuario_id === e.usuario_id && s.curso_id === e.curso_id)
      })) || [];
    },
  });

  // Lógica de Filtrado y Ordenamiento
  const filteredEnrollments = useMemo(() => {
    if (!enrollments) return [];

    return enrollments
      .filter((e: any) => {
        const matchesSearch = (e.perfiles?.nombre_completo || "").toLowerCase().includes(search.toLowerCase()) ||
                            (e.cursos?.titulo || "").toLowerCase().includes(search.toLowerCase());

        const subStatus = e.subscription?.estado || "none";
        const matchesStatus = statusFilter === "all" || subStatus === statusFilter;

        return matchesSearch && matchesStatus;
      })
      .sort((a: any, b: any) => (a.perfiles?.nombre_completo || "").localeCompare(b.perfiles?.nombre_completo || ""));
  }, [enrollments, search, statusFilter]);

  const enrollMutation = useMutation({
    mutationFn: async () => {
      // Solo creamos la suscripción: un trigger en la base ("on_suscripcion_activa")
      // se encarga de asegurar la inscripción correspondiente automáticamente,
      // así este flujo no puede volver a desincronizarse.
      const { data: existente } = await supabase
        .from("suscripciones")
        .select("id")
        .eq("usuario_id", selectedStudent)
        .eq("curso_id", selectedCourse)
        .eq("estado", "active")
        .maybeSingle();

      if (existente) {
        throw new Error("Este alumno ya tiene una suscripción activa a este curso.");
      }

      const { error: subError } = await supabase.from("suscripciones").insert({
        usuario_id: selectedStudent,
        curso_id: selectedCourse,
        estado: "active",
        nombre_plan: "Manual",
        inicio_en: new Date().toISOString(),
      });
      if (subError) throw subError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
      toast.success("Alumno inscripto y con acceso habilitado");
      setOpen(false);
      setSelectedStudent("");
      setSelectedCourse("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Quitar a un alumno de UN curso puntual: hay que cerrar tanto la inscripción
  // como la suscripción de ese curso, o quedan desincronizadas (el bug original).
  const unenrollMutation = useMutation({
    mutationFn: async (enrollment: any) => {
      const { error: subError } = await supabase
        .from("suscripciones")
        .update({ estado: "expired" })
        .eq("usuario_id", enrollment.usuario_id)
        .eq("curso_id", enrollment.curso_id)
        .eq("estado", "active");
      if (subError) throw subError;

      const { error: enrError } = await supabase.from("inscripciones").delete().eq("id", enrollment.id);
      if (enrError) throw enrError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
      toast.success("Alumno removido de este curso");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Baja lógica de la cuenta del alumno (no un borrado físico): marca "activo = false".
  // Un trigger en la base vence automáticamente todas sus suscripciones activas.
  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from("perfiles").update({ activo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["all-enrollments-with-subs"] });
      toast.success(vars.activo ? "Alumno reactivado" : "Alumno dado de baja (se vencieron sus suscripciones activas)");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Convertir la cuenta de un alumno en profesor: pasa a gestionarse desde
  // "Profesores" (asignación de cursos), y deja de listarse acá.
  const promoteToTeacherMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("roles_usuario").update({ rol: "teacher" }).eq("usuario_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      toast.success("Alumno convertido a profesor. Ya lo podés gestionar desde \"Profesores\".");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Alumnos</h1>
            <p className="text-muted-foreground">Cuentas, inscripciones y estados de pago</p>
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
                  <SelectContent>{activeStudents.map((s) => <SelectItem key={s.id} value={s.id}>{s.nombre_completo}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                  <SelectContent>{courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  className="w-full gradient-primary"
                  disabled={!selectedStudent || !selectedCourse || enrollMutation.isPending}
                  onClick={() => enrollMutation.mutate()}
                >
                  {enrollMutation.isPending ? "Confirmando..." : "Confirmar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* CUENTAS DE ALUMNOS: activar / dar de baja */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Alumnos ({students?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {students?.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 hover:bg-muted/10 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${s.activo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {(s.nombre_completo || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{s.nombre_completo || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground">{s.dni ? `DNI ${s.dni}` : "Sin DNI cargado"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.activo ? (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900">Activo</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Dado de baja</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/messages?with=${s.id}`)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" /> Mensaje
                    </Button>
                    {s.activo && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        disabled={promoteToTeacherMutation.isPending}
                        onClick={() => {
                          if (confirm(`¿Convertir a ${s.nombre_completo} en profesor? Va a dejar de figurar como alumno y vas a poder asignarle cursos desde "Profesores".`)) {
                            promoteToTeacherMutation.mutate(s.id);
                          }
                        }}
                      >
                        <GraduationCap className="w-4 h-4 mr-1" /> Hacer Profesor
                      </Button>
                    )}
                    {s.activo ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm(`¿Dar de baja a ${s.nombre_completo}? Se vencerán todas sus suscripciones activas. Podés reactivarlo cuando quieras.`)) {
                            toggleActivoMutation.mutate({ id: s.id, activo: false });
                          }
                        }}
                      >
                        <UserX className="w-4 h-4 mr-1" /> Dar de baja
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        onClick={() => toggleActivoMutation.mutate({ id: s.id, activo: true })}
                      >
                        <UserCheck className="w-4 h-4 mr-1" /> Reactivar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {students?.length === 0 && (
                <p className="text-center text-muted-foreground py-10">Todavía no hay alumnos registrados.</p>
              )}
            </div>
          </CardContent>
        </Card>

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
              <BookOpen className="w-5 h-5 text-primary" />
              Inscripciones por Curso ({filteredEnrollments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredEnrollments.map((e: any) => (
                <div key={e.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-muted/10 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {(e.perfiles?.nombre_completo || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{e.perfiles?.nombre_completo}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {e.cursos?.titulo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Suscripción</p>
                      {e.subscription?.estado === 'active' ? (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900">ACTIVA</Badge>
                      ) : e.subscription?.estado === 'expired' ? (
                        <Badge variant="outline" className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900">VENCIDA</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">PENDIENTE</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Mandar mensaje"
                      onClick={() => navigate(`/messages?with=${e.usuario_id}&curso=${e.curso_id}`)}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      title="Quitar de este curso"
                      onClick={() => {
                        if (confirm(`¿Quitar a ${e.perfiles?.nombre_completo} de "${e.cursos?.titulo}"? Se vence su suscripción a este curso.`)) {
                          unenrollMutation.mutate(e);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredEnrollments.length === 0 && (
                <p className="text-center text-muted-foreground py-10">No hay inscripciones que coincidan con el filtro.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminStudents;