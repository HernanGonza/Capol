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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, BookOpen, Edit, Layers, Upload, X, Film, Image as ImageIcon, DollarSign, Settings, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

const MONEDAS = ["ARS", "USD", "EUR", "UYU", "BRL", "CLP"];

const formatPrecio = (course: any) => {
  if (!course.precio) return null;
  const simbolo = course.moneda === "USD" ? "U$S" : course.moneda === "EUR" ? "€" : course.moneda || "$";
  const monto = new Intl.NumberFormat("es-AR").format(course.precio);
  if (course.tipo_precio === "mensual") return `${simbolo} ${monto}/mes`;
  if (course.tipo_precio === "cuotas") return `${course.cantidad_cuotas}x ${simbolo} ${monto}`;
  return `${simbolo} ${monto}`;
};

const AdminCourses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [form, setForm] = useState({
    titulo: "", descripcion: "", url_imagen: "", url_flyer: "",
    tipo_flyer: "image", publicado: false,
    precio: "", tipo_precio: "curso", cantidad_cuotas: "", moneda: "ARS",
  });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "video">("image");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Config medios de pago
  const [nuevoMedio, setNuevoMedio] = useState("");

  const { data: courses, isLoading } = useQuery({
    queryKey: ["admin-courses-full-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select(`*, inscripciones (count), lecciones (count)`)
        .order("creado_en", { ascending: false });
      if (error) throw error;
      const { data: activeSubs } = await supabase
        .from("suscripciones").select("curso_id").eq("estado", "active");
      return data.map((course: any) => ({
        ...course,
        active_count: activeSubs?.filter((s: any) => s.curso_id === course.id).length || 0,
        total_enrollments: course.inscripciones[0]?.count || 0,
        total_lessons: course.lecciones[0]?.count || 0,
      }));
    },
  });

  const { data: mediosDePago, refetch: refetchConfig } = useQuery({
    queryKey: ["config-medios-pago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracion_global").select("valor").eq("clave", "medios_de_pago").single();
      return (data?.valor as string[]) || [];
    },
  });

  const { data: solicitudesPendientes } = useQuery({
    queryKey: ["solicitudes-pendientes-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("solicitudes_inscripcion").select("*", { count: "exact", head: true }).eq("estado", "pendiente");
      return count || 0;
    },
  });

  const saveMediosMutation = useMutation({
    mutationFn: async (medios: string[]) => {
      const { error } = await supabase.from("configuracion_global")
        .upsert({ clave: "medios_de_pago", valor: medios as any });
      if (error) throw error;
    },
    onSuccess: () => { refetchConfig(); toast.success("Medios de pago actualizados"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("Solo imágenes o videos"); return; }
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) { toast.error(`Máximo ${isVideo ? "100MB" : "10MB"}`); return; }
    setUploading(true);
    try {
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewType(isVideo ? "video" : "image");
      const fileExt = file.name.split(".").pop();
      const filePath = `flyers/${crypto.randomUUID()}.${fileExt}`;
      const { error } = await supabase.storage.from("course-flyers").upload(filePath, file, { cacheControl: "3600" });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("course-flyers").getPublicUrl(filePath);
      setForm({ ...form, url_flyer: publicUrl, tipo_flyer: isVideo ? "video" : "image" });
      toast.success(`${isVideo ? "Video" : "Imagen"} subido`);
    } catch (error: any) {
      toast.error(error.message);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const courseData = {
        titulo: form.titulo, descripcion: form.descripcion,
        url_imagen: form.url_imagen, url_flyer: form.url_flyer,
        tipo_flyer: form.tipo_flyer, publicado: form.publicado,
        precio: form.precio ? parseFloat(form.precio) : null,
        tipo_precio: form.tipo_precio,
        cantidad_cuotas: form.tipo_precio === "cuotas" && form.cantidad_cuotas ? parseInt(form.cantidad_cuotas) : null,
        moneda: form.moneda,
      };
      if (editingCourse) {
        const { error } = await supabase.from("cursos").update(courseData).eq("id", editingCourse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cursos").insert({ ...courseData, creado_por: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success(editingCourse ? "Curso actualizado" : "Curso creado");
      setOpen(false); resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm({ titulo: "", descripcion: "", url_imagen: "", url_flyer: "", tipo_flyer: "image", publicado: false, precio: "", tipo_precio: "curso", cantidad_cuotas: "", moneda: "ARS" });
    setEditingCourse(null); setPreviewUrl(null); setPreviewType("image");
  };

  const openEdit = (course: any) => {
    setEditingCourse(course);
    const flyerType = course.tipo_flyer || (course.url_flyer?.includes(".mp4") ? "video" : "image");
    setForm({
      titulo: course.titulo, descripcion: course.descripcion || "",
      url_imagen: course.url_imagen || "", url_flyer: course.url_flyer || "",
      tipo_flyer: flyerType, publicado: course.publicado,
      precio: course.precio?.toString() || "",
      tipo_precio: course.tipo_precio || "curso",
      cantidad_cuotas: course.cantidad_cuotas?.toString() || "",
      moneda: course.moneda || "ARS",
    });
    setPreviewUrl(course.url_flyer || null);
    setPreviewType(flyerType as "image" | "video");
    setOpen(true);
  };

  const isVideoFlyer = (course: any) => course.tipo_flyer === "video" || course.url_flyer?.endsWith(".mp4");

  const labelCls = "text-xs font-bold uppercase text-muted-foreground";
  const selectCls = "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
            <p className="text-muted-foreground font-medium">Gestiona tu catálogo de contenidos</p>
          </div>
          <div className="flex gap-2">
            {/* Botón configuración medios de pago */}
            <Dialog open={openConfig} onOpenChange={setOpenConfig}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Settings className="w-4 h-4" /> Medios de Pago
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Medios de Pago</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Estos medios aparecerán en el modal de inscripción de cada curso.</p>
                <div className="space-y-3 pt-2">
                  {(mediosDePago || []).map((medio, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border">
                      <span className="text-sm font-medium">{medio}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          const nuevos = (mediosDePago || []).filter((_, j) => j !== i);
                          saveMediosMutation.mutate(nuevos);
                        }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input placeholder="Ej: Tarjeta de crédito" value={nuevoMedio}
                      onChange={(e) => setNuevoMedio(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!nuevoMedio.trim()) return;
                          saveMediosMutation.mutate([...(mediosDePago || []), nuevoMedio.trim()]);
                          setNuevoMedio("");
                        }
                      }} />
                    <Button onClick={() => {
                      if (!nuevoMedio.trim()) return;
                      saveMediosMutation.mutate([...(mediosDePago || []), nuevoMedio.trim()]);
                      setNuevoMedio("");
                    }}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Link a solicitudes */}
            <Link to="/admin/solicitudes">
              <Button variant="outline" className="gap-2 relative">
                Solicitudes
                {(solicitudesPendientes || 0) > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {solicitudesPendientes}
                  </span>
                )}
              </Button>
            </Link>

            {/* Nuevo curso */}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground font-semibold px-6 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Nuevo Curso
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">{editingCourse ? "Editar Curso" : "Nuevo Curso"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className={labelCls}>Título *</Label>
                    <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required placeholder="Ej: React para Emprendedores" />
                  </div>
                  <div className="space-y-2">
                    <Label className={labelCls}>Descripción</Label>
                    <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} />
                  </div>

                  {/* Precio */}
                  <div className="space-y-2">
                    <Label className={labelCls}>Precio</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <select value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} className={selectCls}>
                        {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="0.00 (dejar vacío = gratis)"
                        value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.tipo_precio} onChange={(e) => setForm({ ...form, tipo_precio: e.target.value })} className={selectCls}>
                        <option value="curso">Pago único por curso</option>
                        <option value="mensual">Mensual</option>
                        <option value="cuotas">En cuotas</option>
                      </select>
                      {form.tipo_precio === "cuotas" && (
                        <Input type="number" min="2" max="36" placeholder="Cant. cuotas"
                          value={form.cantidad_cuotas} onChange={(e) => setForm({ ...form, cantidad_cuotas: e.target.value })} />
                      )}
                    </div>
                  </div>

                  {/* Flyer */}
                  <div className="space-y-2">
                    <Label className={labelCls}>Flyer del Curso</Label>
                    {previewUrl || form.url_flyer ? (
                      <div className="relative rounded-xl overflow-hidden border bg-muted/30">
                        {previewType === "video" || form.tipo_flyer === "video"
                          ? <video src={previewUrl || form.url_flyer} className="w-full h-40 object-cover" muted loop autoPlay playsInline />
                          : <img src={previewUrl || form.url_flyer} alt="Preview" className="w-full h-40 object-cover" />}
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="bg-black/50 text-white border-none">
                            {previewType === "video" || form.tipo_flyer === "video"
                              ? <><Film className="w-3 h-3 mr-1" /> Video</>
                              : <><ImageIcon className="w-3 h-3 mr-1" /> Imagen</>}
                          </Badge>
                        </div>
                        <Button type="button" variant="destructive" size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => { setForm({ ...form, url_flyer: "", tipo_flyer: "image" }); setPreviewUrl(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                        onClick={() => fileInputRef.current?.click()}>
                        {uploading
                          ? <div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /><p className="text-sm text-muted-foreground">Subiendo...</p></div>
                          : <><Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm font-medium">Click para subir flyer</p><p className="text-xs text-muted-foreground">PNG, JPG, MP4 hasta 100MB</p></>}
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm" onChange={handleFileUpload} className="hidden" />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl border">
                    <div className="flex items-center gap-3">
                      <Switch checked={form.publicado} onCheckedChange={(c) => setForm({ ...form, publicado: c })} />
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
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses?.map((course: any) => {
              const hasVideoFlyer = isVideoFlyer(course);
              const precioLabel = formatPrecio(course);
              return (
                <Card key={course.id} className="border-none shadow-card bg-white flex flex-col overflow-hidden">
                  {course.url_flyer && (
                    <div className="relative h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                      {hasVideoFlyer
                        ? <video src={course.url_flyer} className="w-full h-full object-contain bg-black" muted loop autoPlay playsInline />
                        : <img src={course.url_flyer} alt={course.titulo} className="w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                      {hasVideoFlyer && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="bg-black/50 text-white border-none text-[10px]">
                            <Film className="w-3 h-3 mr-1" /> VIDEO
                          </Badge>
                        </div>
                      )}
                      {precioLabel && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-emerald-500 text-white border-none text-[10px] font-bold shadow">
                            <DollarSign className="w-2.5 h-2.5 mr-0.5" />{precioLabel}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                  <CardHeader className={`pb-3 flex-row items-start justify-between space-y-0 ${!course.url_flyer ? "" : "-mt-8 relative z-10"}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={course.publicado ? "default" : "secondary"} className={course.publicado ? "bg-success/10 text-success border-none" : ""}>
                          {course.publicado ? "Activo" : "Borrador"}
                        </Badge>
                        {precioLabel && !course.url_flyer && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[10px]">
                            <DollarSign className="w-2.5 h-2.5 mr-0.5" />{precioLabel}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl font-bold line-clamp-1">{course.titulo}</CardTitle>
                    </div>
                    {!course.url_flyer && <div className="p-2 bg-primary/5 rounded-lg text-primary"><BookOpen className="w-5 h-5" /></div>}
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