import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminCourses from "./pages/AdminCourses";
import AdminLessons from "./pages/AdminLessons";
import AdminStudents from "./pages/AdminStudents";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminTeachers from "./pages/AdminTeachers";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherLessons from "./pages/TeacherLessons";
import CourseView from "./pages/CourseView";
import NotFound from "./pages/NotFound";
import StudentSubscriptions from "./components/student/StudentSubscriptions";

const queryClient = new QueryClient();

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
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
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
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (role !== "teacher" && role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Rutas protegidas generales */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/course/:courseId" element={<ProtectedRoute><CourseView /></ProtectedRoute>} />
            <Route path="/student/subscriptions" element={<StudentSubscriptions />} />
            
            {/* Rutas de Admin */}
            <Route path="/admin/courses" element={<ProtectedRoute adminOnly><AdminCourses /></ProtectedRoute>} />
            <Route path="/admin/courses/:courseId/lessons" element={<ProtectedRoute adminOnly teacherAllowed><AdminLessons /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute adminOnly><AdminStudents /></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute adminOnly><AdminSubscriptions /></ProtectedRoute>} />
            <Route path="/admin/teachers" element={<ProtectedRoute adminOnly><AdminTeachers /></ProtectedRoute>} />
            
            {/* Rutas de Profesor */}
            <Route path="/teacher" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
            <Route path="/teacher/course/:courseId/lessons" element={<TeacherRoute><TeacherLessons /></TeacherRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
