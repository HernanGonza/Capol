import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, UserPlus, GraduationCap, Percent, Globe, Wallet } from "lucide-react";

const AdminMetricas = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-metricas-acceso"],
    queryFn: async () => {
      const [
        { count: visitas },
        { data: visitasPorPais },
        { count: registrados },
        { data: perfilesPorPais },
        { data: inscriptos },
        { data: pagosPorMedio },
      ] = await Promise.all([
        supabase.from("landing_visits").select("*", { count: "exact", head: true }),
        supabase.from("landing_visits").select("pais_code"),
        supabase.from("perfiles").select("*", { count: "exact", head: true }),
        supabase.from("perfiles").select("pais"),
        supabase.from("inscripciones").select("usuario_id").not("usuario_id", "is", null),
        supabase.from("suscripciones").select("proveedor_pago").not("proveedor_pago", "is", null),
      ]);

      // Contamos alumnos distintos, no filas: un alumno inscripto en 3 cursos
      // sigue siendo 1 solo alumno "convertido".
      const registradosConCurso = new Set((inscriptos || []).map((i) => i.usuario_id)).size;

      // "Argentina" vs "resto del mundo": lo único que hoy nos importa para
      // decidir en qué moneda se muestra el precio (ver PriceTag), así que
      // es el corte más útil para ver de dónde viene la conversión real.
      const visitasArgentina = (visitasPorPais || []).filter((v) => v.pais_code === "AR").length;
      const visitasOtrosPaises = (visitasPorPais || []).filter((v) => v.pais_code && v.pais_code !== "AR").length;
      const visitasSinPais = (visitasPorPais || []).length - visitasArgentina - visitasOtrosPaises;

      const registradosArgentina = (perfilesPorPais || []).filter((p) => p.pais === "Argentina").length;
      const registradosOtrosPaises = (perfilesPorPais || []).filter((p) => p.pais && p.pais !== "Argentina").length;

      const medioPagoCounts = new Map<string, number>();
      for (const s of pagosPorMedio || []) {
        if (!s.proveedor_pago) continue;
        medioPagoCounts.set(s.proveedor_pago, (medioPagoCounts.get(s.proveedor_pago) || 0) + 1);
      }
      const medioPagoRanking = Array.from(medioPagoCounts.entries())
        .map(([medio, cantidad]) => ({ medio, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
      const totalConMedioPago = medioPagoRanking.reduce((acc, m) => acc + m.cantidad, 0);

      return {
        visitas: visitas || 0,
        registrados: registrados || 0,
        registradosConCurso,
        tasaConversion: registrados ? (registradosConCurso / registrados) * 100 : 0,
        visitasArgentina,
        visitasOtrosPaises,
        visitasSinPais,
        registradosArgentina,
        registradosOtrosPaises,
        medioPagoRanking,
        totalConMedioPago,
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

  const visitasTotalConPais = (stats?.visitasArgentina || 0) + (stats?.visitasOtrosPaises || 0);
  const pctVisitasAR = visitasTotalConPais ? Math.round(((stats?.visitasArgentina || 0) / visitasTotalConPais) * 100) : 0;

  const registradosTotalConPais = (stats?.registradosArgentina || 0) + (stats?.registradosOtrosPaises || 0);
  const pctRegistradosAR = registradosTotalConPais ? Math.round(((stats?.registradosArgentina || 0) / registradosTotalConPais) * 100) : 0;

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

        {/* Argentina vs resto del mundo — mismo corte que usa el precio
            automático (PriceTag) para decidir pesos vs dólares. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-none shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" /> Visitas por origen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">🇦🇷 Argentina</span>
                <span className="text-muted-foreground">{stats?.visitasArgentina} ({pctVisitasAR}%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pctVisitasAR}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">🌎 Otros países</span>
                <span className="text-muted-foreground">{stats?.visitasOtrosPaises} ({100 - pctVisitasAR}%)</span>
              </div>
              {!!stats?.visitasSinPais && (
                <p className="text-xs text-muted-foreground">
                  + {stats.visitasSinPais} visita{stats.visitasSinPais === 1 ? "" : "s"} sin país detectado
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-muted-foreground" /> Registrados por origen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">🇦🇷 Argentina</span>
                <span className="text-muted-foreground">{stats?.registradosArgentina} ({pctRegistradosAR}%)</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pctRegistradosAR}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">🌎 Otros países</span>
                <span className="text-muted-foreground">{stats?.registradosOtrosPaises} ({100 - pctRegistradosAR}%)</span>
              </div>
              <p className="text-xs text-muted-foreground">Según el país cargado en "Mi Perfil" (puede no estar completo para todos).</p>
            </CardContent>
          </Card>
        </div>

        {/* Medios de pago usados en las suscripciones cargadas por el admin. */}
        <Card className="border-none shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" /> Medios de pago más usados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.medioPagoRanking.length ? (
              stats.medioPagoRanking.map(({ medio, cantidad }) => {
                const pct = stats.totalConMedioPago ? Math.round((cantidad / stats.totalConMedioPago) * 100) : 0;
                return (
                  <div key={medio} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{medio}</span>
                      <span className="text-muted-foreground">{cantidad} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no hay suscripciones con medio de pago cargado. Se completa desde "Suscripciones" al registrar o editar un pago.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminMetricas;
