import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Users, BookOpen, Trash2 } from "lucide-react";

const AdminStudents = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  const { data: students } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student");
      if (error) throw error;
      if (!roles.length) return [];
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
      return profiles || [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, title").order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["all-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*, courses(title), profiles:user_id(full_name)");
      if (error) throw error;
      return data;
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("enrollments").insert({
        user_id: selectedStudent,
        course_id: selectedCourse,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-enrollments"] });
      toast.success("Alumno inscripto al curso");
      setOpen(false);
      setSelectedStudent("");
      setSelectedCourse("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unenrollMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enrollments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-enrollments"] });
      toast.success("Inscripción eliminada");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Alumnos</h1>
            <p className="text-muted-foreground">Gestiona alumnos e inscripciones</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <UserPlus className="w-4 h-4 mr-2" /> Inscribir Alumno
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Inscribir alumno a curso</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Alumno</label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar alumno" /></SelectTrigger>
                    <SelectContent>
                      {students?.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.full_name || s.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Curso</label>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar curso" /></SelectTrigger>
                    <SelectContent>
                      {courses?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full gradient-primary text-primary-foreground"
                  disabled={!selectedStudent || !selectedCourse || enrollMutation.isPending}
                  onClick={() => enrollMutation.mutate()}
                >
                  Inscribir
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Inscripciones activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enrollments && enrollments.length > 0 ? (
              <div className="space-y-2">
                {enrollments.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-xs font-bold text-accent-foreground">
                        {((e.profiles as any)?.full_name || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{(e.profiles as any)?.full_name || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {(e.courses as any)?.title}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => unenrollMutation.mutate(e.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No hay inscripciones aún</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminStudents;
