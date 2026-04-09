import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/admin/AdminDashboard";
import StudentDashboard from "@/components/student/StudentDashboard";
import TeacherDashboard from "@/pages/TeacherDashboard";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const { role } = useAuth();

  // Si es profesor, mostrar su dashboard específico (sin AppLayout porque TeacherDashboard ya lo tiene)
  if (role === "teacher") {
    return <TeacherDashboard />;
  }

  return (
    <AppLayout>
      {role === "admin" ? <AdminDashboard /> : <StudentDashboard />}
    </AppLayout>
  );
};

export default Dashboard;
