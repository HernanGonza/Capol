import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, GripVertical, Video, Calendar, Trash2 } from "lucide-react";

const AdminLessons = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    content: "",
    video_url: "",
    unlock_date: "",
    jitsi_room_name: "",
  });

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId!)
        .order("lesson_order");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const order = (lessons?.length || 0);
      const { error } = await supabase.from("lessons").insert({
        ...form,
        course_id: courseId!,
        lesson_order: order,
        unlock_date: form.unlock_date || null,
        jitsi_room_name: form.jitsi_room_name || `course-${courseId}-lesson-${order}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", courseId] });
      toast.success("Clase creada");
      setOpen(false);
      setForm({ title: "", description: "", content: "", video_url: "", unlock_date: "", jitsi_room_name: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", courseId] });
      toast.success("Clase eliminada");
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clases: {course?.title}</h1>
            <p className="text-muted-foreground">Gestiona las clases y su contenido</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Nueva Clase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nueva Clase</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Contenido (HTML/Markdown)</Label>
                  <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} />
                </div>
                <div className="space-y-2">
                  <Label>URL de Video</Label>
                  <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://youtube.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de desbloqueo</Label>
                  <Input type="date" value={form.unlock_date} onChange={(e) => setForm({ ...form, unlock_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Nombre sala Jitsi (auto si vacío)</Label>
                  <Input value={form.jitsi_room_name} onChange={(e) => setForm({ ...form, jitsi_room_name: e.target.value })} placeholder="mi-sala-clase" />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creando..." : "Crear Clase"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-muted rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : lessons && lessons.length > 0 ? (
            lessons.map((lesson, index) => (
              <Card key={lesson.id} className="shadow-card hover:shadow-elevated transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-sm font-mono font-bold w-6 text-center">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{lesson.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {lesson.video_url && (
                        <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>
                      )}
                      {lesson.unlock_date && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {lesson.unlock_date}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(lesson.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No hay clases aún. Crea la primera.</p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminLessons;
