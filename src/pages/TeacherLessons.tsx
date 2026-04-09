import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Plus, 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar, 
  Video, 
  GripVertical,
  Eye,
  Lock,
  Unlock,
  Play,
  X
} from "lucide-react";
import JitsiMeet from "@/components/JitsiMeet";

const TeacherLessons = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [showJitsi, setShowJitsi] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    unlock_date: "",
    jitsi_room_name: "",
  });

  // Verificar que el profesor tiene acceso a este curso
  const { data: hasAccess, isLoading: checkingAccess } = useQuery({
    queryKey: ["teacher-course-access", courseId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_teachers")
        .select("id")
        .eq("course_id", courseId!)
        .eq("teacher_id", user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!courseId && !!user,
  });

  // Obtener datos del curso
  const { data: course } = useQuery({
    queryKey: ["course-details", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && hasAccess,
  });

  // Obtener lecciones
  const { data: lessons, isLoading } = useQuery({
    queryKey: ["teacher-lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId!)
        .order("lesson_order");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && hasAccess,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lessonData = {
        ...form,
        course_id: courseId,
        unlock_date: form.unlock_date || null,
        jitsi_room_name: form.jitsi_room_name || `course-${courseId}-lesson-${lessons?.length || 0}`,
      };

      if (editingLesson) {
        const { error } = await supabase
          .from("lessons")
          .update(lessonData)
          .eq("id", editingLesson.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lessons")
          .insert({
            ...lessonData,
            lesson_order: lessons?.length || 0,
            content: JSON.stringify([{ id: crypto.randomUUID().slice(0, 8), type: "text", value: "" }]),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] });
      toast.success(editingLesson ? "Clase actualizada" : "Clase creada");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] });
      toast.success("Clase eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ title: "", description: "", unlock_date: "", jitsi_room_name: "" });
    setEditingLesson(null);
  };

  const openEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      description: lesson.description || "",
      unlock_date: lesson.unlock_date ? lesson.unlock_date.slice(0, 16) : "",
      jitsi_room_name: lesson.jitsi_room_name || "",
    });
    setOpen(true);
  };

  const isLessonUnlocked = (lesson: any) => {
    if (!lesson.unlock_date) return true;
    return new Date(lesson.unlock_date) <= new Date();
  };

  const startLiveClass = (lesson: any) => {
    const roomName = lesson.jitsi_room_name || `lesson-${lesson.id}`;
    setActiveRoom(roomName);
    setShowJitsi(true);
  };

  // Si está mostrando Jitsi, renderizar fullscreen
  if (showJitsi && activeRoom) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-4 right-4 z-50">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setShowJitsi(false);
              setActiveRoom(null);
            }}
            className="shadow-lg"
          >
            <X className="w-4 h-4 mr-2" /> Cerrar Clase
          </Button>
        </div>
        <JitsiMeet 
          roomName={activeRoom} 
          onClose={() => {
            setShowJitsi(false);
            setActiveRoom(null);
          }}
        />
      </div>
    );
  }

  // Si está verificando acceso
  if (checkingAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // Si no tiene acceso
  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Acceso denegado</h1>
            <p className="text-muted-foreground">
              No tienes permiso para editar este curso.
            </p>
          </div>
          <Button onClick={() => navigate("/teacher")} variant="outline">
            Volver a mi panel
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate("/teacher")} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{course?.title}</h1>
              <p className="text-muted-foreground font-medium">Gestiona las clases de este curso</p>
            </div>
          </div>
          
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> Nueva Clase
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  {editingLesson ? "Editar Clase" : "Nueva Clase"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Título</Label>
                  <Input 
                    value={form.title} 
                    onChange={(e) => setForm({ ...form, title: e.target.value })} 
                    required 
                    placeholder="Ej: Introducción a Variables" 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción</Label>
                  <Textarea 
                    value={form.description} 
                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                    rows={3}
                    placeholder="Breve descripción de la clase..."
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Fecha de Desbloqueo (opcional)
                  </Label>
                  <Input 
                    type="datetime-local" 
                    value={form.unlock_date} 
                    onChange={(e) => setForm({ ...form, unlock_date: e.target.value })} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Si se establece, la clase estará bloqueada hasta esta fecha
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full gradient-primary text-primary-foreground h-11" 
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "Guardando..." : "Confirmar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de clases */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : lessons?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Video className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">Sin clases</h3>
                <p className="text-muted-foreground">Crea tu primera clase para este curso</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {lessons?.map((lesson, index) => {
              const unlocked = isLessonUnlocked(lesson);
              
              return (
                <Card 
                  key={lesson.id} 
                  className={`border-none shadow-card transition-all hover:shadow-md ${
                    !unlocked ? "opacity-70" : ""
                  }`}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Número de orden */}
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-5 h-5 text-muted-foreground/50 cursor-grab" />
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                        unlocked 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{lesson.title}</h3>
                        {!unlocked && (
                          <Badge variant="secondary" className="shrink-0">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueada
                          </Badge>
                        )}
                        {lesson.jitsi_room_name && (
                          <Badge variant="outline" className="shrink-0">
                            <Video className="w-3 h-3 mr-1" />
                            En vivo
                          </Badge>
                        )}
                      </div>
                      {lesson.unlock_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(lesson.unlock_date).toLocaleString("es-AR", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => startLiveClass(lesson)}
                      >
                        <Play className="w-4 h-4 mr-1" /> Iniciar Clase
                      </Button>
                      <Link to={`/admin/courses/${courseId}/lessons?edit=${lesson.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-1" /> Constructor
                        </Button>
                      </Link>
                      <Button variant="outline" size="icon" onClick={() => openEdit(lesson)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm("¿Estás seguro de eliminar esta clase?")) {
                            deleteMutation.mutate(lesson.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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

export default TeacherLessons;
