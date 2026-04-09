import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, Edit, Layers, Users, CheckCircle2, Search, Upload, Image, X } from "lucide-react";
import { Link } from "react-router-dom";

const AdminCourses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", flyer_url: "", is_published: false });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses-full-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          *,
          enrollments (count),
          subscriptions (count),
          lessons (count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const { data: activeSubs } = await supabase
        .from("subscriptions")
        .select("course_id")
        .eq('status', 'active');

      return data.map(course => ({
        ...course,
        active_count: activeSubs?.filter(s => s.course_id === course.id).length || 0,
        total_enrollments: course.enrollments[0]?.count || 0,
        total_lessons: course.lessons[0]?.count || 0
      }));
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5MB");
      return;
    }

    setUploading(true);

    try {
      // Crear preview local
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);

      // Generar nombre único
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `flyers/${fileName}`;

      // Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("course-flyers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("course-flyers")
        .getPublicUrl(filePath);

      setForm({ ...form, flyer_url: publicUrl });
      toast.success("Flyer subido correctamente");
    } catch (error: any) {
      toast.error("Error al subir imagen: " + error.message);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const removeFlyer = () => {
    setForm({ ...form, flyer_url: "" });
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const courseData = {
        title: form.title,
        description: form.description,
        image_url: form.image_url,
        flyer_url: form.flyer_url,
        is_published: form.is_published,
      };

      if (editingCourse) {
        const { error } = await supabase.from("courses").update(courseData).eq("id", editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert({ ...courseData, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success(editingCourse ? "Curso actualizado" : "Curso creado");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ title: "", description: "", image_url: "", flyer_url: "", is_published: false });
    setEditingCourse(null);
    setPreviewUrl(null);
  };

  const openEdit = (course: any) => {
    setEditingCourse(course);
    setForm({ 
      title: course.title, 
      description: course.description || "", 
      image_url: course.image_url || "", 
      flyer_url: course.flyer_url || "",
      is_published: course.is_published 
    });
    setPreviewUrl(course.flyer_url || null);
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
            <p className="text-muted-foreground font-medium">Gestiona tu catálogo de contenidos</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> Nuevo Curso
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">{editingCourse ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Título</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ej: React para Emprendedores" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Descripción</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>

                {/* Upload de Flyer */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Flyer del Curso</Label>
                  
                  {previewUrl || form.flyer_url ? (
                    <div className="relative rounded-xl overflow-hidden border bg-muted/30">
                      <img 
                        src={previewUrl || form.flyer_url} 
                        alt="Preview" 
                        className="w-full h-40 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={removeFlyer}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-muted-foreground">Subiendo...</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium">Click para subir flyer</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG hasta 5MB</p>
                        </>
                      )}
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.is_published} onCheckedChange={(c) => setForm({ ...form, is_published: c })} />
                    <Label className="font-semibold cursor-pointer">Publicado</Label>
                  </div>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground h-11" disabled={saveMutation.isPending || uploading}>
                  {saveMutation.isPending ? "Guardando..." : "Confirmar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses?.map((course) => {
              const health = course.total_enrollments > 0 ? (course.active_count / course.total_enrollments) * 100 : 0;
              
              return (
                <Card key={course.id} className="border-none shadow-card bg-white flex flex-col overflow-hidden">
                  {/* Flyer Preview */}
                  {course.flyer_url && (
                    <div className="relative h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                      <img 
                        src={course.flyer_url} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                    </div>
                  )}
                  
                  <CardHeader className={`pb-3 flex-row items-start justify-between space-y-0 ${!course.flyer_url ? '' : '-mt-8 relative z-10'}`}>
                    <div className="space-y-1">
                      <Badge variant={course.is_published ? "default" : "secondary"} className={course.is_published ? "bg-success/10 text-success border-none" : ""}>
                        {course.is_published ? "Activo" : "Borrador"}
                      </Badge>
                      <CardTitle className="text-xl font-bold line-clamp-1">{course.title}</CardTitle>
                    </div>
                    {!course.flyer_url && (
                      <div className="p-2 bg-primary/5 rounded-lg text-primary">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    )}
                  </CardHeader>
                  
                  <CardContent className="space-y-6 flex-1">
                    <div className="grid grid-cols-3 gap-2 border-y py-4">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Alumnos</p>
                        <p className="font-bold text-lg">{course.total_enrollments}</p>
                      </div>
                      <div className="text-center border-x">
                        <p className="text-[10px] uppercase font-bold text-green-600 mb-1">Activos</p>
                        <p className="font-bold text-lg text-green-700">{course.active_count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-blue-600 mb-1">Clases</p>
                        <p className="font-bold text-lg text-blue-700">{course.total_lessons}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Link to={`/admin/courses/${course.id}/lessons`} className="flex-1">
                          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white" size="sm">
                            <Layers className="w-3.5 h-3.5 mr-2" /> Clases
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => openEdit(course)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminCourses;