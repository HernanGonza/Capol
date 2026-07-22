import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/admin/AdminDashboard";
import StudentDashboard from "@/components/student/StudentDashboard";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const { role } = useAuth();

  // Nota: los profesores tienen su propio panel en /teacher.
  // Esta ruta (/dashboard) es la vista de alumno, incluso para quienes son profesores
  // (así funciona el link "Vista Alumno" del sidebar).
  return (
    <AppLayout>
      {role === "admin" ? <AdminDashboard /> : <StudentDashboard />}
    </AppLayout>
  );
};

export default Dashboard;