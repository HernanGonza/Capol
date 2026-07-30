import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Calendar, LockOpen, ArrowLeft } from "lucide-react";
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

  const openLessonForEdit = (lesson: any) => {
    setEditingLesson(lesson);
    setOpen(true);
  };

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
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tighter">Gestión de Clases</h1>
              <p className="text-muted-foreground text-sm">Arma tu clase usando bloques interactivos</p>
            </div>
          </div>
          <Button onClick={() => { setEditingLesson(null); setOpen(true); }} className="gradient-primary text-white font-bold">
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
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 font-bold">EDITAR</Button>
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
