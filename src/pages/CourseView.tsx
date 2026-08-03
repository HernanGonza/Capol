import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle, Video, Calendar, ChevronRight, AlertCircle, Award, MessageSquare, Users } from "lucide-react";
import { useState } from "react";
import LessonContent from "@/components/student/LessonContent";
import { openCertificate } from "@/lib/certificate";
import CourseForumDialog from "@/components/CourseForumDialog";
import { useCertificateSignatures } from "@/hooks/use-certificate-signatures";

const CourseView = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [forumOpen, setForumOpen] = useState(false);

  // 1. Verificar Suscripción Activa
  const { data: subscription, isLoading: isLoadingSub } = useQuery({
    queryKey: ["check-subscription", user?.id, courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suscripciones")
        .select("estado, fin_en")
        .eq("usuario_id", user!.id)
        .eq("curso_id", courseId!)
        .eq("estado", "active")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!courseId,
  });

  // 1b. Si es profesor, ver si este curso está entre los suyos (para poder
  // previsualizarlo como lo ve un alumno, sin necesitar estar suscripto).
  const { data: isAssignedTeacher, isLoading: isLoadingTeacherAccess } = useQuery({
    queryKey: ["is-assigned-teacher", user?.id, courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("docentes_cursos")
        .select("id")
        .eq("curso_id", courseId!)
        .eq("docente_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!courseId && role === "teacher",
  });

  const isStaffPreview = role === "admin" || !!isAssignedTeacher;

  // Firmas para el certificado (profesor del curso + dirección) — se traen
  // una sola vez acá y se usan tanto en el certificado real como en el de
  // prueba para el staff.
  const certSignatures = useCertificateSignatures(courseId, !!courseId);

  // Profesor(es) de este curso — para que el alumno le pueda mandar un mensaje
  const { data: courseTeachers } = useQuery({
    queryKey: ["course-teachers", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("docentes_cursos")
        .select("docente_id")
        .eq("curso_id", courseId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!courseId && role === "student",
  });

  // 2. Obtener datos del curso
  const { data: course, isLoading: isLoadingCourse } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
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
        .from("lecciones")
        .select("*")
        .eq("curso_id", courseId!)
        .order("orden");
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // 4. Obtener progreso de lecciones (Persistencia)
  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ["lesson-progress", user?.id, courseId],
    queryFn: async () => {
      if (!lessons || lessons.length === 0) return [];
      const { data, error } = await supabase
        .from("progreso_lecciones")
        .select("*")
        .eq("usuario_id", user!.id)
        .in("leccion_id", lessons.map((l) => l.id));
      if (error) throw error;
      return data;
    },
    enabled: !!lessons && !!user,
  });

  const isLessonUnlocked = (lesson: any) => {
    if (isStaffPreview) return true;
    // Los cursos grabados son de acceso libre: el alumno entra cuando
    // quiere, así que no tiene sentido escalonar el desbloqueo por fecha.
    if (course?.modalidad === "grabado") return true;
    if (!lesson.fecha_desbloqueo) return true;
    return new Date(lesson.fecha_desbloqueo) <= new Date();
  };

  const isLessonCompleted = (lessonId: string) => {
    return progress?.some((p) => p.leccion_id === lessonId && p.completado);
  };

  const isCourseCompleted = !!lessons && lessons.length > 0 && lessons.every((l) => isLessonCompleted(l.id));
  // Fecha de finalización del curso = cuando se completó la última clase.
  const courseCompletedAt = isCourseCompleted
    ? progress?.reduce((max: string | null, p: any) => (!max || (p.completado_en || "") > max ? p.completado_en : max), null)
    : null;

  const selectedLesson = lessons?.find((l) => l.id === selectedLessonId);

  // Pantalla de carga
  if (isLoadingSub || isLoadingCourse || isLoadingTeacherAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground animate-pulse">Verificando credenciales...</p>
        </div>
      </AppLayout>
    );
  }

  // Barrera de acceso (no aplica si es un profesor asignado o un admin: ellos
  // pueden previsualizar el curso sin estar suscriptos)
  const isExpired = subscription?.fin_en && new Date(subscription.fin_en) < new Date();
  
  if (!isStaffPreview && (!subscription || isExpired)) {
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
              <p>Para recuperar el acceso, por favor contacta con administración o realiza el pago correspondiente a <strong>{course?.titulo}</strong>.</p>
            </CardContent>
          </Card>
          <Button onClick={() => navigate("/dashboard")} variant="outline" className="w-full">
            Volver a mis cursos
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Vista de lección individual (Detalle)
  if (selectedLesson) {
    return (
      <AppLayout>
        <LessonContent
          lesson={selectedLesson}
          onBack={() => {
            setSelectedLessonId(null);
            refetchProgress(); // Actualiza la lista al volver para mostrar el check verde
          }}
          userId={user!.id}
          courseTitle={course?.titulo}
          courseCargaHoraria={course?.carga_horaria}
          isPreview={isStaffPreview}
          isLastLesson={!!lessons && lessons.length > 0 && lessons[lessons.length - 1].id === selectedLesson.id}
        />
      </AppLayout>
    );
  }

  // Listado de lecciones del curso
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
        {isStaffPreview && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-400 text-sm font-semibold rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 shrink-0" />
              Estás viendo este curso en modo vista previa, como lo ve un alumno.
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 bg-white dark:bg-transparent"
              onClick={() => openCertificate({
                studentName: "Alumno de Prueba",
                courseTitle: course?.titulo || "",
                completionDate: new Date().toISOString(),
                cargaHoraria: course?.carga_horaria,
                ...certSignatures,
              })}
            >
              <Award className="w-4 h-4 mr-2" /> Certificado de prueba
            </Button>
          </div>
        )}
        <header className="border-b pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{course?.titulo}</h1>
            <p className="text-muted-foreground mt-2 text-lg">{course?.descripcion}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => setForumOpen(true)}>
              <Users className="w-4 h-4 mr-2" /> Foro del Curso
            </Button>
            {!isStaffPreview && !!courseTeachers?.length && (
              <Button
                variant="outline"
                onClick={() => navigate(`/messages?with=${courseTeachers[0].docente_id}&curso=${courseId}`)}
              >
                <MessageSquare className="w-4 h-4 mr-2" /> Mensaje al Profesor
              </Button>
            )}
            {isCourseCompleted && !isStaffPreview && (
              <Button
                onClick={() => openCertificate({
                  studentName: profile?.nombre_completo || "Alumno",
                  courseTitle: course?.titulo || "",
                  completionDate: courseCompletedAt,
                  cargaHoraria: course?.carga_horaria,
                  ...certSignatures,
                })}
                className="gradient-primary text-primary-foreground font-bold"
              >
                <Award className="w-4 h-4 mr-2" /> Ver Certificado
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-4">
          {lessons?.map((lesson, index) => {
            const unlocked = isLessonUnlocked(lesson);
            const completado = isLessonCompleted(lesson.id);

            return (
              <Card
                key={lesson.id}
                className={`group transition-all duration-200 overflow-hidden ${
                  unlocked 
                    ? "hover:shadow-md cursor-pointer border-l-4" 
                    : "opacity-60 bg-muted/30 cursor-not-allowed"
                } ${
                  completado ? "border-l-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10" : "border-l-transparent"
                }`}
                onClick={() => unlocked && setSelectedLessonId(lesson.id)}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  {/* Círculo de estado */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    completado
                      ? "bg-emerald-500 text-white"
                      : unlocked
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {completado ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : unlocked ? (
                      <span className="font-bold text-lg">{index + 1}</span>
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className={`font-semibold text-lg truncate ${!unlocked ? "text-muted-foreground" : "text-foreground"}`}>
                        {lesson.titulo}
                      </h3>
                      {completado && (
                        <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                          Completada
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      {lesson.url_video && (
                        <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Video Clase</span>
                      )}
                      {!unlocked && lesson.fecha_desbloqueo && (
                        <span className="flex items-center gap-1 text-orange-600 font-medium">
                          <Calendar className="w-3.5 h-3.5" /> Disponible: {new Date(lesson.fecha_desbloqueo).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {unlocked && (
                    <ChevronRight className={`w-5 h-5 transition-colors ${completado ? 'text-emerald-500' : 'text-muted-foreground group-hover:text-primary'}`} />
                  )}
                </CardContent>
              </Card>
            );
          })}

          {lessons?.length === 0 && (
            <div className="text-center py-20 bg-muted rounded-3xl border-2 border-dashed">
              <p className="text-muted-foreground font-medium">Próximamente se añadirán lecciones a este curso.</p>
            </div>
          )}
        </div>
      </div>

      <CourseForumDialog
        open={forumOpen}
        onOpenChange={setForumOpen}
        courseId={courseId!}
        courseTitle={course?.titulo}
      />
    </AppLayout>
  );
};

export default CourseView;