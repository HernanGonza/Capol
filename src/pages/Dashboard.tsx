import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/admin/AdminDashboard";
import StudentDashboard from "@/components/student/StudentDashboard";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const { role } = useAuth();

  // El panel del profesor vive en /teacher, no acá — ya no hay ningún link
  // que mande a un profesor a "/dashboard" a propósito, así que si de
  // cualquier forma termina en esta ruta (URL vieja, historial del
  // navegador, etc.) lo mandamos a su panel real en vez de mostrarle la
  // vista de alumno.
  if (role === "teacher") return <Navigate to="/teacher" replace />;

  return (
    <AppLayout>
      {role === "admin" ? <AdminDashboard /> : <StudentDashboard />}
    </AppLayout>
  );
};

export default Dashboard;