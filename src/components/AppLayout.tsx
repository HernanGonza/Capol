import { ReactNode, useState } from "react";
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
} from "lucide-react";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  // Definición de rutas según el rol
  const navItems = isAdmin
    ? [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/courses", label: "Cursos", icon: BookOpen },
        { to: "/admin/students", label: "Alumnos", icon: Users },
        { to: "/admin/subscriptions", label: "Suscripciones", icon: CreditCard },
        { to: "/admin/teachers", label: "Profesores", icon: UserPlus },
      ]
    : isTeacher
    ? [
        { to: "/teacher", label: "Mi Panel", icon: LayoutDashboard },
        { to: "/dashboard", label: "Vista Alumno", icon: BookOpen },
      ]
    : [
        { to: "/dashboard", label: "Mis Cursos", icon: BookOpen },
        { to: "/student/subscriptions", label: "Mis Suscripciones", icon: CreditCard },
      ];

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
        <div className={`p-4 flex items-center border-b border-sidebar-border/50 ${collapsed ? "justify-center" : "justify-between"}`}>
          <Link to="/" className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-xl shadow-sm flex items-center justify-center overflow-hidden bg-white shrink-0">
              <img 
                src="/logo-capol.webp" 
                alt="Logo CAPOL" 
                className="w-full h-full object-contain" 
              />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight leading-none">Plataforma</span>
                <span className="font-black text-lg text-primary tracking-tighter">CAPOL</span>
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
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/dashboard" && item.to !== "/teacher" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer del Sidebar (Perfil y Logout) */}
        <div className={`p-3 border-t border-sidebar-border/50 bg-sidebar-accent/30 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 bg-white/50 rounded-xl border border-white/20">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner shrink-0 ${
                isTeacher ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "gradient-hero"
              }`}>
                {(profile?.full_name || "U")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate text-sidebar-foreground">
                  {profile?.full_name || "Usuario"}
                </p>
                <div className="flex items-center gap-1">
                  {getRoleBadge()}
                </div>
              </div>
            </div>
          )}
          
          {collapsed && (
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner ${
              isTeacher ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "gradient-hero"
            }`} title={profile?.full_name || "Usuario"}>
              {(profile?.full_name || "U")[0].toUpperCase()}
            </div>
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
        {/* Header Mobile Only */}
        <header className="h-14 border-b flex items-center justify-between px-4 lg:hidden bg-card/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-full">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-bold text-lg tracking-tighter">CAPOL</span>
          </div>
          <div className={`w-8 h-8 rounded-full ${isTeacher ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "gradient-hero"}`} />
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
