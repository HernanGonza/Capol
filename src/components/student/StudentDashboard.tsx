import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Clock, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const StudentDashboard = () => {
  const { user } = useAuth();

  const { data: activeSubscriptions, isLoading } = useQuery({
  queryKey: ["student-active-courses", user?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*, courses(*)")
      .eq("user_id", user!.id)
      .eq("status", "active")
      // Filtramos que la fecha de fin sea mayor a ahora o nula
      .or(`ends_at.gt.${new Date().toISOString()},ends_at.is.null`);
      
    if (error) throw error;
    return data;
  },
  enabled: !!user,
});

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Mis Cursos</h1>
        <p className="text-muted-foreground">Continúa aprendiendo donde lo dejaste</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-40 bg-muted rounded-t-lg" />
              <CardContent className="p-4 space-y-2">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : enrollments && enrollments.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const course = enrollment.courses as any;
            return (
              <Link key={enrollment.id} to={`/course/${course.id}`}>
                <Card className="overflow-hidden shadow-card hover:shadow-elevated transition-all hover:-translate-y-1 cursor-pointer group">
                  <div className="h-40 gradient-hero flex items-center justify-center relative overflow-hidden">
                    {course.image_url ? (
                      <img src={course.image_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-12 h-12 text-primary-foreground/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                    <h3 className="absolute bottom-3 left-3 right-3 font-bold text-lg text-card line-clamp-2">
                      {course.title}
                    </h3>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {course.description || "Sin descripción"}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      {enrollment.completed_at ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-success" />
                          <span>Completado</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>En progreso</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg">No tienes cursos asignados</h3>
          <p className="text-muted-foreground mt-1">Contacta al administrador para inscribirte en un curso.</p>
        </Card>
      )}
    </div>
  );
};

export default StudentDashboard;
