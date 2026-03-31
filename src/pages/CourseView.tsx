import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle, Video, Calendar, ChevronRight, AlertCircle } from "lucide-react";
import { useState } from "react";
import LessonContent from "@/components/student/LessonContent";

const CourseView = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // 1. Verificar Suscripción Activa para este curso
  const { data: subscription, isLoading: isLoadingSub } = useQuery({
    queryKey: ["check-subscription", user?.id, courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, ends_at")
        .eq("user_id", user!.id)
        .eq("course_id", courseId!)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!courseId,
  });

  // 2. Obtener datos del curso
  const { data: course, isLoading: isLoadingCourse } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // 3. Obtener lecciones
  const { data: lessons } = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId!)
        .order("lesson_order");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // 4. Obtener progreso de lecciones
  const { data: progress } = useQuery({
    queryKey: ["lesson-progress", user?.id, courseId],
    queryFn: async () => {
      if (!lessons || lessons.length === 0) return [];
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user!.id)
        .in("lesson_id", lessons.map((l) => l.id));
      if (error) throw error;
      return data;
    },
    enabled: !!lessons && !!user,
  });

  const isLessonUnlocked = (lesson: any) => {
    if (!lesson.unlock_date) return true;
    return new Date(lesson.unlock_date) <= new Date();
  };

  const isLessonCompleted = (lessonId: string) => {
    return progress?.some((p) => p.lesson_id === lessonId && p.completed);
  };

  const selectedLesson = lessons?.find((l) => l.id === selectedLessonId);

  // Pantalla de carga
  if (isLoadingSub || isLoadingCourse) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground animate-pulse">Verificando credenciales...</p>
        </div>
      </AppLayout>
    );
  }

  // BARRERA DE ACCESO: Si no hay suscripción activa o expiró
  const isExpired = subscription?.ends_at && new Date(subscription.ends_at) < new Date();
  
  if (!subscription || isExpired) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto mt-20 text-center space-y-6 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Acceso no autorizado</h1>
            <p className="text-muted-foreground">
              {isExpired 
                ? "Tu suscripción mensual para este curso ha vencido." 
                : "No tienes una suscripción activa vinculada a este curso."}
            </p>
          </div>
          <Card className="bg-muted/50 border-none">
            <CardContent className="p-4 flex items-start gap-3 text-left text-sm">
              <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p>Para recuperar el acceso, por favor contacta con administración o realiza el pago de la mensualidad correspondiente a <strong>{course?.title}</strong>.</p>
            </CardContent>
          </Card>
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
            Volver a mis cursos
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Vista de lección individual
  if (selectedLesson) {
    return (
      <AppLayout>
        <LessonContent
          lesson={selectedLesson}
          onBack={() => setSelectedLessonId(null)}
          userId={user!.id}
        />
      </AppLayout>
    );
  }

  // Listado de lecciones del curso
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <header>
          <h1 className="text-3xl font-bold">{course?.title}</h1>
          <p className="text-muted-foreground mt-2">{course?.description}</p>
        </header>

        <div className="grid gap-3">
          {lessons?.map((lesson, index) => {
            const unlocked = isLessonUnlocked(lesson);
            const completed = isLessonCompleted(lesson.id);

            return (
              <Card
                key={lesson.id}
                className={`group transition-all duration-200 ${
                  unlocked 
                    ? "hover:shadow-md cursor-pointer border-l-4 border-l-transparent hover:border-l-primary" 
                    : "opacity-60 bg-muted/30"
                }`}
                onClick={() => unlocked && setSelectedLessonId(lesson.id)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    completed
                      ? "bg-success/20 text-success"
                      : unlocked
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : unlocked ? (
                      <span className="font-bold text-lg">{index + 1}</span>
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold text-lg truncate ${!unlocked && "text-muted-foreground"}`}>
                      {lesson.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      {lesson.video_url && (
                        <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video</span>
                      )}
                      {lesson.unlock_date && !unlocked && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <Calendar className="w-3.5 h-3.5" /> Disponible: {new Date(lesson.unlock_date).toLocaleDateString()}
                        </span>
                      )}
                      {completed && <span className="text-success font-medium">Completada</span>}
                    </div>
                  </div>

                  {unlocked && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {lessons?.length === 0 && (
            <p className="text-center py-10 text-muted-foreground">Próximamente se añadirán lecciones a este curso.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseView;