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
  X,
  Shield,
} from "lucide-react";

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { role, profile, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = role === "admin";

  // Definición de rutas según el rol
  const navItems = isAdmin
    ? [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/courses", label: "Cursos", icon: BookOpen },
        { to: "/admin/students", label: "Alumnos", icon: Users },
        { to: "/admin/subscriptions", label: "Suscripciones", icon: CreditCard },
      ]
    : [
        { to: "/dashboard", label: "Mis Cursos", icon: BookOpen },
        { to: "/student/subscriptions", label: "Mis Suscripciones", icon: CreditCard },
      ];

  return (
    <div className="min-h-screen flex bg-background font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header del Sidebar */}
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
          <div className="w-9 h-9 rounded-xl shadow-sm flex items-center justify-center overflow-hidden bg-white">
            <img 
              src="/logo-capol.webp" 
              alt="Logo CAPOL" 
              className="w-full h-full object-contain" 
            />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight leading-none">Plataforma</span>
            <span className="font-black text-lg text-primary tracking-tighter">CAPOL</span>
          </div>
        </div>

        {/* Navegación Principal */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer del Sidebar (Perfil y Logout) */}
        <div className="p-4 border-t border-sidebar-border/50 bg-sidebar-accent/30">
          <div className="flex items-center gap-3 px-2 py-3 mb-3 bg-white/50 rounded-xl border border-white/20">
            <div className="w-10 h-10 rounded-full gradient-hero flex items-center justify-center text-sm font-bold text-white shadow-inner">
              {(profile?.full_name || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-sidebar-foreground">
                {profile?.full_name || "Usuario"}
              </p>
              <div className="flex items-center gap-1">
                {isAdmin ? (
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-orange-500">
                    <Shield className="w-3 h-3" /> Admin
                  </div>
                ) : (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40">Alumno</p>
                )}
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors font-semibold"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Header Mobile Only */}
        <header className="h-16 border-b flex items-center justify-between px-6 lg:hidden bg-card/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-full">
              <Menu className="w-6 h-6" />
            </Button>
            <span className="font-bold text-lg tracking-tighter">CAPOL</span>
          </div>
          <div className="w-8 h-8 rounded-full gradient-hero" />
        </header>

        {/* Contenido Dinámico */}
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;