import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, UserPlus, GraduationCap, Percent } from "lucide-react";

const AdminMetricas = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-metricas-acceso"],
    queryFn: async () => {
      const [
        { count: visitas },
        { count: registrados },
        { data: inscriptos },
      ] = await Promise.all([
        supabase.from("landing_visits").select("*", { count: "exact", head: true }),
        supabase.from("perfiles").select("*", { count: "exact", head: true }),
        supabase.from("inscripciones").select("usuario_id").not("usuario_id", "is", null),
      ]);

      // Contamos alumnos distintos, no filas: un alumno inscripto en 3 cursos
      // sigue siendo 1 solo alumno "convertido".
      const registradosConCurso = new Set((inscriptos || []).map((i) => i.usuario_id)).size;

      return {
        visitas: visitas || 0,
        registrados: registrados || 0,
        registradosConCurso,
        tasaConversion: registrados ? (registradosConCurso / registrados) * 100 : 0,
      };
    },
  });

  if (isLoading) return <AppLayout><div className="p-8 text-center animate-pulse text-muted-foreground">Cargando métricas...</div></AppLayout>;

  const cards = [
    {
      title: "Visitas a la Landing",
      value: stats?.visitas,
      description: "Cargas totales de la página principal",
      icon: Eye,
      color: "bg-primary text-primary-foreground",
    },
    {
      title: "Registrados",
      value: stats?.registrados,
      description: "Cuentas creadas en la plataforma",
      icon: UserPlus,
      color: "bg-card",
    },
    {
      title: "Registrados con curso",
      value: stats?.registradosConCurso,
      description: "Se registraron y se inscribieron a algún curso",
      icon: GraduationCap,
      color: "bg-card",
    },
    {
      title: "Tasa de conversión",
      value: `${Math.round(stats?.tasaConversion || 0)}%`,
      description: "Registrados que terminaron inscribiéndose",
      icon: Percent,
      color: "bg-card",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Métricas de Acceso</h1>
          <p className="text-muted-foreground">Visitas a la Landing y conversión de visitantes en alumnos.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, idx) => (
            <Card key={idx} className={`border-none shadow-card ${card.color}`}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium opacity-90">{card.title}</CardTitle>
                <card.icon className="w-4 h-4 opacity-70" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs opacity-70 mt-1">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminMetricas;
