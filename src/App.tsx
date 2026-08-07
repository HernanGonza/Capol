import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/hooks/use-theme";
import ScrollToTop from "@/components/ScrollToTop";
import CookieConsent from "@/components/CookieConsent";
// La landing es la puerta de entrada de cualquier visitante anónimo (y la
// única página que le importa a Google/redes sociales) — se importa eager
// para que no dependa de un segundo viaje de red. Todo lo demás requiere
// login o es secundario, así que se carga con lazy() y solo pesa para quien
// realmente navega ahí, en vez de sumarse al bundle inicial de la landing.
import Landing from "./pages/Landing";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Terminos = lazy(() => import("./pages/Terminos"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminLessons = lazy(() => import("./pages/AdminLessons"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const AdminFinanzas = lazy(() => import("./pages/AdminFinanzas"));
const AdminTeachers = lazy(() => import("./pages/AdminTeachers"));
const AdminSolicitudes = lazy(() => import("./pages/AdminSolicitudes"));
const AdminMetricas = lazy(() => import("./pages/AdminMetricas"));
const AdminSeguridad = lazy(() => import("./pages/AdminSeguridad"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const TeacherLessons = lazy(() => import("./pages/TeacherLessons"));
const CourseView = lazy(() => import("./pages/CourseView"));
const NotFound = lazy(() => import("./pages/NotFound"));
const StudentSubscriptions = lazy(() => import("./components/student/StudentSubscriptions"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({
  children,
  adminOnly = false,
  teacherAllowed = false
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  teacherAllowed?: boolean;
}) => {
  const { user, loading, role } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  if (adminOnly) {
    if (role === "admin") return <>{children}</>;
    if (teacherAllowed && role === "teacher") return <>{children}</>;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const TeacherRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, role } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "teacher" && role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ScrollToTop />
          <CookieConsent />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/terminos" element={<Terminos />} />
            <Route path="/privacidad" element={<Privacidad />} />
            
            {/* Rutas protegidas generales */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/course/:courseId" element={<ProtectedRoute><CourseView /></ProtectedRoute>} />
            <Route path="/student/subscriptions" element={<ProtectedRoute><StudentSubscriptions /></ProtectedRoute>} />
            
            {/* Rutas de Admin */}
            <Route path="/admin/courses" element={<ProtectedRoute adminOnly><AdminCourses /></ProtectedRoute>} />
            <Route path="/admin/courses/:courseId/lessons" element={<ProtectedRoute adminOnly teacherAllowed><AdminLessons /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute adminOnly><AdminStudents /></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute adminOnly><AdminSubscriptions /></ProtectedRoute>} />
            <Route path="/admin/finanzas" element={<ProtectedRoute adminOnly><AdminFinanzas /></ProtectedRoute>} />
            <Route path="/admin/solicitudes" element={<ProtectedRoute adminOnly><AdminSolicitudes /></ProtectedRoute>} />
            <Route path="/admin/metricas" element={<ProtectedRoute adminOnly><AdminMetricas /></ProtectedRoute>} />
            <Route path="/admin/seguridad" element={<ProtectedRoute adminOnly><AdminSeguridad /></ProtectedRoute>} />
            <Route path="/admin/teachers" element={<ProtectedRoute adminOnly><AdminTeachers /></ProtectedRoute>} />
            
            {/* Rutas de Profesor */}
            <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="/teacher/course/:courseId/lessons" element={<TeacherRoute><TeacherLessons /></TeacherRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;