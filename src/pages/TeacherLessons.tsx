import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  X,
  Upload,
  FileVideo,
  CalendarClock,
  Square,
  ClipboardCheck,
  Users,
  MessageSquare,
} from "lucide-react";
import JitsiMeet from "@/components/JitsiMeet";
import LessonBlocks from "@/components/LessonBlocks";
import LessonEditorDialog from "@/components/LessonEditorDialog";
import RevisarEntregasDialog from "@/components/RevisarEntregasDialog";
import CourseForumDialog from "@/components/CourseForumDialog";

const TeacherLessons = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [blockEditorOpen, setBlockEditorOpen] = useState(false);
  const [blockEditorLesson, setBlockEditorLesson] = useState<any>(null);
  const [reviewLesson, setReviewLesson] = useState<any>(null);
  const [forumOpen, setForumOpen] = useState(false);
  const [showJitsi, setShowJitsi] = useState(false);
  const [activeRoom, setActiveRoom] = useState<string>("");
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [recordingLinkLesson, setRecordingLinkLesson] = useState<any>(null);
  const [recordingLinkValue, setRecordingLinkValue] = useState("");
  const [endClassConfirmLesson, setEndClassConfirmLesson] = useState<any>(null);
  const [deleteLessonConfirm, setDeleteLessonConfirm] = useState<any>(null);
  const [savingRecordingLink, setSavingRecordingLink] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    fecha_desbloqueo: "",
    fecha_fin_clase: "",
    sala_jitsi: "",
  });

  // Verificar que el profesor tiene acceso a este curso — el admin entra a
  // cualquier curso aunque no esté asignado como docente ahí.
  const { data: hasAccess, isLoading: checkingAccess } = useQuery({
    queryKey: ["teacher-course-access", courseId, user?.id, role],
    queryFn: async () => {
      if (role === "admin") return true;

      const { data, error } = await supabase
        .from("docentes_cursos")
        .select("id")
        .eq("curso_id", courseId!)
        .eq("docente_id", user!.id)
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
        .from("cursos")
        .select("*")
        .eq("id", courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && hasAccess,
  });

  // Alumnos con suscripción activa a este curso — para poder mandarles un mensaje
  const { data: studentsInCourse } = useQuery({
    queryKey: ["teacher-course-students", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("usuario_id")
        .eq("curso_id", courseId!)
        .eq("estado", "active")
        .or(`fin_en.gt.${new Date().toISOString()},fin_en.is.null`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId && hasAccess,
  });

  // "perfiles" solo deja ver la fila propia (o todas si sos admin) — para
  // mostrar nombre/avatar de los alumnos hay que resolverlos aparte con una
  // función que expone esos dos datos no sensibles de cualquier usuario.
  const { data: studentProfiles } = useQuery({
    queryKey: ["perfiles-publicos", (studentsInCourse || []).map((s) => s.usuario_id)],
    queryFn: async () => {
      const ids = (studentsInCourse || []).map((s) => s.usuario_id).filter(Boolean) as string[];
      const { data, error } = await supabase.rpc("perfiles_publicos", { p_ids: ids });
      if (error) throw error;
      return data || [];
    },
    enabled: !!studentsInCourse?.length,
  });

  const studentProfileMap = new Map((studentProfiles || []).map((p) => [p.id, p]));

  // Obtener lecciones
  const { data: lessons, isLoading } = useQuery({
    queryKey: ["teacher-lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecciones")
        .select("*")
        .eq("curso_id", courseId!)
        .order("orden");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId && hasAccess,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lessonData = {
        titulo: form.titulo,
        descripcion: form.descripcion,
        sala_jitsi: form.sala_jitsi.trim() || null,
        curso_id: courseId,
        fecha_desbloqueo: form.fecha_desbloqueo || null,
        fecha_fin_clase: form.fecha_fin_clase || null,
      };

      if (editingLesson) {
        const { error } = await supabase
          .from("lecciones")
          .update(lessonData)
          .eq("id", editingLesson.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("lecciones")
          .insert({
            ...lessonData,
            orden: lessons?.length || 0,
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

  // Guardar el link de Drive con la grabación de una clase ya finalizada
  const openRecordingLinkDialog = (lesson: any) => {
    setRecordingLinkLesson(lesson);
    setRecordingLinkValue(lesson.grabacion_url || "");
  };

  const saveRecordingLink = async () => {
    if (!recordingLinkLesson) return;
    if (!recordingLinkValue.trim().includes("drive.google.com")) {
      toast.error("Pegá un link de Google Drive válido (compartido como \"Cualquiera con el link\")");
      return;
    }
    setSavingRecordingLink(true);
    try {
      const { error } = await supabase
        .from("lecciones")
        .update({ grabacion_url: recordingLinkValue.trim() })
        .eq("id", recordingLinkLesson.id);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] });
      toast.success("Grabación disponible para los alumnos.");
      setRecordingLinkLesson(null);
      setRecordingLinkValue("");
    } catch (e: any) {
      toast.error("Error al guardar el link: " + e.message);
    } finally {
      setSavingRecordingLink(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from("lecciones").delete().eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] });
      queryClient.invalidateQueries({ queryKey: ["lecciones", courseId] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success("Clase eliminada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Terminar la clase manualmente (sin esperar a que llegue la fecha de fin
  // configurada, o aunque no haya ninguna fecha configurada). A partir de esto,
  // la video llamada deja de aparecer y se habilita subir la grabación.
  const endClassMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase
        .from("lecciones")
        .update({ fecha_fin_clase: new Date().toISOString() })
        .eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] });
      toast.success("Clase finalizada. Ya podés subir la grabación.");
      setShowJitsi(false);
      setActiveRoom("");
      setActiveLesson(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmEndClass = () => {
    if (endClassConfirmLesson) {
      endClassMutation.mutate(endClassConfirmLesson.id);
      setEndClassConfirmLesson(null);
    }
  };

  const endClassDialog = (
    <AlertDialog open={!!endClassConfirmLesson} onOpenChange={(o) => !o && setEndClassConfirmLesson(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Terminar esta clase ahora?</AlertDialogTitle>
          <AlertDialogDescription>
            La video llamada va a dejar de estar disponible y vas a poder subir la grabación.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmEndClass} disabled={endClassMutation.isPending}>
            {endClassMutation.isPending ? "Terminando..." : "Terminar Clase"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const deleteLessonDialog = (
    <AlertDialog open={!!deleteLessonConfirm} onOpenChange={(o) => !o && setDeleteLessonConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar esta clase?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteLessonConfirm?.titulo ? `"${deleteLessonConfirm.titulo}" se va a eliminar. ` : ""}Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteLessonConfirm) deleteMutation.mutate(deleteLessonConfirm.id);
              setDeleteLessonConfirm(null);
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const resetForm = () => {
    setForm({ titulo: "", descripcion: "", fecha_desbloqueo: "", fecha_fin_clase: "", sala_jitsi: "" });
    setEditingLesson(null);
  };

  const openEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setForm({
      titulo: lesson.titulo,
      descripcion: lesson.descripcion || "",
      fecha_desbloqueo: lesson.fecha_desbloqueo ? lesson.fecha_desbloqueo.slice(0, 16) : "",
      fecha_fin_clase: lesson.fecha_fin_clase ? lesson.fecha_fin_clase.slice(0, 16) : "",
      sala_jitsi: lesson.sala_jitsi || "",
    });
    setOpen(true);
  };

  const isLessonUnlocked = (lesson: any) => {
    if (!lesson.fecha_desbloqueo) return true;
    return new Date(lesson.fecha_desbloqueo) <= new Date();
  };

  // Una vez pasada la fecha de fin, la video llamada deja de mostrarse:
  // en su lugar el profesor puede subir la grabación.
  const isClassOver = (lesson: any) => {
    return !!lesson.fecha_fin_clase && new Date(lesson.fecha_fin_clase) <= new Date();
  };

  const startLiveClass = (lesson: any) => {
    const roomName = lesson.sala_jitsi || "";
    setActiveRoom(roomName);
    setActiveLesson(lesson);
    setShowJitsi(true);
  };

  // Vista de "Clase en vivo": contenido de la clase + video llamada juntos
  if (showJitsi) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 overflow-hidden flex flex-col">
        <div className="h-16 shrink-0 bg-white text-slate-900 border-b flex items-center justify-between px-4 md:px-6 shadow-sm">
          <div className="min-w-0">
            <p className="font-bold truncate">{activeLesson?.titulo}</p>
            <p className="text-xs text-slate-500 truncate">{course?.titulo}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="default"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg"
              disabled={endClassMutation.isPending}
              onClick={() => setEndClassConfirmLesson(activeLesson)}
              title="Terminar Clase"
            >
              <Square className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Terminar Clase</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setShowJitsi(false);
                setActiveRoom("");
                setActiveLesson(null);
              }}
              className="shadow-lg"
              title="Cerrar Clase"
            >
              <X className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Cerrar Clase</span>
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 min-h-0">
          {/* Contenido de la clase, igual a lo que ve el alumno */}
          <div className="overflow-y-auto p-6 md:p-10 bg-white text-slate-900 min-h-0">
            <LessonBlocks content={activeLesson?.content} />
          </div>
          {/* Video llamada — sin scroll y sin altura en porcentaje/sticky
              (eso era lo frágil): el panel ocupa exactamente el alto de la
              fila del grid ("min-h-0" es lo que le permite encogerse en vez
              de desbordar) y JitsiMeet adentro achica su propio contenido
              para entrar siempre, sin necesitar scroll. */}
          <div className="bg-black overflow-hidden p-4 flex min-h-0">
            <JitsiMeet
              roomName={activeRoom}
              courseTitle={course?.titulo}
              lessonTitle={activeLesson?.titulo}
              isTeacher
              onClose={() => {
                setShowJitsi(false);
                setActiveRoom("");
                setActiveLesson(null);
              }}
            />
          </div>
        </div>
        {endClassDialog}
        {deleteLessonDialog}
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
              <h1 className="text-2xl font-bold tracking-tight">{course?.titulo}</h1>
              <p className="text-muted-foreground font-medium">Gestiona las clases de este curso</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setForumOpen(true)}>
            <Users className="w-4 h-4 mr-2" /> Foro del Curso
          </Button>
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
                <DialogDescription>Título, fecha y horario de la clase</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Título</Label>
                  <Input 
                    value={form.titulo} 
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })} 
                    required 
                    placeholder="Ej: Introducción a Variables" 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción</Label>
                  <Textarea 
                    value={form.descripcion} 
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })} 
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
                    value={form.fecha_desbloqueo} 
                    onChange={(e) => setForm({ ...form, fecha_desbloqueo: e.target.value })} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Si se establece, la clase estará bloqueada hasta esta fecha
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <CalendarClock className="w-3.5 h-3.5" /> Fecha de Fin de la Clase (opcional)
                  </Label>
                  <Input 
                    type="datetime-local" 
                    value={form.fecha_fin_clase} 
                    onChange={(e) => setForm({ ...form, fecha_fin_clase: e.target.value })} 
                  />
                  <p className="text-xs text-muted-foreground">
                    Después de esta fecha, la video llamada deja de aparecer y podés subir la grabación para que la vean los alumnos.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Video className="w-3.5 h-3.5" /> Nombre de la Video Llamada (opcional)
                  </Label>
                  <Input 
                    value={form.sala_jitsi} 
                    onChange={(e) => setForm({ ...form, sala_jitsi: e.target.value })} 
                    placeholder="Ej: Clase de los Martes" 
                  />
                  <p className="text-xs text-muted-foreground">
                    Elegí el nombre con el que se va a generar el link de la video llamada. Si lo dejás vacío, se genera uno automático.
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
        </div>

        {/* Alumnos inscriptos: acceso rápido para mandarles un mensaje */}
        <Card className="shadow-card overflow-hidden">
          <CardHeader className="bg-muted/30 border-b py-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Alumnos Inscriptos ({studentsInCourse?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {studentsInCourse?.map((s: any) => {
                const perfil = studentProfileMap.get(s.usuario_id);
                return (
                <div key={s.usuario_id} className="flex items-center justify-between p-3 hover:bg-muted/10 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {perfil?.url_avatar ? (
                      <img src={perfil.url_avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {(perfil?.nombre_completo || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <p className="font-medium truncate text-sm">{perfil?.nombre_completo || "Sin nombre"}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/messages?with=${s.usuario_id}&curso=${courseId}`)}
                  >
                    <MessageSquare className="w-4 h-4 mr-1" /> Mensaje
                  </Button>
                </div>
                );
              })}
              {studentsInCourse?.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Todavía no hay alumnos inscriptos en este curso.</p>
              )}
            </div>
          </CardContent>
        </Card>

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
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
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
                        <h3 className="font-semibold truncate">{lesson.titulo}</h3>
                        {!unlocked && (
                          <Badge variant="secondary" className="shrink-0">
                            <Lock className="w-3 h-3 mr-1" />
                            Bloqueada
                          </Badge>
                        )}
                        {isClassOver(lesson) ? (
                          lesson.grabacion_url ? (
                            <Badge variant="outline" className="shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900">
                              <FileVideo className="w-3 h-3 mr-1" />
                              Grabada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900">
                              Falta el link de la grabación
                            </Badge>
                          )
                        ) : lesson.sala_jitsi && (
                          <Badge variant="outline" className="shrink-0">
                            <Video className="w-3 h-3 mr-1" />
                            En vivo
                          </Badge>
                        )}
                      </div>
                      {lesson.fecha_desbloqueo && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(lesson.fecha_desbloqueo).toLocaleString("es-AR", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                        </p>
                      )}
                      {lesson.fecha_fin_clase && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          {isClassOver(lesson) ? "Finalizó" : "Finaliza"} el {new Date(lesson.fecha_fin_clase).toLocaleString("es-AR", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          })}
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isClassOver(lesson) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRecordingLinkDialog(lesson)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          {lesson.grabacion_url ? "Cambiar Link de Grabación" : "Agregar Link de Grabación"}
                        </Button>
                      ) : (
                        <>
                          <Button 
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => startLiveClass(lesson)}
                          >
                            <Play className="w-4 h-4 mr-1" /> Iniciar Clase
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-40"
                            disabled={endClassMutation.isPending || !!lesson.fecha_fin_clase}
                            onClick={() => setEndClassConfirmLesson(lesson)}
                            title={lesson.fecha_fin_clase ? "Desactivado porque tiene fecha de cierre automatizada" : "Terminar clase"}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {index === (lessons?.length || 0) - 1 && (
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          onClick={() => setReviewLesson(lesson)}
                        >
                          <ClipboardCheck className="w-4 h-4 mr-1" /> Revisar Entregas
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => { setBlockEditorLesson(lesson); setBlockEditorOpen(true); }}>
                        <Eye className="w-4 h-4 mr-1" /> Constructor
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => openEdit(lesson)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteLessonConfirm(lesson)}
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

      {/* Diálogo para pegar el link de Drive con la grabación */}
      <Dialog open={!!recordingLinkLesson} onOpenChange={(o) => { if (!o) { setRecordingLinkLesson(null); setRecordingLinkValue(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grabación de "{recordingLinkLesson?.titulo}"</DialogTitle>
            <DialogDescription>Pegá el link de Drive con la grabación de esta clase</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Link de Google Drive</Label>
            <Input
              value={recordingLinkValue}
              onChange={(e) => setRecordingLinkValue(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
            />
            <p className="text-xs text-muted-foreground">
              Subí la grabación a Drive, compartila como "Cualquiera con el link" (que pueda ver) y pegá acá el link. Los alumnos la van a poder ver desde la plataforma.
            </p>
            <Button
              className="w-full gradient-primary text-primary-foreground"
              disabled={savingRecordingLink || !recordingLinkValue.trim()}
              onClick={saveRecordingLink}
            >
              {savingRecordingLink ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LessonEditorDialog
        open={blockEditorOpen}
        onOpenChange={setBlockEditorOpen}
        courseId={courseId!}
        lesson={blockEditorLesson}
        nextOrder={lessons?.length || 0}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] })}
      />
      <RevisarEntregasDialog
        open={!!reviewLesson}
        onOpenChange={(o) => !o && setReviewLesson(null)}
        lesson={reviewLesson}
      />
      <CourseForumDialog
        open={forumOpen}
        onOpenChange={setForumOpen}
        courseId={courseId!}
        courseTitle={course?.titulo}
      />
      {endClassDialog}
      {deleteLessonDialog}
    </AppLayout>
  );
};

export default TeacherLessons;
