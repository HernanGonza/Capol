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
  ClipboardList,
  UserPlus,
  Award,
  Trophy,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-master-stats"],
    queryFn: async () => {
      const inicioDeMes = new Date();
      inicioDeMes.setDate(1);
      inicioDeMes.setHours(0, 0, 0, 0);

      const [
        { data: roles },
        { data: subs },
        { data: courses },
        { data: progress },
        { data: teacherRoles },
        { data: enrollments },
        { data: allProfiles },
      ] = await Promise.all([
        supabase.from("roles_usuario").select("usuario_id").eq("rol", "student"),
        supabase.from("suscripciones").select("usuario_id, curso_id, estado, price, moneda, suspendida_en, pago_diferido_hasta"),
        supabase.from("cursos").select("id, titulo, publicado"),
        supabase.from("progreso_lecciones").select("completado"),
        supabase.from("roles_usuario").select("usuario_id").eq("rol", "teacher"),
        supabase.from("inscripciones").select("usuario_id, completado_en"),
        supabase.from("perfiles").select("id, creado_en"),
      ]);

      const totalStudents = roles?.length || 0;
      const activeCourses = courses?.filter(c => c.publicado).length || 0;

      // Todas las métricas de alumnos son solo de cuentas con rol 'student':
      // un profesor/admin con una suscripción no debe inflar los conteos. Al
      // promover a alguien a profesor, su fila de "roles_usuario" deja de ser
      // 'student' y sale solo de estas cuentas.
      const studentIds = new Set((roles || []).map((r) => r.usuario_id));
      const subsAlumnos = (subs || []).filter((s) => studentIds.has(s.usuario_id));

      // OJO con los estados de "suscripciones":
      //  - 'active'        = inscripto Y con el pago hecho / al día
      //  - 'pago_pendiente'= inscripto pero todavía sin pagar (la gran mayoría hoy)
      //  - 'expired'       = suscripción vencida / de baja
      // Desde la migración restrict_unpaid_subscription_access, 'active' dejó de
      // significar "inscripto" y pasó a significar "pagó". Para todo lo que es
      // "cuántos alumnos tiene un curso" / "cursos más populares" hay que contar
      // los inscriptos (active + pago_pendiente), no solo los que pagaron.
      const activeSubs = subsAlumnos.filter((s) => s.estado === 'active');
      const pendingSubs = subsAlumnos.filter((s) => s.estado === 'pago_pendiente');
      const expiredSubs = subsAlumnos.filter((s) => s.estado === 'expired');
      // Pago diferido: acceso concedido a mano, todavía sin pagar. Cuentan como
      // inscriptos pero NO como ingreso.
      const diferidoSubs = subsAlumnos.filter((s) => s.estado === 'pago_diferido');
      const diferidosVencidos = diferidoSubs.filter(
        (s) => !s.suspendida_en && s.pago_diferido_hasta && new Date(s.pago_diferido_hasta) <= new Date()
      ).length;
      const inscritosSubs = [...activeSubs, ...pendingSubs, ...diferidoSubs];

      // Contamos ALUMNOS distintos, no filas de suscripción: un alumno con 2 cursos
      // tiene 2 filas en "suscripciones" pero sigue siendo 1 solo alumno.
      const alumnosInscriptos = new Set(inscritosSubs.map((s) => s.usuario_id)).size;
      const alumnosAlDia = new Set(activeSubs.map((s) => s.usuario_id)).size;
      const alumnosVencidos = new Set(expiredSubs.map((s) => s.usuario_id)).size;
      // "Pagos pendientes" = inscripciones a un curso que todavía no se pagaron
      // (una por alumno+curso), no alumnos distintos.
      const pagosPendientes = pendingSubs.length;
      // Agrupamos por moneda: sumar ARS + USD + EUR como si fueran el mismo número sería incorrecto.
      const revenueByCurrency = activeSubs.reduce((acc: Record<string, number>, curr) => {
        const currency = curr.moneda || "ARS";
        acc[currency] = (acc[currency] || 0) + (curr.price || 0);
        return acc;
      }, {} as Record<string, number>);
      const completionRate = progress?.length ? (progress.filter(p => p.completado).length / progress.length) * 100 : 0;

      const nuevosEsteMes = (allProfiles || []).filter(
        (p) => studentIds.has(p.id) && p.creado_en && new Date(p.creado_en) >= inicioDeMes
      ).length;

      const certificadosEmitidos = (enrollments || []).filter((e) => !!e.completado_en).length;

      // Top cursos por cantidad de alumnos inscriptos (hayan pagado o no).
      const conteoPorCurso = inscritosSubs.reduce((acc: Record<string, number>, s) => {
        if (!s.curso_id) return acc;
        acc[s.curso_id] = (acc[s.curso_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topCursos = Object.entries(conteoPorCurso)
        .map(([cursoId, cantidad]) => ({
          titulo: courses?.find((c) => c.id === cursoId)?.titulo || "Curso",
          cantidad: cantidad as number,
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

      return {
        totalStudents,
        activeCourses,
        totalCourses: courses?.length || 0,
        inscriptosCount: alumnosInscriptos,
        activeCount: alumnosAlDia,
        expiredCount: alumnosVencidos,
        pagosPendientes,
        diferidosTotal: diferidoSubs.length,
        diferidosVencidos,
        revenueByCurrency,
        completionRate,
        // Salud de cobranza = de los inscriptos, cuántos están al día con el pago.
        healthRatio: alumnosInscriptos > 0 ? (alumnosAlDia / alumnosInscriptos) * 100 : 0,
        totalTeachers: teacherRoles?.length || 0,
        nuevosEsteMes,
        certificadosEmitidos,
        topCursos,
      };
    },
  });

  if (isLoading) return <div className="p-8 text-center animate-pulse text-muted-foreground">Cargando métricas maestras...</div>;

  const formatRevenue = (byCurrency?: Record<string, number>) => {
    if (!byCurrency || Object.keys(byCurrency).length === 0) return "$0";
    const symbols: Record<string, string> = { ARS: "$", USD: "U$S", EUR: "€" };
    return Object.entries(byCurrency)
      .map(([currency, amount]) => `${symbols[currency] || currency} ${amount.toLocaleString("es-AR")}`)
      .join(" + ");
  };

  const cards = [
    {
      title: "Ingresos Mensuales",
      value: formatRevenue(stats?.revenueByCurrency),
      description: "Suscripciones activas",
      icon: TrendingUp,
      color: "bg-primary text-primary-foreground",
      path: "/admin/subscriptions" // Ajustar según tu ruta de pagos
    },
    {
      title: "Alumnos Totales",
      value: stats?.totalStudents,
      description: `${stats?.inscriptosCount ?? 0} inscriptos a un curso · ${stats?.activeCount ?? 0} con pago al día`,
      icon: Users,
      color: "bg-card",
      path: "/admin/students" // Ajustar según tu ruta de usuarios
    },
    {
      title: "Cursos Publicados",
      value: `${stats?.activeCourses} / ${stats?.totalCourses}`,
      description: "Contenido activo",
      icon: BookOpen,
      color: "bg-card",
      path: "/admin/courses"
    },
    {
      title: "Pagos Pendientes",
      value: stats?.pagosPendientes,
      description: `Inscripciones sin pagar${stats?.expiredCount ? ` · ${stats.expiredCount} vencidas` : ""}${stats?.diferidosTotal ? ` · ${stats.diferidosTotal} diferidos` : ""}`,
      icon: AlertTriangle,
      color: "bg-card text-destructive",
      path: "/admin/subscriptions"
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground">Gestión centralizada de tu academia y facturación.</p>
      </div>

      {!!stats?.diferidosVencidos && (
        <button
          type="button"
          onClick={() => navigate("/admin/subscriptions")}
          className="w-full flex items-center gap-3 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-3 text-sm font-semibold text-left hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {stats.diferidosVencidos === 1
            ? "1 pago diferido venció su fecha comprometida y sigue sin pagarse."
            : `${stats.diferidosVencidos} pagos diferidos vencieron su fecha comprometida y siguen sin pagarse.`}
          <ChevronRight className="w-4 h-4 ml-auto shrink-0" />
        </button>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.totalTeachers}</p>
              <p className="text-xs text-muted-foreground">Profesores activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.nuevosEsteMes}</p>
              <p className="text-xs text-muted-foreground">Alumnos nuevos este mes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats?.certificadosEmitidos}</p>
              <p className="text-xs text-muted-foreground">Certificados emitidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <Progress value={stats?.completionRate} className="h-2 bg-muted" />
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
                <p className="text-xs text-muted-foreground">Inscriptos con el pago al día</p>
              </div>
            </div>
            <Progress value={stats?.healthRatio} className="h-2 bg-muted" />
          </CardContent>
        </Card>

        <Card className="border-none shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Cursos Más Populares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {stats?.topCursos.length ? (
              <>
                {stats.topCursos.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{idx + 1}. {c.titulo}</span>
                    <span className="font-bold text-muted-foreground shrink-0 ml-2">{c.cantidad}</span>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground/80 pt-1.5 mt-1.5 border-t border-border/50">Por alumnos inscriptos (con pago hecho o pendiente)</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Todavía no hay alumnos inscriptos.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;