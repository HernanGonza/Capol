import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, UserPlus, GraduationCap, Percent, Globe, Wallet, Users } from "lucide-react";
import AlumnosPorCursoCard from "@/components/admin/AlumnosPorCursoCard";

// Traduce un código ISO de país (ej "TH") a su nombre en español. Usa la API
// nativa del navegador en vez de un mapa a mano — cubre todos los países del
// mundo, no solo los más comunes entre los alumnos (que es lo que sí alcanza
// para el mapa chico que usa el conversor de moneda en lib/currency.ts).
const countryDisplayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["es"], { type: "region" }) : null;
const countryName = (code: string) => {
  try {
    return countryDisplayNames?.of(code) || code;
  } catch {
    return code;
  }
};

const AdminMetricas = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-metricas-acceso"],
    queryFn: async () => {
      const [
        { count: visitas },
        { data: visitasPorPais },
        { data: perfiles },
        { data: suscripciones },
        { data: pagos },
        { data: roles },
      ] = await Promise.all([
        supabase.from("landing_visits").select("*", { count: "exact", head: true }),
        supabase.from("landing_visits").select("pais_code"),
        supabase.from("perfiles").select("id, pais"),
        supabase.from("suscripciones").select("id, usuario_id, estado, proveedor_pago"),
        supabase.from("pagos").select("suscripcion_id"),
        supabase.from("roles_usuario").select("usuario_id, rol"),
      ]);

      // Todas las métricas de "registrados" / "conversión" son SOLO de alumnos:
      // un profesor o admin no es un visitante convertido en alumno. Además,
      // cuando alguien se registra siempre entra como 'student' y recién cuando
      // un admin lo pasa a profesor cambia su fila en "roles_usuario" — así que
      // filtrar por rol acá hace que la estadística se reacomode sola cuando eso
      // pasa (deja de contarlo como alumno).
      const alumnoIds = new Set(
        (roles || []).filter((r) => r.rol === "student").map((r) => r.usuario_id)
      );
      const registrados = alumnoIds.size;
      const perfilesAlumnos = (perfiles || []).filter((p) => alumnoIds.has(p.id));

      // "Registrados con curso" = se inscribió a algún curso, haya pagado o no.
      // OJO: antes esto contaba la tabla "inscripciones", pero desde la migración
      // 20260825183614_restrict_unpaid_subscription_access esa tabla solo guarda
      // a los alumnos con el pago hecho (estado 'active'), así que dejaba afuera
      // a todos los que se inscribieron y todavía no pagaron (la enorme mayoría).
      // La fuente real de "quién se inscribió" es "suscripciones": una fila por
      // alumno+curso desde que la solicitud queda aprobada. Excluimos 'expired'
      // (bajas / suscripciones vencidas y no renovadas).
      const inscriptosVigentes = (suscripciones || []).filter(
        (s) =>
          (s.estado === "active" ||
            s.estado === "pago_pendiente" ||
            s.estado === "pago_diferido") &&
          alumnoIds.has(s.usuario_id)
      );
      // Alumnos distintos, no filas: un alumno inscripto en 3 cursos es 1 solo.
      const registradosConCurso = new Set(inscriptosVigentes.map((s) => s.usuario_id)).size;
      // De esos, cuántos ya tienen el pago hecho (suscripción 'active').
      const registradosConPago = new Set(
        (suscripciones || [])
          .filter((s) => s.estado === "active" && alumnoIds.has(s.usuario_id))
          .map((s) => s.usuario_id)
      ).size;

      // "Argentina" vs "resto del mundo": lo único que hoy nos importa para
      // decidir en qué moneda se muestra el precio (ver PriceTag), así que
      // es el corte más útil para ver de dónde viene la conversión real.
      const visitasArgentina = (visitasPorPais || []).filter((v) => v.pais_code === "AR").length;
      const visitasOtrosPaises = (visitasPorPais || []).filter((v) => v.pais_code && v.pais_code !== "AR").length;
      const visitasSinPais = (visitasPorPais || []).length - visitasArgentina - visitasOtrosPaises;

      const registradosArgentina = perfilesAlumnos.filter((p) => p.pais === "Argentina").length;
      const registradosOtrosPaises = perfilesAlumnos.filter((p) => p.pais && p.pais !== "Argentina").length;

      // Detalle de qué países específicos forman "otros países" — pais_code
      // es un código ISO (viene de la geolocalización), se traduce a nombre
      // con countryName(); en perfiles.pais ya queda guardado el nombre
      // directo (es lo que el usuario eligió al registrarse).
      const visitasPorPaisMap = new Map<string, number>();
      for (const v of visitasPorPais || []) {
        if (!v.pais_code || v.pais_code === "AR") continue;
        visitasPorPaisMap.set(v.pais_code, (visitasPorPaisMap.get(v.pais_code) || 0) + 1);
      }
      const visitasPorPaisRanking = Array.from(visitasPorPaisMap.entries())
        .map(([code, cantidad]) => ({ pais: countryName(code), cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      const registradosPorPaisMap = new Map<string, number>();
      for (const p of perfilesAlumnos) {
        if (!p.pais || p.pais === "Argentina") continue;
        registradosPorPaisMap.set(p.pais, (registradosPorPaisMap.get(p.pais) || 0) + 1);
      }
      const registradosPorPaisRanking = Array.from(registradosPorPaisMap.entries())
        .map(([pais, cantidad]) => ({ pais, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);

      // Medios de pago: SOLO de pagos reales (tabla "pagos"). El campo
      // "proveedor_pago" de la suscripción se completa al aprobar la
      // inscripción con la forma de pago que el alumno eligió, aunque todavía
      // no haya pagado — contar eso mostraba medios de pago "usados" cuando en
      // realidad no hubo ninguna plata. Cada pago real se cruza con su
      // suscripción para saber con qué medio se cobró.
      const proveedorPorSuscripcion = new Map(
        (suscripciones || []).map((s) => [s.id, s.proveedor_pago])
      );
      const medioPagoCounts = new Map<string, number>();
      for (const p of pagos || []) {
        const medio = proveedorPorSuscripcion.get(p.suscripcion_id);
        if (!medio) continue;
        medioPagoCounts.set(medio, (medioPagoCounts.get(medio) || 0) + 1);
      }
      const medioPagoRanking = Array.from(medioPagoCounts.entries())
        .map(([medio, cantidad]) => ({ medio, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
      const totalConMedioPago = medioPagoRanking.reduce((acc, m) => acc + m.cantidad, 0);

      const registradosAlumnos = alumnoIds.size;
      const registradosProfesores = (roles || []).filter((r) => r.rol === "teacher").length;
      const registradosAdmins = (roles || []).filter((r) => r.rol === "admin").length;

      return {
        visitas: visitas || 0,
        registrados,
        registradosConCurso,
        registradosConPago,
        tasaConversion: registrados ? (registradosConCurso / registrados) * 100 : 0,
        visitasArgentina,
        visitasOtrosPaises,
        visitasSinPais,
        registradosArgentina,
        registradosOtrosPaises,
        visitasPorPaisRanking,
        registradosPorPaisRanking,
        medioPagoRanking,
        totalConMedioPago,
        registradosAlumnos,
        registradosProfesores,
        registradosAdmins,
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
      title: "Alumnos registrados",
      value: stats?.registrados,
      description: "Cuentas con rol alumno (sin contar profesores ni admins)",
      icon: UserPlus,
      color: "bg-card",
      extra: (
        <p className="text-[11px] text-muted-foreground/80 mt-2 pt-2 border-t border-border/50">
          Aparte: {stats?.registradosProfesores || 0} profesores · {stats?.registradosAdmins || 0} admins
        </p>
      ),
    },
    {
      title: "Registrados con curso",
      value: stats?.registradosConCurso,
      description: "Se registraron y se inscribieron a algún curso (con pago hecho o pendiente)",
      icon: GraduationCap,
      color: "bg-card",
      extra: (
        <p className="text-[11px] text-muted-foreground/80 mt-2 pt-2 border-t border-border/50">
          {stats?.registradosConPago || 0} con el pago hecho · {(stats?.registradosConCurso || 0) - (stats?.registradosConPago || 0)} con pago pendiente
        </p>
      ),
    },
    {
      title: "Tasa de conversión",
      value: `${Math.round(stats?.tasaConversion || 0)}%`,
      description: "Alumnos registrados que se inscribieron a un curso",
      icon: Percent,
      color: "bg-card",
    },
  ];

  const visitasTotalConPais = (stats?.visitasArgentina || 0) + (stats?.visitasOtrosPaises || 0);
  const pctVisitasAR = visitasTotalConPais ? Math.round(((stats?.visitasArgentina || 0) / visitasTotalConPais) * 100) : 0;

  const registradosTotalConPais = (stats?.registradosArgentina || 0) + (stats?.registradosOtrosPaises || 0);
  const pctRegistradosAR = registradosTotalConPais ? Math.round(((stats?.registradosArgentina || 0) / registradosTotalConPais) * 100) : 0;

  const registradosPorRol = [
    { label: "Alumnos", cantidad: stats?.registradosAlumnos || 0 },
    { label: "Profesores", cantidad: stats?.registradosProfesores || 0 },
    { label: "Admins", cantidad: stats?.registradosAdmins || 0 },
  ];
  const totalPorRol = registradosPorRol.reduce((acc, r) => acc + r.cantidad, 0);

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
                {card.extra}
              </CardContent>
            </Card>
          ))}
        </div>

        <AlumnosPorCursoCard />

        {/* Argentina vs resto del mundo — mismo corte que usa el precio
            automático (PriceTag) para decidir pesos vs dólares. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
              {!!stats?.visitasPorPaisRanking.length && (
                <div className="pt-1 space-y-1 border-t">
                  {stats.visitasPorPaisRanking.map(({ pais, cantidad }) => (
                    <div key={pais} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pais}</span>
                      <span>{cantidad}</span>
                    </div>
                  ))}
                </div>
              )}
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
              {!!stats?.registradosPorPaisRanking.length && (
                <div className="pt-1 space-y-1 border-t">
                  {stats.registradosPorPaisRanking.map(({ pais, cantidad }) => (
                    <div key={pais} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pais}</span>
                      <span>{cantidad}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Según el país cargado en "Mi Perfil" (puede no estar completo para todos).</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" /> Registrados por rol
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {registradosPorRol.map(({ label, cantidad }) => {
                const pct = totalPorRol ? Math.round((cantidad / totalPorRol) * 100) : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{label}</span>
                      <span className="text-muted-foreground">{cantidad} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Medios de pago de los pagos reales registrados (tabla "pagos"). */}
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
                Todavía no hay pagos registrados. Se completa a medida que se cargan pagos desde "Suscripciones".
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminMetricas;
