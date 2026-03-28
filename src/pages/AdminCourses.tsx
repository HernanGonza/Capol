import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, BookOpen, Edit, Layers } from "lucide-react";
import { Link } from "react-router-dom";

const AdminCourses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", is_published: false });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
      queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cursos</h1>
            <p className="text-muted-foreground">Gestiona tus cursos y contenido</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Curso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCourse ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>URL de imagen</Label>
                  <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.is_published} onCheckedChange={(c) => setForm({ ...form, is_published: c })} />
                  <Label>Publicado</Label>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-primary-foreground/70" />
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${course.is_published ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {course.is_published ? "Publicado" : "Borrador"}
                    </span>
                  </div>
                  <h3 className="font-semibold mb-1">{course.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{course.description || "Sin descripción"}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(course)}>
                      <Edit className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Link to={`/admin/courses/${course.id}/lessons`}>
                      <Button variant="outline" size="sm">
                        <Layers className="w-3.5 h-3.5 mr-1" /> Clases
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-lg">No hay cursos aún</h3>
            <p className="text-muted-foreground mt-1">Crea tu primer curso para comenzar.</p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminCourses;
