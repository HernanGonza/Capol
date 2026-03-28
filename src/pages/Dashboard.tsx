import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/components/admin/AdminDashboard";
import StudentDashboard from "@/components/student/StudentDashboard";
import AppLayout from "@/components/AppLayout";

const Dashboard = () => {
  const { role } = useAuth();

  return (
    <AppLayout>
      {role === "admin" ? <AdminDashboard /> : <StudentDashboard />}
    </AppLayout>
  );
};

export default Dashboard;
