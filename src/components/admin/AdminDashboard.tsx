import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  TrendingUp, 
  BookOpen, 
  GraduationCap, 
  AlertTriangle, 
  CheckCircle,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-master-stats"],
    queryFn: async () => {
      const [
        { data: roles },
        { data: subs },
        { data: courses },
        { data: progress }
      ] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "student"),
        supabase.from("subscriptions").select("status, price"),
        supabase.from("courses").select("id, is_published"),
        supabase.from("lesson_progress").select("completed")
      ]);

      const totalStudents = roles?.length || 0;
      const activeCourses = courses?.filter(c => c.is_published).length || 0;
      const activeSubs = subs?.filter(s => s.status === 'active') || [];
      const expiredSubs = subs?.filter(s => s.status === 'expired') || [];
      const monthlyRevenue = activeSubs.reduce((acc, curr) => acc + (curr.price || 0), 0);
      const completionRate = progress?.length ? (progress.filter(p => p.completed).length / progress.length) * 100 : 0;

      return {
        totalStudents,
        activeCourses,
        totalCourses: courses?.length || 0,
        activeCount: activeSubs.length,
        expiredCount: expiredSubs.length,
        revenue: monthlyRevenue,
        completionRate,
        healthRatio: totalStudents > 0 ? (activeSubs.length / totalStudents) * 100 : 0
      };
    },
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse text-muted-foreground">Cargando métricas maestras...</div>;

  const cards = [
    {
      title: "Ingresos Mensuales",
      value: `$${stats?.revenue.toLocaleString()}`,
      description: "Suscripciones activas",
      icon: TrendingUp,
      color: "bg-primary text-primary-foreground",
      path: "/admin/subscriptions" // Ajustar según tu ruta de pagos
    },
    {
      title: "Alumnos Totales",
      value: stats?.totalStudents,
      description: `${stats?.activeCount} alumnos al día`,
      icon: Users,
      color: "bg-white",
      path: "/admin/students" // Ajustar según tu ruta de usuarios
    },
    {
      title: "Cursos Publicados",
      value: `${stats?.activeCourses} / ${stats?.totalCourses}`,
      description: "Contenido activo",
      icon: BookOpen,
      color: "bg-white",
      path: "/admin/courses"
    },
    {
      title: "Pagos Pendientes",
      value: stats?.expiredCount,
      description: "Suscripciones vencidas",
      icon: AlertTriangle,
      color: "bg-white text-destructive",
      path: "/admin/subscriptions?filter=expired"
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground">Gestión centralizada de tu academia y facturación.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <Card 
            key={idx} 
            className={`border-none shadow-card cursor-pointer hover:ring-2 ring-primary/20 transition-all group ${card.color}`}
            onClick={() => navigate(card.path)}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium opacity-90">{card.title}</CardTitle>
              <card.icon className="w-4 h-4 opacity-70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs opacity-70">{card.description}</p>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-500" /> Rendimiento Académico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">{Math.round(stats?.completionRate || 0)}%</p>
                <p className="text-xs text-muted-foreground">Tasa media de finalización de clases</p>
              </div>
            </div>
            <Progress value={stats?.completionRate} className="h-2 bg-indigo-50" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" /> Salud de Cobranza
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-3xl font-bold">{Math.round(stats?.healthRatio || 0)}%</p>
                <p className="text-xs text-muted-foreground">Ratio alumnos activos vs total</p>
              </div>
            </div>
            <Progress value={stats?.healthRatio} className="h-2 bg-green-50" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;