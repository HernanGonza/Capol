import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, Clock, CheckCircle, PlayCircle, GraduationCap,
  ArrowRight, Users, DollarSign, Award, Zap, Calendar, Hourglass, Video, Film, Lock, MessageCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { openCertificate, fetchCertificateSignatures } from "@/lib/certificate";
import PriceTag from "@/components/PriceTag";
import { usePaymentStatus } from "@/hooks/use-payment-status";
import { clasificarCursos } from "@/lib/courseGrouping";
import { buildWhatsappLink } from "@/lib/whatsapp";
import EnrollmentDialog, { precioPrefijo } from "@/components/student/EnrollmentDialog";

// Tarjeta de catálogo (distinta de "mis cursos"): se usa tanto para los
// cursos a los que todavía se puede inscribir/comprar como para los que solo
// quedan como referencia (activo/finalizado) — "canEnroll" decide si aparece
// el botón o un texto de estado en su lugar.
const CourseCatalogCard = ({ course, canEnroll, onEnroll }: { course: any; canEnroll: boolean; onEnroll: () => void }) => (
  <Card className="overflow-hidden border border-border/50 shadow-sm hover:shadow-card transition-all duration-300 group bg-card">
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
      <div
        className={`absolute -right-8 top-3 z-20 w-32 rotate-45 text-white text-[9px] font-black uppercase tracking-widest text-center py-0.5 shadow-lg ${
          course.modalidad === "grabado"
            ? "bg-gradient-to-r from-fuchsia-600 to-purple-600"
            : "bg-gradient-to-r from-emerald-500 to-teal-500"
        }`}
      >
        {course.modalidad === "grabado" ? "Grabado" : "En vivo"}
      </div>
      <div className="absolute top-2 left-2">
        {course.estado === "proximamente" ? (
          <Badge className="bg-amber-500/90 backdrop-blur-sm text-white border-none text-[10px] font-bold">
            <Clock className="w-2.5 h-2.5 mr-1" /> Inscripciones abiertas
          </Badge>
        ) : course.estado === "activo" ? (
          <Badge className="bg-indigo-500/90 backdrop-blur-sm text-white border-none text-[10px] font-bold">
            <Zap className="w-2.5 h-2.5 mr-1" /> Cursando
          </Badge>
        ) : (
          <Badge className="bg-white/20 backdrop-blur-sm text-white border-none text-[10px] font-bold">
            <GraduationCap className="w-2.5 h-2.5 mr-1" /> Finalizado
          </Badge>
        )}
      </div>
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
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{course.descripcion || "Más información próximamente."}</p>
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold mb-2 ${course.modalidad === "grabado" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`}>
        {course.modalidad === "grabado" ? (
          <><Film className="w-3 h-3 shrink-0" /> 100% grabado, sin clases en vivo</>
        ) : (
          <><Video className="w-3 h-3 shrink-0" /> Incluye clases en vivo</>
        )}
      </div>
      {(course.fecha_inicio || course.horarios || course.duracion) && (
        <div className="space-y-1 mb-3">
          {course.fecha_inicio && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary font-semibold">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>
                Próxima edición: {new Date(`${course.fecha_inicio}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
              </span>
            </div>
          )}
          {course.horarios && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="line-clamp-1">{course.horarios}</span>
            </div>
          )}
          {course.duracion && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
              <Hourglass className="w-3 h-3 shrink-0" />
              <span className="line-clamp-1">{course.duracion}</span>
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {course.precio ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-full">
              <DollarSign className="w-3 h-3" />
              {precioPrefijo(course)}
              <PriceTag usdAmount={course.precio} suffix={course.tipo_precio === "mensual" ? "/mes" : ""} arsRate={course.cotizacion_ars} />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Consultar precio</span>
          )}
          {!canEnroll && course.estado !== "activo" && (
            <span className="text-[11px] text-muted-foreground font-semibold">
              Edición finalizada
            </span>
          )}
        </div>
        {canEnroll && (
          <div className="flex items-center gap-2">
            {course.modalidad === "grabado" && (
              <Link
                to={`/course/${course.id}`}
                className="flex-1 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors px-3 py-1.5 rounded-lg"
              >
                Ver clase gratis
              </Link>
            )}
            <button
              onClick={onEnroll}
              className="flex-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-1.5 rounded-lg flex items-center justify-center gap-1"
            >
              {course.modalidad === "grabado" ? "Comprar" : "Inscribirme"} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
        {!canEnroll && course.estado === "activo" && course.modalidad === "en_vivo" && (
          <a
            href={buildWhatsappLink(`Hola! Quiero consultar la nueva fecha de inicio del curso "${course.titulo}".`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full text-xs font-bold text-white bg-[#25D366] hover:bg-[#20bd5a] transition-colors px-3 py-1.5 rounded-lg"
          >
            <MessageCircle className="w-3 h-3" /> Consultar nueva fecha de inicio
          </a>
        )}
      </div>
    </CardContent>
  </Card>
);

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const [modalCourse, setModalCourse] = useState<any>(null);

  // Estado de pago del mes en curso (para avisar/marcar los cursos a los que
  // se les va a cortar o ya se les cortó el acceso por falta de pago).
  const { data: paymentStatus } = usePaymentStatus(user?.id);
  const paymentStatusByCurso = useMemo(
    () => new Map((paymentStatus || []).map((p) => [p.cursoId, p])),
    [paymentStatus]
  );

  // Mis cursos activos
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ["student-courses-progress", user?.id],
    queryFn: async () => {
      const { data: subs, error } = await supabase
        .from("suscripciones")
        .select(`
          id, estado, curso_id,
          cursos (id, titulo, descripcion, url_imagen, fecha_inicio, horarios, carga_horaria, lecciones (id))
        `)
        .eq("usuario_id", user!.id)
        .eq("estado", "active");
      if (error) throw error;

      const { data: progress } = await supabase
        .from("progreso_lecciones")
        .select("leccion_id, completado_en")
        .eq("usuario_id", user!.id)
        .eq("completado", true);

      return (subs || []).map((sub: any) => {
        const course = sub.cursos;
        const total = course?.lecciones?.length || 0;
        const completedEntries = (course?.lecciones || [])
          .map((l: any) => progress?.find((p: any) => p.leccion_id === l.id))
          .filter(Boolean) as { completado_en: string | null }[];
        const completado = completedEntries.length;
        // Fecha de finalización del curso = cuando se completó la última clase.
        const completedAt = completedEntries.length > 0
          ? completedEntries.reduce((max: string | null, p) => (!max || (p.completado_en || "") > max ? p.completado_en : max), null)
          : null;
        return { id: sub.id, course, total, completado, completedAt, percent: total > 0 ? Math.round((completado / total) * 100) : 0 };
      });
    },
    enabled: !!user,
  });

  // Catálogo completo (para que el alumno vea qué ofrece la escuela, no solo
  // lo que puede inscribir ahora mismo), excluyendo los cursos donde ya tiene
  // una suscripción activa. Se clasifica en 3 secciones (en vivo / grabado /
  // finalizado, ver clasificarCursos en src/lib/courseGrouping.ts): las
  // ediciones en vivo de un mismo grupo_id se deduplican en una sola tarjeta
  // (prioridad Próximamente > Activo > Finalizado más reciente), los cursos
  // grabados nunca se agrupan entre sí.
  const { data: availableCourses, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-courses", user?.id],
    queryFn: async () => {
      const { data: allCourses } = await supabase
        .from("cursos")
        .select(`id, grupo_id, titulo, descripcion, url_imagen, url_flyer, tipo_flyer, estado, modalidad, fecha_inicio, fecha_fin, horarios, duracion, precio, tipo_precio, cantidad_cuotas, moneda, cotizacion_ars, lecciones (count), inscripciones (count)`)
        .eq("publicado", true)
        .order("creado_en", { ascending: false });

      const { data: activeSubs } = await supabase
        .from("suscripciones")
        .select("curso_id")
        .eq("usuario_id", user!.id)
        .eq("estado", "active");

      const enrolledIds = new Set((activeSubs || []).map((s: any) => s.curso_id));
      return (allCourses || []).filter((c) => !enrolledIds.has(c.id));
    },
    enabled: !!user,
  });

  const { enVivo: cursosEnVivo, grabado: cursosGrabados, finalizado: cursosFinalizados } = useMemo(
    () => clasificarCursos(availableCourses || []),
    [availableCourses]
  );

  // Dentro de "en vivo", separamos los que tienen inscripción abierta
  // ("proximamente", los únicos a los que se puede inscribir) de los que ya
  // están cursando ("activo", solo como referencia, sin botón de inscripción).
  const cursosInscripcionesAbiertas = useMemo(
    () => cursosEnVivo.filter((c) => c.estado === "proximamente"),
    [cursosEnVivo]
  );
  const cursosEnCurso = useMemo(
    () => cursosEnVivo.filter((c) => c.estado === "activo"),
    [cursosEnVivo]
  );

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
              {enrollments.map((item) => {
                const pago = item.course?.id ? paymentStatusByCurso.get(item.course.id) : undefined;
                return (
                <Link key={item.id} to={`/course/${item.course?.id}`}>
                  <Card className="overflow-hidden border-none shadow-card hover:shadow-elevated transition-all duration-300 group bg-card">
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
                      {pago?.bloqueado && (
                        <div className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                          <Lock className="w-3 h-3" /> PAGO VENCIDO
                        </div>
                      )}
                      {!pago?.bloqueado && pago?.porVencer && (
                        <div className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse">
                          <Clock className="w-3 h-3" /> VENCE EL 10
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="font-bold text-xl mb-2 line-clamp-1 group-hover:text-primary transition-colors">{item.course?.titulo}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 h-10">{item.course?.descripcion || "Comenzá a explorar las lecciones."}</p>
                      {item.course?.horarios && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-4">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="line-clamp-1">{item.course.horarios}</span>
                        </div>
                      )}
                      <div className={item.course?.horarios ? "space-y-3" : "space-y-3 mt-6"}>
                        <div className="flex justify-between items-end text-sm">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tu Progreso</span>
                          <span className="font-bold text-primary">{item.percent}%</span>
                        </div>
                        <Progress value={item.percent} className="h-2 bg-muted" />
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <PlayCircle className="w-4 h-4 text-primary/60" />
                            <span>{item.completado} / {item.total} Clases</span>
                          </div>
                          {item.percent === 100 ? (
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const sig = item.course?.id ? await fetchCertificateSignatures(item.course.id) : {};
                                openCertificate({
                                  studentName: profile?.nombre_completo || "Alumno",
                                  courseTitle: item.course?.titulo || "",
                                  completionDate: item.completedAt,
                                  cargaHoraria: item.course?.carga_horaria,
                                  ...sig,
                                });
                              }}
                              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                            >
                              <Award className="w-3.5 h-3.5" /> Ver Certificado
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                              Continuar <Clock className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          ) : (
            <Card className="p-10 text-center border-none shadow-card bg-muted/50">
              <div className="w-16 h-16 bg-background rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="font-bold text-lg">Aún no tenés cursos activos</h3>
              <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">Inscribite en alguno de los cursos disponibles aquí abajo.</p>
            </Card>
          )}
        </div>

        {/* CURSOS DISPONIBLES, clasificados en 3 secciones (en vivo / grabado / finalizado) */}
        {loadingAvailable ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        ) : (
          <>
            {cursosInscripcionesAbiertas.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Inscripciones Abiertas</h2>
                    <p className="text-muted-foreground text-sm mt-1">Solicitá tu inscripción y te contactamos para coordinar el pago.</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">{cursosInscripcionesAbiertas.length} cursos</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cursosInscripcionesAbiertas.map((course: any) => (
                    <CourseCatalogCard
                      key={course.id}
                      course={course}
                      canEnroll
                      onEnroll={() => setModalCourse(course)}
                    />
                  ))}
                </div>
              </div>
            )}

            {cursosEnCurso.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Cursando</h2>
                  <p className="text-muted-foreground text-sm mt-1">Cursada grupal ya en marcha — quedan como referencia, vas a poder inscribirte en la próxima edición.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cursosEnCurso.map((course: any) => (
                    <CourseCatalogCard key={course.id} course={course} canEnroll={false} onEnroll={() => {}} />
                  ))}
                </div>
              </div>
            )}

            {cursosGrabados.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Cursos Grabados</h2>
                    <p className="text-muted-foreground text-sm mt-1">Acceso a tu ritmo, cuando quieras — mirá la primera clase gratis antes de comprar.</p>
                  </div>
                  <Badge variant="secondary" className="text-xs font-bold">{cursosGrabados.length} cursos</Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cursosGrabados.map((course: any) => (
                    <CourseCatalogCard key={course.id} course={course} canEnroll onEnroll={() => setModalCourse(course)} />
                  ))}
                </div>
              </div>
            )}

            {/* CATÁLOGO: ediciones finalizadas — solo para que se vea la oferta
                completa, sin botón porque no se pueden inscribir ahora. */}
            {cursosFinalizados.length > 0 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Catálogo Completo</h2>
                  <p className="text-muted-foreground text-sm mt-1">Estos cursos ya finalizaron. Vas a poder inscribirte cuando se abra la próxima edición.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cursosFinalizados.map((course: any) => (
                    <CourseCatalogCard key={course.id} course={course} canEnroll={false} onEnroll={() => {}} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      <EnrollmentDialog course={modalCourse} onClose={() => setModalCourse(null)} />
    </>
  );
};

export default StudentDashboard;