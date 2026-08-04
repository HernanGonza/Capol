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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, BookOpen, Edit, Layers, Upload, X, Film, Image as ImageIcon, DollarSign, Settings, Trash2, Clock, Zap, Copy, FlagOff, Archive, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { useCurrencyConversion } from "@/hooks/use-currency-conversion";
import { compressImageToWebP } from "@/lib/imageCompression";

const formatPrecio = (course: any) => {
  if (!course.precio) return null;
  const simbolo = course.moneda === "USD" ? "U$S" : course.moneda === "EUR" ? "€" : course.moneda || "$";
  const monto = new Intl.NumberFormat("es-AR").format(course.precio);
  if (course.tipo_precio === "mensual") return `${simbolo} ${monto}/mes`;
  if (course.tipo_precio === "cuotas") return `${course.cantidad_cuotas}x ${simbolo} ${monto}`;
  if (course.tipo_precio === "clase") return `${course.cantidad_cuotas} clases x ${simbolo} ${monto}`;
  return `${simbolo} ${monto}`;
};

const AdminCourses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openConfig, setOpenConfig] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [tab, setTab] = useState<"actuales" | "terminados">("actuales");
  const [confirmAction, setConfirmAction] = useState<{ type: "duplicar" | "terminar" | "eliminar"; course: any } | null>(null);
  const [form, setForm] = useState({
    titulo: "", descripcion: "", url_imagen: "", url_flyer: "",
    tipo_flyer: "image", publicado: false, estado: "activo" as "proximamente" | "activo" | "finalizado",
    modalidad: "en_vivo" as "en_vivo" | "grabado",
    fecha_inicio: "", fecha_fin: "", horarios: "", duracion: "", carga_horaria: "",
    precio: "", tipo_precio: "curso", cantidad_cuotas: "", cotizacion_ars: "",
  });
  const { currency: adminCurrency, usdToLocal, formatMoney } = useCurrencyConversion();
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
      // Los flyers de imagen se comprimen y convierten a WebP en el navegador
      // antes de subirlos — bajan de varios MB (PNG sin comprimir) a unos
      // cientos de KB, sin depender de que quien suba la imagen la optimice
      // a mano. Los videos se suben tal cual.
      const uploadFile = isImage ? await compressImageToWebP(file) : file;
      setPreviewUrl(URL.createObjectURL(uploadFile));
      setPreviewType(isVideo ? "video" : "image");
      const fileExt = uploadFile.name.split(".").pop();
      const filePath = `flyers/${crypto.randomUUID()}.${fileExt}`;
      // Cache largo: cada subida genera un path con UUID nuevo, así que el
      // contenido de una URL de flyer nunca cambia — es seguro cachearlo por
      // mucho tiempo (antes quedaba en 1 hora, desperdiciando ancho de banda
      // en cada visita repetida).
      const { error } = await supabase.storage.from("course-flyers").upload(filePath, uploadFile, { cacheControl: "31536000" });
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
        tipo_flyer: form.tipo_flyer, publicado: form.publicado, estado: form.estado,
        modalidad: form.modalidad,
        fecha_inicio: form.estado === "proximamente" && form.fecha_inicio ? form.fecha_inicio : null,
        fecha_fin: form.estado === "finalizado" ? (form.fecha_fin || new Date().toISOString().slice(0, 10)) : null,
        horarios: form.horarios.trim() || null,
        duracion: form.duracion.trim() || null,
        carga_horaria: form.carga_horaria ? parseInt(form.carga_horaria) : null,
        precio: form.precio ? parseFloat(form.precio) : null,
        tipo_precio: form.tipo_precio,
        cantidad_cuotas: (form.tipo_precio === "cuotas" || form.tipo_precio === "clase") && form.cantidad_cuotas ? parseInt(form.cantidad_cuotas) : null,
        // Cotización ARS propia del curso (opcional) — si queda vacía, el
        // precio que ve un visitante de Argentina cae al valor fijo global.
        cotizacion_ars: form.cotizacion_ars ? parseFloat(form.cotizacion_ars) : null,
        // Los cursos se cargan siempre en USD; la conversión a pesos para el
        // alumno de Argentina usa "cotizacion_ars" (o el fallback fijo si no
        // está cargada) — no depende de ninguna cotización del día.
        moneda: "USD",
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

  // Crea una nueva edición del curso (datos + clases) sin alumnos ni pagos —
  // queda agrupada bajo el mismo grupo_id que el curso original, para que la
  // Landing y el catálogo de alumnos muestren una sola tarjeta por curso sin
  // importar cuántas ediciones tenga.
  const duplicateMutation = useMutation({
    mutationFn: async (course: any) => {
      const { data: nuevo, error: errorCurso } = await supabase
        .from("cursos")
        .insert({
          titulo: course.titulo,
          descripcion: course.descripcion,
          precio: course.precio,
          cotizacion_ars: course.cotizacion_ars,
          moneda: "USD",
          tipo_precio: course.tipo_precio,
          cantidad_cuotas: course.cantidad_cuotas,
          url_imagen: course.url_imagen,
          url_flyer: course.url_flyer,
          tipo_flyer: course.tipo_flyer,
          horarios: course.horarios,
          duracion: course.duracion,
          carga_horaria: course.carga_horaria,
          modalidad: course.modalidad || "en_vivo",
          publicado: false,
          estado: "proximamente",
          fecha_inicio: null,
          fecha_fin: null,
          grupo_id: course.grupo_id || course.id,
          creado_por: user!.id,
        })
        .select()
        .single();
      if (errorCurso) throw errorCurso;

      const [{ data: docentes }, { data: lecciones }] = await Promise.all([
        supabase.from("docentes_cursos").select("docente_id").eq("curso_id", course.id),
        supabase.from("lecciones").select("*").eq("curso_id", course.id).order("orden"),
      ]);

      if (docentes?.length) {
        await supabase.from("docentes_cursos").insert(
          docentes.map((d) => ({ docente_id: d.docente_id, curso_id: nuevo.id }))
        );
      }

      if (lecciones?.length) {
        await supabase.from("lecciones").insert(
          lecciones.map((l) => ({
            curso_id: nuevo.id,
            titulo: l.titulo,
            descripcion: l.descripcion,
            content: l.content,
            orden: l.orden,
            url_video: l.url_video,
            // No copiamos fecha_desbloqueo/fecha_fin_clase/grabacion_url/sala_jitsi:
            // son propias de la cohorte anterior, la nueva edición arranca sin ellas.
          }))
        );
      }

      return nuevo;
    },
    onSuccess: (nuevo) => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success("Nueva edición creada. Revisá los datos y publicala cuando esté lista.");
      openEdit(nuevo);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Marca el curso como terminado: deja de ofrecerse a alumnos nuevos, pero
  // no toca nada de lo que ya existe (alumnos, clases, pagos, certificados).
  const terminarMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("cursos")
        .update({ estado: "finalizado", publicado: false, fecha_fin: new Date().toISOString().slice(0, 10) })
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success("Curso marcado como finalizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Borrado real: solo si el curso nunca tuvo alumnos (si los tuvo, borrar en
  // cascada se llevaría puesto el historial de pagos de Finanzas — mejor
  // "Terminar" en ese caso).
  const deleteMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase.from("cursos").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-courses-full-list"] });
      toast.success("Curso eliminado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDelete = (course: any) => {
    if (course.total_enrollments > 0) {
      toast.error(
        "Este curso tiene alumnos (o los tuvo) y no se puede eliminar sin perder ese historial. Usá \"Terminar Curso\" en su lugar."
      );
      return;
    }
    setConfirmAction({ type: "eliminar", course });
  };

  const confirmActionCopy: Record<"duplicar" | "terminar" | "eliminar", { title: string; description: string; confirmLabel: string }> = {
    duplicar: {
      title: "¿Crear nueva edición?",
      description: `Se copian "${confirmAction?.course?.titulo}" y sus clases a una nueva edición, sin alumnos.`,
      confirmLabel: "Crear edición",
    },
    terminar: {
      title: "¿Marcar como finalizado?",
      description: `"${confirmAction?.course?.titulo}" deja de ofrecerse a alumnos nuevos. Los que ya lo cursaron no se ven afectados.`,
      confirmLabel: "Terminar curso",
    },
    eliminar: {
      title: "¿Eliminar definitivamente?",
      description: `"${confirmAction?.course?.titulo}" se va a eliminar. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
    },
  };

  const resetForm = () => {
    setForm({ titulo: "", descripcion: "", url_imagen: "", url_flyer: "", tipo_flyer: "image", publicado: false, estado: "activo", modalidad: "en_vivo", fecha_inicio: "", fecha_fin: "", horarios: "", duracion: "", carga_horaria: "", precio: "", tipo_precio: "curso", cantidad_cuotas: "", cotizacion_ars: "" });
    setEditingCourse(null); setPreviewUrl(null); setPreviewType("image");
  };

  const openEdit = (course: any) => {
    setEditingCourse(course);
    const flyerType = course.tipo_flyer || (course.url_flyer?.includes(".mp4") ? "video" : "image");
    setForm({
      titulo: course.titulo, descripcion: course.descripcion || "",
      url_imagen: course.url_imagen || "", url_flyer: course.url_flyer || "",
      tipo_flyer: flyerType, publicado: course.publicado, estado: course.estado || "activo",
      modalidad: course.modalidad || "en_vivo",
      fecha_inicio: course.fecha_inicio || "", fecha_fin: course.fecha_fin || "", horarios: course.horarios || "", duracion: course.duracion || "", carga_horaria: course.carga_horaria?.toString() || "",
      precio: course.precio?.toString() || "",
      cotizacion_ars: course.cotizacion_ars?.toString() || "",
      tipo_precio: course.tipo_precio || "curso",
      cantidad_cuotas: course.cantidad_cuotas?.toString() || "",
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
          <div className="flex gap-2 flex-wrap">
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
                  <DialogDescription>Estos medios aparecerán en el modal de inscripción de cada curso.</DialogDescription>
                </DialogHeader>
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
                  <DialogDescription>Datos, precio y horarios del curso</DialogDescription>
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

                  {/* Precio (siempre en USD; se convierte a la moneda del alumno al mostrarlo) */}
                  <div className="space-y-2">
                    <Label className={labelCls}>Precio (USD)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className={`${selectCls} flex items-center justify-center font-bold text-muted-foreground bg-muted`}>USD</div>
                      <Input className="col-span-2" type="number" min="0" step="0.01" placeholder="0.00 (dejar vacío = gratis)"
                        value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} />
                    </div>
                    {!!form.precio && parseFloat(form.precio) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        ≈ {formatMoney(usdToLocal(parseFloat(form.precio)), adminCurrency)}
                        {adminCurrency !== "USD" ? ` (según tu ubicación, cotización del día)` : ""}
                      </p>
                    )}
                    <div className="space-y-1">
                      <Label className={labelCls}>Cotización ARS para este curso (opcional)</Label>
                      <Input type="number" min="0" step="1" placeholder={`Ej: 1500 (por defecto si se deja vacío)`}
                        value={form.cotizacion_ars} onChange={(e) => setForm({ ...form, cotizacion_ars: e.target.value })} />
                      <p className="text-xs text-muted-foreground">
                        Es lo que ve un alumno de Argentina: precio en USD × esta cotización. No se actualiza sola, la cargás vos.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={form.tipo_precio} onChange={(e) => setForm({ ...form, tipo_precio: e.target.value })} className={selectCls}>
                        <option value="curso">Pago único por curso</option>
                        <option value="mensual">Mensual</option>
                        <option value="cuotas">En cuotas</option>
                        <option value="clase">Por clase</option>
                      </select>
                      {form.tipo_precio === "cuotas" && (
                        <Input required type="number" min="2" max="36" placeholder="Cant. cuotas"
                          value={form.cantidad_cuotas} onChange={(e) => setForm({ ...form, cantidad_cuotas: e.target.value })} />
                      )}
                      {form.tipo_precio === "clase" && (
                        <Input required type="number" min="1" max="200" placeholder="Cant. clases"
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

                  <div className="space-y-2">
                    <Label className={labelCls}>Estado del curso</Label>
                    <select
                      value={form.estado}
                      onChange={(e) => setForm({ ...form, estado: e.target.value as "proximamente" | "activo" | "finalizado" })}
                      className={selectCls}
                    >
                      <option value="activo">Activo</option>
                      <option value="proximamente">Próximamente</option>
                      <option value="finalizado">Finalizado</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      "Proximamente" es la edición que se puede inscribir; "Activo" es la que se está cursando ahora (no se puede inscribir); "Finalizado" ya no se dicta. La Landing solo muestra una tarjeta por curso: prioriza la edición "Próximamente", luego la "Activo", y recién si no hay ninguna, la última "Finalizado". No se borra nada — los alumnos que ya cursaron siguen viendo su curso igual.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className={labelCls}>Modalidad</Label>
                    <select
                      value={form.modalidad}
                      onChange={(e) => setForm({ ...form, modalidad: e.target.value as "en_vivo" | "grabado" })}
                      className={selectCls}
                    >
                      <option value="en_vivo">En vivo (con clases programadas)</option>
                      <option value="grabado">Grabado (acceso libre, todas las clases desbloqueadas)</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      "Grabado" ignora la fecha de desbloqueo de las clases — el alumno accede a todo apenas se inscribe, y el botón de la tarjeta dice "Comprar" en vez de "Inscribirme".
                    </p>
                  </div>

                  {form.estado === "proximamente" && (
                    <div className="space-y-2">
                      <Label className={labelCls}>Fecha de la próxima edición (opcional)</Label>
                      <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
                      <p className="text-xs text-muted-foreground">
                        Si la cargás, se muestra en la tarjeta ("Próxima edición: ..."). Si la dejás vacía, no se muestra nada.
                      </p>
                    </div>
                  )}

                  {form.estado === "finalizado" && (
                    <div className="space-y-2">
                      <Label className={labelCls}>Fecha de finalización</Label>
                      <Input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className={labelCls}>Horarios (opcional)</Label>
                    <Input placeholder="Ej: Martes y Jueves de 21 a 22hs" value={form.horarios} onChange={(e) => setForm({ ...form, horarios: e.target.value })} />
                    <p className="text-xs text-muted-foreground">
                      Si lo cargás, se muestra en la tarjeta. Si lo dejás vacío, no se muestra nada.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className={labelCls}>Duración del curso (opcional)</Label>
                    <Input placeholder="Ej: 8 semanas" value={form.duracion} onChange={(e) => setForm({ ...form, duracion: e.target.value })} />
                    <p className="text-xs text-muted-foreground">
                      Si la cargás, se muestra en la tarjeta. Si la dejás vacía, no se muestra nada.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className={labelCls}>Carga horaria en horas (opcional)</Label>
                    <Input type="number" min="0" placeholder="Ej: 32" value={form.carga_horaria} onChange={(e) => setForm({ ...form, carga_horaria: e.target.value })} />
                    <p className="text-xs text-muted-foreground">
                      Si la cargás, aparece en el certificado de finalización ("completó satisfactoriamente 32 horas de curso"). Si la dejás vacía, el certificado no menciona la carga horaria.
                    </p>
                  </div>

                  <Button type="submit" className="w-full gradient-primary text-primary-foreground h-11" disabled={saveMutation.isPending || uploading}>
                    {saveMutation.isPending ? "Guardando..." : "Confirmar"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs Actuales / Terminados */}
        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setTab("actuales")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "actuales" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Actuales ({courses?.filter((c: any) => c.estado !== "finalizado").length || 0})
          </button>
          <button
            type="button"
            onClick={() => setTab("terminados")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "terminados" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Terminados ({courses?.filter((c: any) => c.estado === "finalizado").length || 0})
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-64 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses
              ?.filter((c: any) => (tab === "terminados" ? c.estado === "finalizado" : c.estado !== "finalizado"))
              .sort((a: any, b: any) =>
                tab === "terminados" ? (b.fecha_fin || "").localeCompare(a.fecha_fin || "") : 0
              )
              .map((course: any) => {
              const hasVideoFlyer = isVideoFlyer(course);
              const precioLabel = formatPrecio(course);
              return (
                <Card key={course.id} className="border-none shadow-card bg-card flex flex-col overflow-hidden">
                  {course.url_flyer && (
                    <div className="relative h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                      {hasVideoFlyer
                        ? <video src={course.url_flyer} className="w-full h-full object-contain bg-black" muted loop autoPlay playsInline />
                        : <img src={course.url_flyer} alt={course.titulo} className="w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
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
                          {course.publicado ? "Publicado" : "Borrador"}
                        </Badge>
                        {course.estado === "proximamente" ? (
                          <Badge className="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-none">
                            <Clock className="w-3 h-3 mr-1" /> Próximamente
                          </Badge>
                        ) : course.estado === "finalizado" ? (
                          <Badge className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none">
                            <Archive className="w-3 h-3 mr-1" /> Finalizado{course.fecha_fin ? ` (${course.fecha_fin})` : ""}
                          </Badge>
                        ) : (
                          <Badge className="bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-none">
                            <Zap className="w-3 h-3 mr-1" /> Activo
                          </Badge>
                        )}
                        {precioLabel && !course.url_flyer && (
                          <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-none text-[10px]">
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
                        <p className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400 mb-1">Activos</p>
                        <p className="font-bold text-lg text-green-700 dark:text-green-400">{course.active_count}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Clases</p>
                        <p className="font-bold text-lg text-blue-700 dark:text-blue-400">{course.total_lessons}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Link to={`/admin/courses/${course.id}/lessons`} className="flex-1">
                          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white" size="sm">
                            <Layers className="w-3.5 h-3.5 mr-2" /> Clases
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => openEdit(course)} title="Editar">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Link to={`/course/${course.id}`} title="Vista previa (como lo ve un alumno, incluye certificado de prueba)">
                          <Button variant="outline" size="sm">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                      <div className="flex gap-2">
                        {course.estado !== "finalizado" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            title="Terminar curso"
                            disabled={terminarMutation.isPending}
                            onClick={() => setConfirmAction({ type: "terminar", course })}
                          >
                            <FlagOff className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          title="Nueva edición (misma serie, sin alumnos)"
                          disabled={duplicateMutation.isPending}
                          onClick={() => setConfirmAction({ type: "duplicar", course })}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-destructive hover:bg-destructive/10"
                          title="Eliminar curso"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDelete(course)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AlertDialog open={!!confirmAction} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
          <AlertDialogContent>
            {confirmAction && (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{confirmActionCopy[confirmAction.type].title}</AlertDialogTitle>
                  <AlertDialogDescription>{confirmActionCopy[confirmAction.type].description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className={confirmAction.type === "eliminar" ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""}
                    onClick={() => {
                      if (confirmAction.type === "duplicar") duplicateMutation.mutate(confirmAction.course);
                      else if (confirmAction.type === "terminar") terminarMutation.mutate(confirmAction.course.id);
                      else if (confirmAction.type === "eliminar") deleteMutation.mutate(confirmAction.course.id);
                      setConfirmAction(null);
                    }}
                  >
                    {confirmActionCopy[confirmAction.type].confirmLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default AdminCourses;