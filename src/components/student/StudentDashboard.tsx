import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, CheckCircle, PlayCircle, GraduationCap, ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const StudentDashboard = () => {
  const { user } = useAuth();

  // Cursos en los que el alumno ya tiene suscripción activa
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ["student-courses-progress", user?.id],
    queryFn: async () => {
      const { data: subs, error: subError } = await supabase
        .from("suscripciones")
        .select(`
          id,
          estado,
          curso_id,
          cursos (
            id,
            titulo,
            descripcion,
            url_imagen,
            lecciones (id)
          )
        `)
        .eq("usuario_id", user!.id)
        .eq("estado", "active")
        .or(`fin_en.gt.${new Date().toISOString()},fin_en.is.null`);

      if (subError) throw subError;

      const { data: progress } = await supabase
        .from("progreso_lecciones")
        .select("leccion_id, completado")
        .eq("usuario_id", user!.id)
        .eq("completado", true);

      return (subs || []).map((sub: any) => {
        const course = sub.cursos;
        const totalLessons = course?.lecciones?.length || 0;
        const completedCount = course?.lecciones?.filter((lesson: any) =>
          progress?.some((p: any) => p.leccion_id === lesson.id)
        ).length || 0;
        const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
        return { id: sub.id, course, totalLessons, completedCount, percent };
      });
    },
    enabled: !!user,
  });

  // Todos los cursos publicados que el alumno NO tiene suscripción activa
  const { data: availableCourses, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-courses", user?.id],
    queryFn: async () => {
      const { data: allCourses } = await supabase
        .from("cursos")
        .select(`
          id,
          titulo,
          descripcion,
          url_imagen,
          url_flyer,
          tipo_flyer,
          lecciones (count),
          inscripciones (count)
        `)
        .eq("publicado", true)
        .order("creado_en", { ascending: false });

      // Obtener IDs de cursos con suscripción activa
      const { data: activeSubs } = await supabase
        .from("suscripciones")
        .select("curso_id")
        .eq("usuario_id", user!.id)
        .eq("estado", "active")
        .or(`fin_en.gt.${new Date().toISOString()},fin_en.is.null`);

      const enrolledIds = new Set((activeSubs || []).map((s: any) => s.curso_id));
      return (allCourses || []).filter((c: any) => !enrolledIds.has(c.id));
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-10 animate-fade-in">

      {/* ===== MIS CURSOS ===== */}
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">¡Hola de nuevo!</h1>
          <p className="text-muted-foreground text-lg">Aquí tenés tus cursos activos y tu progreso actual.</p>
        </div>

        {loadingEnrollments ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse border-none shadow-card">
                <div className="h-40 bg-muted rounded-t-xl" />
                <CardContent className="p-5 space-y-4">
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : enrollments && enrollments.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((item) => (
              <Link key={item.id} to={`/course/${item.course?.id}`}>
                <Card className="overflow-hidden border-none shadow-card hover:shadow-elevated transition-all duration-300 group bg-white">
                  <div className="h-44 relative overflow-hidden">
                    {item.course?.url_imagen ? (
                      <img src={item.course.url_imagen} alt={item.course.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full gradient-hero flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    {item.percent === 100 && (
                      <div className="absolute top-3 right-3 bg-success text-success-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                        <CheckCircle className="w-3 h-3" /> COMPLETADO
                      </div>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-xl mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                      {item.course?.titulo}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
                      {item.course?.descripcion || "Comienza a explorar las lecciones de este curso."}
                    </p>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end text-sm">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tu Progreso</span>
                        <span className="font-bold text-primary">{item.percent}%</span>
                      </div>
                      <Progress value={item.percent} className="h-2 bg-slate-100" />
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <PlayCircle className="w-4 h-4 text-primary/60" />
                          <span>{item.completedCount} / {item.totalLessons} Clases</span>
                        </div>
                        <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          Continuar <Clock className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-10 text-center border-none shadow-card bg-slate-50/50">
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="font-bold text-lg">Aún no tenés cursos activos</h3>
            <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">
              Inscribite en alguno de los cursos disponibles aquí abajo para empezar.
            </p>
          </Card>
        )}
      </div>

      {/* ===== CURSOS DISPONIBLES ===== */}
      {(availableCourses && availableCourses.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Cursos Disponibles</h2>
              <p className="text-muted-foreground text-sm mt-1">Contactá a administración para inscribirte.</p>
            </div>
            <Badge variant="secondary" className="text-xs font-bold">{availableCourses.length} cursos</Badge>
          </div>

          {loadingAvailable ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <Card key={i} className="animate-pulse border-none shadow-card">
                  <div className="h-32 bg-muted rounded-t-xl" />
                  <CardContent className="p-4"><div className="h-5 bg-muted rounded w-3/4" /></CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableCourses.map((course: any) => (
                <Card key={course.id} className="overflow-hidden border border-border/50 shadow-sm hover:shadow-card transition-all duration-300 group bg-white">
                  <div className="h-36 relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50">
                    {course.url_flyer || course.url_imagen ? (
                      course.tipo_flyer === "video" || course.url_flyer?.endsWith(".mp4") ? (
                        <video src={course.url_flyer} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                      ) : (
                        <img src={course.url_flyer || course.url_imagen} alt={course.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <GraduationCap className="w-10 h-10 text-indigo-200" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute bottom-2 left-3 flex items-center gap-2">
                      <Badge className="bg-black/40 backdrop-blur-sm text-white border-none text-[10px] font-bold">
                        <BookOpen className="w-2.5 h-2.5 mr-1" />
                        {course.lecciones?.[0]?.count || 0} clases
                      </Badge>
                      <Badge className="bg-black/40 backdrop-blur-sm text-white border-none text-[10px] font-bold">
                        <Users className="w-2.5 h-2.5 mr-1" />
                        {course.inscripciones?.[0]?.count || 0}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors mb-1">
                      {course.titulo}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {course.descripcion || "Más información próximamente."}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                      <ArrowRight className="w-3 h-3" />
                      Contactá a administración para inscribirte
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;