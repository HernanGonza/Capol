import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  CreditCard,
  LogOut,
  Menu,
  ChevronLeft,
  Shield,
  GraduationCap,
  UserPlus,
  ClipboardList,
  UserCircle,
  MessageSquare,
  Wallet,
  BarChart3,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell, { type ForoActividadCurso } from "@/components/NotificationBell";
import PaymentDueBanner from "@/components/student/PaymentDueBanner";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { startOnboardingTour } from "@/lib/onboardingTour";
import WelcomeModal from "@/components/WelcomeModal";
import { WHATSAPP_NUMBER } from "@/lib/whatsapp";

// Cada página envuelve su propio contenido en <AppLayout>, así que este
// componente (y con él, el <nav> del sidebar) se remonta en cada cambio de
// ruta. Sin esto, el <nav> nace como un DOM nuevo con scrollTop en 0, y en un
// sidebar largo (como el del admin) cada click a un item de más abajo "salta"
// visualmente para arriba. Se guarda afuera del componente para que
// sobreviva al remount (se resetea solo con un refresh de página, que es lo
// esperable).
let sidebarScrollTop = 0;

// El sidebar colapsado/expandido es una preferencia del usuario, no un
// estado de sesión — se guarda en localStorage (mismo criterio que el tema
// claro/oscuro) para que sobreviva tanto a un cambio de ruta (AppLayout se
// remonta en cada uno, ver más arriba) como a un refresh de página entero.
const SIDEBAR_COLLAPSED_KEY = "capol-sidebar-collapsed";
const getInitialCollapsed = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
};

// Evita que el tour se vuelva a disparar en cada remount de AppLayout (pasa
// en cada cambio de ruta, ver comentario de "sidebarScrollTop") mientras
// dure la sesión del mismo usuario. Se guarda por id de usuario (no un
// simple booleano) para que, si en la misma pestaña cierra sesión y entra
// OTRA cuenta sin recargar la página, el tour de esa cuenta nueva se pueda
// disparar igual.
let tourStartedForUserId: string | null = null;

// Último "ultimoCreadoEn" de actividad de foro visto por curso, para poder
// detectar mensajes nuevos por polling (ver el useEffect del toast de foro
// más abajo) sin depender de Realtime. Vive a nivel de módulo por el mismo
// motivo que "tourStartedForUserId": sobrevive al remount de AppLayout en
// cada cambio de ruta.
let lastForoVistoPorCurso: Map<string, string> | null = null;
let lastForoVistoUserId: string | null = null;

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, role, profile, signOut, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(getInitialCollapsed);
  const setCollapsed = (value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  };
  const navRef = useRef<HTMLElement>(null);
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";

  const { data: paymentStatus } = usePaymentStatus(isStudent ? user?.id : undefined);

  useEffect(() => {
    if (navRef.current) navRef.current.scrollTop = sidebarScrollTop;
  }, []);

  // Modal de bienvenida: se muestra una sola vez por usuario, antes que
  // nada (incluido el tour de driver.js de abajo, que solo arranca una vez
  // que "bienvenida_vista" ya quedó en true).
  const showWelcome = !!user && !!profile && !profile.bienvenida_vista;
  const handleCloseWelcome = async () => {
    if (!user) return;
    await supabase.from("perfiles").update({ bienvenida_vista: true }).eq("id", user.id);
    refreshProfile();
  };

  // Tour de bienvenida: se muestra una sola vez por usuario NUEVO (o hasta
  // que llegue al final y toque "Finalizar Tour"). Apunta solo a elementos
  // que están siempre en el sidebar (sin depender de navegar de página en
  // página) — en mobile el sidebar arranca cerrado, así que si hace falta
  // se abre solo para el tour y se vuelve a cerrar al terminar.
  useEffect(() => {
    if (!user || !role || !profile) return;
    if (!profile.bienvenida_vista) return; // primero el modal de bienvenida
    if (profile.tour_completado) return;
    if (tourStartedForUserId === user.id) return;
    tourStartedForUserId = user.id;

    let cancelled = false;
    let openedSidebarForTour = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (!isDesktop && !sidebarOpen) {
        openedSidebarForTour = true;
        setSidebarOpen(true);
      }

      // Esperar a que termine la transición de apertura del sidebar mobile
      // (duration-300 en el <aside>) antes de que driver.js mida posiciones.
      await new Promise((resolve) => setTimeout(resolve, openedSidebarForTour ? 350 : 50));
      if (cancelled) return;

      await startOnboardingTour({
        role,
        onFinish: async () => {
          await supabase.from("perfiles").update({ tour_completado: true }).eq("id", user.id);
          refreshProfile();
        },
        onEnd: () => {
          if (openedSidebarForTour) setSidebarOpen(false);
        },
      });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role, profile?.tour_completado, profile?.bienvenida_vista]);

  const { data: solicitudesPendientes } = useQuery({
    queryKey: ["solicitudes-pendientes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("solicitudes_inscripcion")
        .select("*", { count: "exact", head: true })
        .eq("estado", "pendiente");
      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: diferidosVencidos } = useQuery({
    queryKey: ["diferidos-vencidos-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("suscripciones")
        .select("*", { count: "exact", head: true })
        .eq("estado", "pago_diferido")
        .is("suspendida_en", null)
        .lte("pago_diferido_hasta", new Date().toISOString());
      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const { data: alertasSeguridadPendientes } = useQuery({
    queryKey: ["alertas-seguridad-pendientes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("alertas_seguridad")
        .select("*", { count: "exact", head: true })
        .eq("resuelta", false);
      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: mensajesNoLeidos } = useQuery({
    queryKey: ["mensajes-no-leidos-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("mensajes")
        .select("*", { count: "exact", head: true })
        .eq("destinatario_id", user!.id)
        .eq("leido", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Actividad nueva en los foros de curso: no hay "leido" por mensaje (no
  // tiene sentido en uno grupal), así que se compara contra la marca de
  // "hasta cuándo leí este foro" de cada curso (foro_ultima_lectura).
  // Se desglosa por curso (no solo un total) para poder mostrar la
  // campanita de notificaciones con el detalle de qué curso tiene novedades.
  const { data: foroActividad } = useQuery({
    queryKey: ["foro-no-leidos-count", user?.id],
    queryFn: async () => {
      const [{ data: ultimaLectura }, { data: mensajesForo }] = await Promise.all([
        supabase.from("foro_ultima_lectura").select("curso_id, leido_hasta").eq("usuario_id", user!.id),
        supabase
          .from("mensajes")
          .select("curso_id, creado_en, contenido, cursos:curso_id(titulo, modalidad)")
          .is("destinatario_id", null)
          .neq("remitente_id", user!.id)
          .eq("eliminado", false),
      ]);
      const map = new Map((ultimaLectura || []).map((r) => [r.curso_id, r.leido_hasta]));
      const porCurso = new Map<string, ForoActividadCurso>();
      let total = 0;
      for (const m of (mensajesForo || []) as any[]) {
        const last = m.curso_id ? map.get(m.curso_id) : null;
        if (!last || new Date(m.creado_en) > new Date(last)) {
          total++;
          if (!m.curso_id) continue;
          const entry = porCurso.get(m.curso_id) || {
            cursoId: m.curso_id as string,
            cursoTitulo: m.cursos?.titulo || "Curso",
            cursoModalidad: (m.cursos?.modalidad as string | null) ?? null,
            count: 0,
            ultimoContenido: m.contenido as string | null,
            ultimoCreadoEn: m.creado_en as string,
          };
          entry.count += 1;
          if (new Date(m.creado_en) > new Date(entry.ultimoCreadoEn)) {
            entry.ultimoContenido = m.contenido;
            entry.ultimoCreadoEn = m.creado_en;
          }
          porCurso.set(m.curso_id, entry);
        }
      }
      return {
        total,
        porCurso: Array.from(porCurso.values()).sort(
          (a, b) => new Date(b.ultimoCreadoEn).getTime() - new Date(a.ultimoCreadoEn).getTime()
        ),
      };
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const foroNoLeidos = foroActividad?.total || 0;
  const foroPorCurso = foroActividad?.porCurso || [];

  // Toast de "nuevo mensaje en el foro" sin Realtime: se detecta comparando
  // el "ultimoCreadoEn" de cada curso entre una vuelta de polling y la
  // siguiente (foroActividad ya refetchea solo cada 60s). Se guarda en una
  // variable de módulo (no un ref) para sobrevivir al remount de AppLayout
  // en cada cambio de ruta, mismo criterio que "tourStartedForUserId" más
  // arriba. Se resetea si cambia el usuario logueado en la misma pestaña,
  // para no comparar contra la actividad de una sesión anterior.
  useEffect(() => {
    if (!user || !foroActividad) return;
    if (lastForoVistoUserId !== user.id) {
      lastForoVistoPorCurso = null;
      lastForoVistoUserId = user.id;
    }
    const previo = lastForoVistoPorCurso;
    if (previo) {
      for (const c of foroActividad.porCurso) {
        const anterior = previo.get(c.cursoId);
        if (anterior && new Date(c.ultimoCreadoEn) > new Date(anterior)) {
          toast("Nuevo mensaje en el foro", {
            description: c.cursoTitulo || "Un curso tiene actividad nueva",
            action: { label: "Ver", onClick: () => navigate(`/messages?curso=${c.cursoId}`) },
          });
        }
      }
    }
    lastForoVistoPorCurso = new Map(foroActividad.porCurso.map((c) => [c.cursoId, c.ultimoCreadoEn]));
  }, [foroActividad, user, navigate]);

  const mensajesBadge = (mensajesNoLeidos || 0) + (foroNoLeidos || 0);

  // Definición de rutas según el rol
  const roleNavItems = isAdmin
    ? [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/courses", label: "Cursos", icon: BookOpen },
        { to: "/admin/students", label: "Alumnos", icon: Users },
        { to: "/admin/solicitudes", label: "Solicitudes", icon: ClipboardList, badge: solicitudesPendientes },
        { to: "/admin/subscriptions", label: "Suscripciones", icon: CreditCard, badge: diferidosVencidos },
        { to: "/admin/finanzas", label: "Finanzas", icon: Wallet },
        { to: "/admin/metricas", label: "Métricas de Acceso", icon: BarChart3 },
        { to: "/admin/teachers", label: "Profesores", icon: UserPlus },
        // El admin también puede estar asignado como docente a algún curso
        // (docentes_cursos) — necesita el mismo acceso que un profesor a sus
        // clases en vivo, no solo la gestión administrativa.
        { to: "/teacher", label: "Mis Clases (Profesor)", icon: GraduationCap },
        { to: "/messages", label: "Mensajes", icon: MessageSquare, badge: mensajesBadge },
      ]
    : isTeacher
    ? [
        { to: "/teacher", label: "Mi Panel", icon: LayoutDashboard },
        { to: "/messages", label: "Mensajes", icon: MessageSquare, badge: mensajesBadge },
      ]
    : [
        { to: "/dashboard", label: "Mis Cursos", icon: BookOpen },
        { to: "/student/subscriptions", label: "Mis Suscripciones", icon: CreditCard },
        { to: "/messages", label: "Mensajes", icon: MessageSquare, badge: mensajesBadge },
      ];

  // "Mi Perfil" se agrega al final para cualquier rol — no forma parte de la
  // navegación específica del rol, pero tiene que estar disponible siempre.
  const navItems = [...roleNavItems, { to: "/profile", label: "Mi Perfil", icon: UserCircle }];

  const getRoleBadge = () => {
    if (isAdmin) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-orange-500">
          <Shield className="w-3 h-3" /> Admin
        </div>
      );
    }
    if (isTeacher) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-400">
          <GraduationCap className="w-3 h-3" /> Profesor
        </div>
      );
    }
    return <p className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">Alumno</p>;
  };

  // Avatar del usuario: si subió una foto en "Mi Perfil" se muestra esa foto;
  // si no, cae al círculo con la inicial del nombre (comportamiento anterior).
  const renderAvatar = (sizeClasses: string, title?: string, id?: string) =>
    profile?.url_avatar ? (
      <img
        id={id}
        src={profile.url_avatar}
        alt={profile?.nombre_completo || "Usuario"}
        title={title}
        className={`${sizeClasses} rounded-full object-cover shadow-inner shrink-0`}
      />
    ) : (
      <div
        id={id}
        title={title}
        className={`${sizeClasses} rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner shrink-0 ${
          isTeacher ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "gradient-hero"
        }`}
      >
        {(profile?.nombre_completo || "U")[0].toUpperCase()}
      </div>
    );

  return (
    <div className="h-screen flex bg-background font-sans overflow-hidden">
      <WelcomeModal open={showWelcome} nombre={profile?.nombre_completo} onClose={handleCloseWelcome} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-all duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "w-[72px]" : "w-64"}`}
      >
        {/* Header del Sidebar */}
        <div className={`shrink-0 p-4 flex items-center border-b border-sidebar-border/50 ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link to={navItems[0].to} className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-full shadow-sm flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/logo-capol.webp"
                alt="Logo CapOL"
                className="w-full h-full object-cover"
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight leading-none">Plataforma</span>
                <span className="font-black text-lg text-primary tracking-tighter">CapOL</span>
              </div>
            )}
          </Link>
          
          {/* Botón colapsar - solo desktop */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {/* Navegación Principal */}
        <nav
          id="tour-sidebar-nav"
          ref={navRef}
          onScroll={(e) => { sidebarScrollTop = e.currentTarget.scrollTop; }}
          className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1"
        >
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`} />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && (item as any).badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {(item as any).badge}
                  </span>
                )}
                {collapsed && (item as any).badge > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                    {(item as any).badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer del Sidebar (Perfil y Logout) */}
        <div className={`shrink-0 p-3 border-t border-sidebar-border/50 bg-sidebar-accent/30 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 bg-white/50 rounded-xl border border-white/20">
              {renderAvatar("w-9 h-9", undefined, "tour-profile-avatar")}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-sidebar-foreground">
                  {profile?.nombre_completo || "Usuario"}
                </p>
                <div className="flex items-center gap-1">
                  {getRoleBadge()}
                </div>
              </div>
            </div>
          )}
          
          {collapsed && renderAvatar("w-9 h-9", profile?.nombre_completo || "Usuario", "tour-profile-avatar")}

          <NotificationBell id="tour-notifications" porCurso={foroPorCurso} collapsed={collapsed} className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
          <ThemeToggle id="tour-theme-toggle" collapsed={collapsed} className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />

          {isAdmin && (
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              asChild
              title={collapsed ? "Seguridad" : undefined}
              className={`relative rounded-lg font-semibold transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent ${
                collapsed ? "w-9 h-9" : "w-full justify-start"
              } ${location.pathname === "/admin/seguridad" ? "bg-sidebar-accent text-sidebar-foreground" : ""}`}
            >
              <Link to="/admin/seguridad" onClick={() => setSidebarOpen(false)}>
                <Shield className="w-4 h-4" />
                {!collapsed && <span className="ml-2 flex-1 text-left">Seguridad</span>}
                {!!alertasSeguridadPendientes && (
                  collapsed ? (
                    <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                      {alertasSeguridadPendientes}
                    </span>
                  ) : (
                    <span className="bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                      {alertasSeguridadPendientes}
                    </span>
                  )
                )}
              </Link>
            </Button>
          )}

          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={`text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-semibold ${
              collapsed ? "w-9 h-9" : "w-full justify-start"
            }`}
            onClick={signOut}
            title={collapsed ? "Cerrar sesión" : undefined}
          >
            <LogOut className={`w-4 h-4 ${collapsed ? "" : "mr-2"}`} />
            {!collapsed && "Cerrar sesión"}
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {isStudent && paymentStatus && paymentStatus.length > 0 && <PaymentDueBanner items={paymentStatus} />}

        {/* Header Mobile Only */}
        <header className="h-14 border-b flex items-center justify-between px-4 lg:hidden bg-card/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-full">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-bold text-lg tracking-tighter">CapOL</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell porCurso={foroPorCurso} collapsed />
            <ThemeToggle collapsed />
            {renderAvatar("w-8 h-8")}
          </div>
        </header>

        {/* Contenido Dinámico - SCROLLEABLE */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Botón flotante de WhatsApp (mismo número y estilo que en la landing) */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribinos por WhatsApp"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-2xl shadow-emerald-500/30 flex items-center justify-center hover:scale-110 transition-transform"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
        </svg>
      </a>
    </div>
  );
};

export default AppLayout;