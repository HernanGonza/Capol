import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, Edit, Layers, Users, CheckCircle2, Search } from "lucide-react";
import { Link } from "react-router-dom";

const AdminCourses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", is_published: false });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses-full-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          enrollments (count),
          subscriptions (count),
          lessons (count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const { data: activeSubs } = await supabase
        .from("subscriptions")
        .select("course_id")
        .eq('status', 'active');

      return data.map(course => ({
        ...course,
        active_count: activeSubs?.filter(s => s.course_id === course.id).length || 0,
        total_enrollments: course.enrollments[0]?.count || 0,
        total_lessons: course.lessons[0]?.count || 0
      }));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCourse) {
        const { error } = await supabase.from("courses").update(form).eq("id", editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert({ ...form, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success(editingCourse ? "Curso actualizado" : "Curso creado");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ title: "", description: "", image_url: "", is_published: false });
    setEditingCourse(null);
  };

  const openEdit = (course: any) => {
    setEditingCourse(course);
    setForm({ title: course.title, description: course.description || "", image_url: course.image_url || "", is_published: course.is_published });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
            <p className="text-muted-foreground font-medium">Gestiona tu catálogo de contenidos</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Curso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{editingCourse ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ej: React para Emprendedores" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.is_published} onCheckedChange={(c) => setForm({ ...form, is_published: c })} />
                    <Label className="font-semibold cursor-pointer">Publicado</Label>
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground h-11" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Guardando..." : "Confirmar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses?.map((course) => {
              const health = course.total_enrollments > 0 ? (course.active_count / course.total_enrollments) * 100 : 0;
              
              return (
                <Card key={course.id} className="border-none shadow-card bg-white flex flex-col">
                  <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
                    <div className="space-y-1">
                      <Badge variant={course.is_published ? "default" : "secondary"} className={course.is_published ? "bg-success/10 text-success border-none" : ""}>
                        {course.is_published ? "Activo" : "Borrador"}
                      </Badge>
                      <CardTitle className="text-xl font-bold line-clamp-1">{course.title}</CardTitle>
                    </div>
                    <div className="p-2 bg-primary/5 rounded-lg text-primary">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-6 flex-1">
                    <div className="grid grid-cols-3 gap-2 border-y py-4">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Alumnos</p>
                        <p className="font-bold text-lg">{course.total_enrollments}</p>
                      </div>
                      <div className="text-center border-x">
                        <p className="text-[10px] uppercase font-bold text-green-600 mb-1">Activos</p>
                        <p className="font-bold text-lg text-green-700">{course.active_count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Clases</p>
                        <p className="font-bold text-lg text-blue-700">{course.total_lessons}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Link to={`/admin/courses/${course.id}/lessons`} className="flex-1">
                          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white" size="sm">
                            <Layers className="w-3.5 h-3.5 mr-2" /> Clases
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => openEdit(course)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminCourses;