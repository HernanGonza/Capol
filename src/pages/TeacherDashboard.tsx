import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Users, Layers, Edit, Video, Calendar } from "lucide-react";

const TeacherDashboard = () => {
  const { user, profile } = useAuth();

  // Obtener cursos asignados al profesor
  const { data: assignedCourses, isLoading } = useQuery({
    queryKey: ["teacher-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_teachers")
        .select(`
          course_id,
          courses (
            id,
            title,
            description,
            is_published,
            flyer_url,
            lessons (count),
            enrollments (count)
          )
        `)
        .eq("teacher_id", user!.id);

      if (error) throw error;
      return data.map(ct => ct.courses);
    },
    enabled: !!user,
  });

  // Obtener próximas clases (lecciones con unlock_date próximo)
  const { data: upcomingLessons } = useQuery({
    queryKey: ["teacher-upcoming-lessons", user?.id],
    queryFn: async () => {
      if (!assignedCourses) return [];
      
      const courseIds = assignedCourses.map(c => c?.id).filter(Boolean);
      if (courseIds.length === 0) return [];

      const { data, error } = await supabase
        .from("lessons")
        .select(`
          id,
          title,
          unlock_date,
          jitsi_room_name,
          course_id,
          courses (title)
        `)
        .in("course_id", courseIds)
        .gte("unlock_date", new Date().toISOString())
        .order("unlock_date", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!assignedCourses && assignedCourses.length > 0,
  });

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Hola, {profile?.full_name?.split(" ")[0] || "Profesor"} 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            Panel de gestión de tus cursos y clases
          </p>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assignedCourses?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Cursos asignados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {assignedCourses?.reduce((acc, c) => acc + (c?.enrollments?.[0]?.count || 0), 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Alumnos totales</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Layers className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {assignedCourses?.reduce((acc, c) => acc + (c?.lessons?.[0]?.count || 0), 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Clases creadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{upcomingLessons?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Clases próximas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Próximas clases */}
        {upcomingLessons && upcomingLessons.length > 0 && (
          <Card className="border-none shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Próximas Clases
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingLessons.map((lesson) => (
                <div 
                  key={lesson.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Video className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">{lesson.courses?.title}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-primary">
                      {new Date(lesson.unlock_date!).toLocaleDateString("es-AR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short"
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(lesson.unlock_date!).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Mis Cursos */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Mis Cursos</h2>
          
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          ) : assignedCourses?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Sin cursos asignados</h3>
                  <p className="text-muted-foreground">
                    El administrador te asignará cursos pronto
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {assignedCourses?.map((course) => course && (
                <Card key={course.id} className="border-none shadow-card bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Badge 
                        variant={course.is_published ? "default" : "secondary"}
                        className={course.is_published ? "bg-success/10 text-success border-none" : ""}
                      >
                        {course.is_published ? "Publicado" : "Borrador"}
                      </Badge>
                      <div className="p-2 bg-primary/5 rounded-lg text-primary">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    </div>
                    <CardTitle className="text-xl font-bold mt-3">{course.title}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {course.description || "Sin descripción"}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 py-3 border-y">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Alumnos</p>
                        <p className="font-bold text-lg">{course.enrollments?.[0]?.count || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Clases</p>
                        <p className="font-bold text-lg text-blue-700">{course.lessons?.[0]?.count || 0}</p>
                      </div>
                    </div>

                    <Link to={`/teacher/course/${course.id}/lessons`}>
                      <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                        <Edit className="w-4 h-4 mr-2" /> Gestionar Clases
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default TeacherDashboard;
