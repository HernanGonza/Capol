import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  BookOpen, Clock, CheckCircle, PlayCircle, GraduationCap,
  ArrowRight, Users, DollarSign, X, CreditCard
} from "lucide-react";
import { Link } from "react-router-dom";

const StudentDashboard = () => {
  const { user } = useAuth();
  const [modalCourse, setModalCourse] = useState<any>(null);
  const [solicitando, setSolicitando] = useState(false);
  const [yaSolicitado, setYaSolicitado] = useState<Set<string>>(new Set());

  // Mis cursos activos
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ["student-courses-progress", user?.id],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("suscripciones")
        .select(`
          id, estado, curso_id,
          cursos (id, titulo, descripcion, url_imagen, lecciones (id))
        `)
        .eq("usuario_id", user!.id)
        .eq("estado", "active")
        .or(`fin_en.gt.${new Date().toISOString()},fin_en.is.null`);
      if (error) throw error;

      const { data: progress } = await supabase
        .from("progreso_lecciones")
        .select("leccion_id")
        .eq("usuario_id", user!.id)
        .eq("completado", true);

      return (subs || []).map((sub: any) => {
        const course = sub.cursos;
        const total = course?.lecciones?.length || 0;
        const completado = course?.lecciones?.filter((l: any) =>
          progress?.some((p: any) => p.leccion_id === l.id)
        ).length || 0;
        return { id: sub.id, course, total, completado, percent: total > 0 ? Math.round((completado / total) * 100) : 0 };
      });
    },
    enabled: !!user,
  });

  // Cursos disponibles (publicados y sin suscripción activa del alumno)
  const { data: availableCourses, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-courses", user?.id],
    queryFn: async () => {
      const { data: allCourses } = await supabase
        .from("cursos")
        .select(`id, titulo, descripcion, url_imagen, url_flyer, tipo_flyer, precio, tipo_precio, cantidad_cuotas, moneda, lecciones (count), inscripciones (count)`)
        .eq("publicado", true)
        .order("creado_en", { ascending: false });

      const { data: activeSubs } = await supabase
        .from("suscripciones")
        .select("curso_id")
        .eq("usuario_id", user!.id)
        .eq("estado", "active")
        .or(`fin_en.gt.${new Date().toISOString()},fin_en.is.null`);

      const enrolledIds = new Set((activeSubs || []).map((s: any) => s.curso_id));
      return (allCourses || []).filter((c: any) => !enrolledIds.has(c.id));
    },
    enabled: !!user,
  });

  // Medios de pago
  const { data: mediosDePago } = useQuery({
    queryKey: ["config-medios-pago"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracion_global").select("valor").eq("clave", "medios_de_pago").single();
      return (data?.valor as string[]) || [];
    },
  });

  const formatPrecio = (course: any) => {
    if (!course?.precio) return null;
    const s = course.moneda === "USD" ? "U$S" : course.moneda === "EUR" ? "€" : "$";
    const m = new Intl.NumberFormat("es-AR").format(course.precio);
    if (course.tipo_precio === "mensual") return `${s} ${m}/mes`;
    if (course.tipo_precio === "cuotas") return `${course.cantidad_cuotas}x ${s} ${m}`;
    return `${s} ${m}`;
  };

  const handleSolicitar = async () => {
    if (!modalCourse || !user) return;
    setSolicitando(true);
    try {
      const { error } = await supabase.from("solicitudes_inscripcion").insert({
        usuario_id: user.id,
        curso_id: modalCourse.id,
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("Ya enviaste una solicitud para este curso. Te contactaremos pronto.");
        } else throw error;
      } else {
        toast.success("¡Solicitud enviada! Te contactaremos para coordinar el pago.");
        setYaSolicitado(prev => new Set([...prev, modalCourse.id]));
      }
      setModalCourse(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <>
      <div className="space-y-10 animate-fade-in">

        {/* MIS CURSOS */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">¡Hola de nuevo!</h1>
            <p className="text-muted-foreground text-lg">Aquí tenés tus cursos activos y tu progreso actual.</p>
          </div>

          {loadingEnrollments ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
            </div>
          ) : enrollments && enrollments.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((item) => (
                <Link key={item.id} to={`/course/${item.course?.id}`}>
                  <Card className="overflow-hidden border-none shadow-card hover:shadow-elevated transition-all duration-300 group bg-white">
                    <div className="h-44 relative overflow-hidden">
                      {item.course?.url_imagen
                        ? <img src={item.course.url_imagen} alt={item.course.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="w-full h-full gradient-hero flex items-center justify-center"><BookOpen className="w-12 h-12 text-white/20" /></div>}
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                      {item.percent === 100 && (
                        <div className="absolute top-3 right-3 bg-success text-success-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                          <CheckCircle className="w-3 h-3" /> COMPLETADO
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-bold text-xl mb-2 line-clamp-1 group-hover:text-primary transition-colors">{item.course?.titulo}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">{item.course?.descripcion || "Comenzá a explorar las lecciones."}</p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end text-sm">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tu Progreso</span>
                          <span className="font-bold text-primary">{item.percent}%</span>
                        </div>
                        <Progress value={item.percent} className="h-2 bg-slate-100" />
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <PlayCircle className="w-4 h-4 text-primary/60" />
                            <span>{item.completado} / {item.total} Clases</span>
                          </div>
                          <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                            Continuar <Clock className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center border-none shadow-card bg-slate-50/50">
              <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="font-bold text-lg">Aún no tenés cursos activos</h3>
              <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">Inscribite en alguno de los cursos disponibles aquí abajo.</p>
            </Card>
          )}
        </div>

        {/* CURSOS DISPONIBLES */}
        {availableCourses && availableCourses.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Cursos Disponibles</h2>
                <p className="text-muted-foreground text-sm mt-1">Solicitá tu inscripción y te contactamos para coordinar el pago.</p>
              </div>
              <Badge variant="secondary" className="text-xs font-bold">{availableCourses.length} cursos</Badge>
            </div>

            {loadingAvailable ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableCourses.map((course: any) => (
                  <Card key={course.id} className="overflow-hidden border border-border/50 shadow-sm hover:shadow-card transition-all duration-300 group bg-white">
                    <div className="h-36 relative overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50">
                      {course.url_flyer || course.url_imagen ? (
                        course.tipo_flyer === "video"
                          ? <video src={course.url_flyer} className="w-full h-full object-cover" muted loop autoPlay playsInline />
                          : <img src={course.url_flyer || course.url_imagen} alt={course.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <GraduationCap className="w-10 h-10 text-indigo-200" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-2 left-3 flex items-center gap-2">
                        <Badge className="bg-black/40 backdrop-blur-sm text-white border-none text-[10px] font-bold">
                          <BookOpen className="w-2.5 h-2.5 mr-1" />{course.lecciones?.[0]?.count || 0} clases
                        </Badge>
                        <Badge className="bg-black/40 backdrop-blur-sm text-white border-none text-[10px] font-bold">
                          <Users className="w-2.5 h-2.5 mr-1" />{course.inscripciones?.[0]?.count || 0}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary transition-colors mb-1">{course.titulo}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{course.descripcion || "Más información próximamente."}</p>
                      <div className="flex items-center justify-between">
                        {formatPrecio(course)
                          ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><DollarSign className="w-3 h-3" />{formatPrecio(course)}</span>
                          : <span className="text-xs text-muted-foreground">Consultar precio</span>}
                        <button
                          onClick={() => setModalCourse(course)}
                          className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          Inscribirme <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal de inscripción */}
      <Dialog open={!!modalCourse} onOpenChange={(o) => { if (!o) setModalCourse(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          {modalCourse && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-1">Solicitud de inscripción</p>
                <h2 className="text-xl font-black leading-tight">{modalCourse.titulo}</h2>
              </div>

              {(modalCourse.url_flyer || modalCourse.url_imagen) && (
                <div className="rounded-xl overflow-hidden h-32">
                  {modalCourse.tipo_flyer === "video"
                    ? <video src={modalCourse.url_flyer} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                    : <img src={modalCourse.url_flyer || modalCourse.url_imagen} className="w-full h-full object-cover" alt={modalCourse.titulo} />}
                </div>
              )}

              {modalCourse.precio ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Precio del curso</p>
                    <p className="font-black text-xl text-emerald-800">{formatPrecio(modalCourse)}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border rounded-xl p-4">
                  <p className="text-sm text-muted-foreground">El precio se acordará al momento del contacto.</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground leading-relaxed">
                Estás a punto de solicitar tu inscripción al curso <strong className="text-foreground">"{modalCourse.titulo}"</strong>.
                Podrás ingresar al mismo una vez que se acredite tu pago.
                <br /><br />
                <strong className="text-foreground">Nos estaremos comunicando con vos para coordinar el pago.</strong>
              </p>

              {mediosDePago && mediosDePago.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Medios de pago disponibles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mediosDePago.map((medio: string, i: number) => (
                      <span key={i} className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full border">{medio}</span>
                    ))}
                  </div>
                </div>
              )}

              {yaSolicitado.has(modalCourse.id) ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700 font-semibold text-sm">
                  <CheckCircle className="w-5 h-5" /> Solicitud enviada — te contactaremos pronto
                </div>
              ) : (
                <button
                  onClick={handleSolicitar}
                  disabled={solicitando}
                  className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {solicitando ? "Enviando solicitud..." : "Confirmar solicitud de inscripción"}
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentDashboard;