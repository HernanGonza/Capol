import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, role, profile, signOut } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

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
  const { data: foroNoLeidos } = useQuery({
    queryKey: ["foro-no-leidos-count", user?.id],
    queryFn: async () => {
      const [{ data: ultimaLectura }, { data: mensajesForo }] = await Promise.all([
        supabase.from("foro_ultima_lectura").select("curso_id, leido_hasta").eq("usuario_id", user!.id),
        supabase
          .from("mensajes")
          .select("curso_id, creado_en")
          .is("destinatario_id", null)
          .neq("remitente_id", user!.id)
          .eq("eliminado", false),
      ]);
      const map = new Map((ultimaLectura || []).map((r) => [r.curso_id, r.leido_hasta]));
      let count = 0;
      for (const m of mensajesForo || []) {
        const last = m.curso_id ? map.get(m.curso_id) : null;
        if (!last || new Date(m.creado_en) > new Date(last)) count++;
      }
      return count;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Una sola conexión Realtime por sesión logueada, escuchando cambios en
  // "mensajes". Supabase Realtime respeta la RLS de la tabla: cada cliente
  // solo recibe los eventos de filas que ya podría ver por su propia policy
  // de SELECT, así que no hace falta duplicar acá ningún filtro de permisos.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`mensajes-realtime-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mensajes-no-leidos-count", user.id] });
        queryClient.invalidateQueries({ queryKey: ["foro-no-leidos-count", user.id] });
        queryClient.invalidateQueries({ queryKey: ["mensajes", user.id] });
        queryClient.invalidateQueries({ queryKey: ["foro-curso"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const mensajesBadge = (mensajesNoLeidos || 0) + (foroNoLeidos || 0);

  // Definición de rutas según el rol
  const roleNavItems = isAdmin
    ? [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/courses", label: "Cursos", icon: BookOpen },
        { to: "/admin/students", label: "Alumnos", icon: Users },
        { to: "/admin/subscriptions", label: "Suscripciones", icon: CreditCard },
        { to: "/admin/finanzas", label: "Finanzas", icon: Wallet },
        { to: "/admin/teachers", label: "Profesores", icon: UserPlus },
        { to: "/admin/solicitudes", label: "Solicitudes", icon: ClipboardList, badge: solicitudesPendientes },
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
  const renderAvatar = (sizeClasses: string, title?: string) =>
    profile?.url_avatar ? (
      <img
        src={profile.url_avatar}
        alt={profile?.nombre_completo || "Usuario"}
        title={title}
        className={`${sizeClasses} rounded-full object-cover shadow-inner shrink-0`}
      />
    ) : (
      <div
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
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
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
              {renderAvatar("w-9 h-9")}
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
          
          {collapsed && renderAvatar("w-9 h-9", profile?.nombre_completo || "Usuario")}
          
          <ThemeToggle collapsed={collapsed} className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent" />

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
        {/* Header Mobile Only */}
        <header className="h-14 border-b flex items-center justify-between px-4 lg:hidden bg-card/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-full">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-bold text-lg tracking-tighter">CapOL</span>
          </div>
          <div className="flex items-center gap-1">
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
    </div>
  );
};

export default AppLayout;