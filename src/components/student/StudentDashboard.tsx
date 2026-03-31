import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Clock, CheckCircle, PlayCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const StudentDashboard = () => {
  const { user } = useAuth();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["student-courses-progress", user?.id],
    queryFn: async () => {
      // 1. Obtenemos las suscripciones activas y los datos del curso
      const { data: subs, error: subError } = await supabase
        .from("subscriptions")
        .select(`
          id,
          status,
          course_id,
          courses (
            id,
            title,
            description,
            image_url,
            lessons (id)
          )
        `)
        .eq("user_id", user!.id)
        .eq("status", "active")
        .or(`ends_at.gt.${new Date().toISOString()},ends_at.is.null`);

      if (subError) throw subError;

      // 2. Obtenemos el progreso del usuario para estos cursos
      const { data: progress, error: progError } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("user_id", user!.id)
        .eq("completed", true);

      if (progError) throw progError;

      // 3. Mapeamos para calcular el porcentaje por curso
      return subs.map((sub: any) => {
        const course = sub.courses;
        const totalLessons = course.lessons?.length || 0;
        
        // Contamos cuántas lecciones de ESTE curso están en el array de progreso completado
        const completedCount = course.lessons?.filter((lesson: any) => 
          progress?.some((p: any) => p.lesson_id === lesson.id)
        ).length || 0;

        const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

        return {
          id: sub.id,
          course,
          totalLessons,
          completedCount,
          percent
        };
      });
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">¡Hola de nuevo!</h1>
        <p className="text-muted-foreground text-lg">Aquí tienes tus cursos activos y tu progreso actual.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse border-none shadow-card">
              <div className="h-40 bg-muted rounded-t-xl" />
              <CardContent className="p-5 space-y-4">
                <div className="h-6 bg-muted rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : enrollments && enrollments.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((item) => (
            <Link key={item.id} to={`/course/${item.course.id}`}>
              <Card className="overflow-hidden border-none shadow-card hover:shadow-elevated transition-all duration-300 group bg-white">
                <div className="h-44 relative overflow-hidden">
                  {item.course.image_url ? (
                    <img 
                      src={item.course.image_url} 
                      alt={item.course.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
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
                    {item.course.title}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">
                    {item.course.description || "Comienza a explorar las lecciones de este curso."}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-end text-sm">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Tu Progreso
                      </span>
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
        <Card className="p-16 text-center border-none shadow-card bg-slate-50/50">
          <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="font-bold text-xl">Aún no tienes cursos activos</h3>
          <p className="text-muted-foreground mt-2 max-w-xs mx-auto">
            Cuando te inscribas en un programa, aparecerá aquí para que puedas empezar tu formación.
          </p>
        </Card>
      )}
    </div>
  );
};

export default StudentDashboard;