import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, GraduationCap, BookOpen, Trash2, UserPlus, Search } from "lucide-react";

const AdminTeachers = () => {
  const queryClient = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  // Obtener todos los profesores
  const { data: teachers, isLoading } = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role,
          profiles!user_roles_user_id_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq("role", "teacher");

      if (error) throw error;

      // Obtener cursos asignados a cada profesor
      const teacherIds = data.map(t => t.user_id);
      const { data: assignments } = await supabase
        .from("course_teachers")
        .select(`
          teacher_id,
          course_id,
          courses (id, title)
        `)
        .in("teacher_id", teacherIds);

      return data.map(teacher => ({
        ...teacher,
        courses: assignments?.filter(a => a.teacher_id === teacher.user_id).map(a => a.courses) || []
      }));
    },
  });

  // Obtener todos los cursos para asignar
  const { data: courses } = useQuery({
    queryKey: ["all-courses-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  // Buscar usuario por email
  const searchMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data: authUser } = await supabase.auth.admin.listUsers();
      // En producción, necesitarías un edge function para esto
      // Por ahora buscaremos en profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${email}%`);
      
      if (error) throw error;
      return data;
    },
  });

  // Crear profesor (cambiar rol de un usuario existente)
  const createTeacherMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Verificar si ya tiene un rol
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        // Actualizar rol existente
        const { error } = await supabase
          .from("user_roles")
          .update({ role: "teacher" })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // Crear nuevo rol
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "teacher" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      toast.success("Profesor creado correctamente");
      setOpenCreate(false);
      setSearchEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Asignar curso a profesor
  const assignCourseMutation = useMutation({
    mutationFn: async ({ teacherId, courseId }: { teacherId: string; courseId: string }) => {
      const { error } = await supabase
        .from("course_teachers")
        .insert({ teacher_id: teacherId, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      toast.success("Curso asignado correctamente");
      setOpenAssign(false);
      setSelectedCourse("");
    },
    onError: (e: any) => {
      if (e.message.includes("duplicate")) {
        toast.error("Este profesor ya tiene asignado este curso");
      } else {
        toast.error(e.message);
      }
    },
  });

  // Quitar asignación de curso
  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ teacherId, courseId }: { teacherId: string; courseId: string }) => {
      const { error } = await supabase
        .from("course_teachers")
        .delete()
        .eq("teacher_id", teacherId)
        .eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-teachers"] });
      toast.success("Asignación removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Obtener usuarios que podrían ser profesores (estudiantes)
  const { data: potentialTeachers } = useQuery({
    queryKey: ["potential-teachers", searchEmail],
    queryFn: async () => {
      if (!searchEmail || searchEmail.length < 2) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          user_roles!user_roles_user_id_fkey (role)
        `)
        .ilike("full_name", `%${searchEmail}%`)
        .limit(10);

      if (error) throw error;
      
      // Filtrar los que ya son profesores
      return data.filter(p => !p.user_roles?.some((r: any) => r.role === "teacher"));
    },
    enabled: searchEmail.length >= 2,
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profesores</h1>
            <p className="text-muted-foreground font-medium">Gestiona el equipo docente y sus asignaciones</p>
          </div>
          
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20">
                <UserPlus className="w-4 h-4 mr-2" /> Agregar Profesor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Agregar Profesor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar Usuario</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Nombre del usuario..." 
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Busca usuarios existentes para convertirlos en profesores</p>
                </div>

                {potentialTeachers && potentialTeachers.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {potentialTeachers.map((user) => (
                      <div 
                        key={user.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold">{user.full_name || "Sin nombre"}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.user_roles?.[0]?.role || "student"}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => createTeacherMutation.mutate(user.id)}
                          disabled={createTeacherMutation.isPending}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Hacer Profesor
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {searchEmail.length >= 2 && potentialTeachers?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No se encontraron usuarios con ese nombre
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : teachers?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg">No hay profesores</h3>
                <p className="text-muted-foreground">Agrega tu primer profesor para comenzar</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {teachers?.map((teacher) => (
              <Card key={teacher.id} className="border-none shadow-card bg-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {teacher.profiles?.full_name?.charAt(0).toUpperCase() || "P"}
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold">
                        {teacher.profiles?.full_name || "Profesor"}
                      </CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        <GraduationCap className="w-3 h-3 mr-1" />
                        Profesor
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Cursos Asignados</p>
                    {teacher.courses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin cursos asignados</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {teacher.courses.map((course: any) => (
                          <Badge 
                            key={course.id} 
                            variant="outline" 
                            className="pr-1 flex items-center gap-1"
                          >
                            <BookOpen className="w-3 h-3" />
                            {course.title}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 ml-1 hover:bg-destructive/20 hover:text-destructive"
                              onClick={() => removeAssignmentMutation.mutate({
                                teacherId: teacher.user_id,
                                courseId: course.id
                              })}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      setOpenAssign(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Asignar Curso
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dialog para asignar curso */}
        <Dialog open={openAssign} onOpenChange={setOpenAssign}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Asignar Curso</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Asignando curso a <strong>{selectedTeacher?.profiles?.full_name}</strong>
              </p>
              
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Seleccionar Curso</Label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir un curso..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.filter(c => 
                      !selectedTeacher?.courses?.some((tc: any) => tc.id === c.id)
                    ).map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                className="w-full gradient-primary text-primary-foreground"
                disabled={!selectedCourse || assignCourseMutation.isPending}
                onClick={() => {
                  if (selectedTeacher && selectedCourse) {
                    assignCourseMutation.mutate({
                      teacherId: selectedTeacher.user_id,
                      courseId: selectedCourse
                    });
                  }
                }}
              >
                {assignCourseMutation.isPending ? "Asignando..." : "Confirmar Asignación"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminTeachers;
