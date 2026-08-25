import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Calendar, LockOpen, ArrowLeft, Users, MessageSquare, Trash2 } from "lucide-react";
import LessonEditorDialog from "@/components/LessonEditorDialog";

// Clases viejas guardaban el contenido como texto plano/HTML, no como el JSON
// de bloques actual (ver el mismo caso ya contemplado en LessonBlocks.tsx) —
// sin este try/catch, abrir el listado de una de esas clases rompía toda la
// página.
const contarBloques = (content: string | null) => {
  try {
    const parsed = JSON.parse(content || "[]");
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return content ? 1 : 0;
  }
};

const AdminLessons = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [deleteLessonConfirm, setDeleteLessonConfirm] = useState<any>(null);

  const { data: course } = useQuery({
    queryKey: ["course-details-admin", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("titulo").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["lecciones", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecciones")
        .select("*")
        .eq("curso_id", courseId!)
        .order("orden");
      if (error) throw error;
      return data;
    },
  });

  // Alumnos inscriptos en este curso (cualquier estado, el admin necesita ver
  // el panorama completo, no solo los al día). Admin bypasea la RLS de
  // "perfiles", así que este join directo funciona sin necesitar la función
  // perfiles_publicos que usan las pantallas de profesor/alumno.
  const { data: alumnos } = useQuery({
    queryKey: ["admin-course-students", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("usuario_id, estado, perfiles:usuario_id(nombre_completo, url_avatar, email)")
        .eq("curso_id", courseId!)
        .order("estado");
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId,
  });

  const estadoBadge: Record<string, string> = {
    active: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900",
    expired: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900",
  };

  const openLessonForEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const { error } = await supabase.from("lecciones").delete().eq("id", lessonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecciones", courseId] });
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-lessons", courseId] });
      toast.success("Clase eliminada");
    },
    onError: (e: any) => toast.error(e.message || "No se pudo eliminar la clase"),
  });

  // Si llegamos con ?edit=<id> (por ejemplo desde el listado de clases del profesor),
  // abrimos directamente esa clase apenas cargan las lecciones.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && lessons) {
      const lesson = lessons.find((l: any) => l.id === editId);
      if (lesson) {
        openLessonForEdit(lesson);
      }
      // Limpiamos el parámetro para no reabrir el diálogo si se cierra y se vuelve a renderizar
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons]);

  // Función para determinar si la fecha de desbloqueo ya pasó
  const isDatePassed = (dateString: string) => {
    const unlockDateObj = new Date(dateString);
    const now = new Date();
    // Normalizamos a solo fecha para comparar días
    now.setHours(0, 0, 0, 0);
    unlockDateObj.setHours(0, 0, 0, 0);
    return now >= unlockDateObj;
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tighter truncate">{course?.titulo || "Gestión de Clases"}</h1>
              <p className="text-muted-foreground text-sm">Arma tu clase usando bloques interactivos</p>
            </div>
          </div>
          <Button onClick={() => { setEditingLesson(null); setOpen(true); }} className="gradient-primary text-white font-bold shrink-0">
            <Plus className="w-4 h-4 mr-2" /> Nueva Clase
          </Button>
        </div>

        <LessonEditorDialog
          open={open}
          onOpenChange={setOpen}
          courseId={courseId!}
          lesson={editingLesson}
          nextOrder={lessons?.length || 0}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["lecciones", courseId] })}
        />

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
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ALUMNOS INSCRIPTOS */}
        <Card className="shadow-card overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 bg-muted/30 border-b flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">Alumnos Inscriptos ({alumnos?.length || 0})</span>
            </div>
            <div className="divide-y">
              {alumnos?.map((a: any) => (
                <div key={a.usuario_id} className="flex items-center justify-between p-3 hover:bg-muted/10 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {a.perfiles?.url_avatar ? (
                      <img src={a.perfiles.url_avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {(a.perfiles?.nombre_completo || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{a.perfiles?.nombre_completo || "Sin nombre"}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.perfiles?.email}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${estadoBadge[a.estado || "expired"]}`}>
                      {a.estado === "active" ? "AL DÍA" : (a.estado || "sin estado").toUpperCase()}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/messages?with=${a.usuario_id}&curso=${courseId}`)}>
                    <MessageSquare className="w-4 h-4 mr-1" /> Mensaje
                  </Button>
                </div>
              ))}
              {alumnos?.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">Todavía no hay alumnos inscriptos en este curso.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LISTA DE CLASES CON LÓGICA DE FECHA DINÁMICA */}
        <div className="grid gap-4">
          {isLoading ? <p>Cargando lecciones...</p> : lessons?.map((lesson, idx) => {
            const unlocked = lesson.fecha_desbloqueo ? isDatePassed(lesson.fecha_desbloqueo) : true;

            return (
              <Card key={lesson.id} className="group hover:border-primary/50 transition-all cursor-pointer shadow-card" onClick={() => openLessonForEdit(lesson)}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-black text-muted-foreground group-hover:bg-primary group-hover:text-white transition-colors">{idx + 1}</div>
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{lesson.titulo}</h3>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">{contarBloques(lesson.content)} bloque(s)</p>

                        {lesson.fecha_desbloqueo && (
                          unlocked ? (
                            <span className="flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                              <LockOpen className="w-2.5 h-2.5" /> Clase desbloqueada
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                              <Calendar className="w-2.5 h-2.5" /> Desbloquea: {new Date(lesson.fecha_desbloqueo).toLocaleDateString()}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 font-bold">EDITAR</Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      title="Eliminar clase"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteLessonConfirm(lesson);
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
      </div>
    </AppLayout>
  );
};

export default AdminLessons;
