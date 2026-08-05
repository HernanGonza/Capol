import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PriceTag from "@/components/PriceTag";
import { detectCountryCode } from "@/lib/currency";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Tilt from "react-parallax-tilt";
import ScrollReveal from "scrollreveal";
import {
  GraduationCap,
  BookOpen,
  ArrowRight,
  Sparkles,
  Play,
  CheckCircle,
  Star,
  Zap,
  Monitor,
  Calendar,
  Clock,
  Maximize2,
  Mail,
  Send,
  ArrowUp,
  Hourglass,
  Video,
  Film,
  Youtube,
  Instagram,
  Facebook,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import FaqBot from "@/components/FaqBot";
import { useDocumentMeta } from "@/hooks/use-document-meta";

interface Course {
  id: string;
  grupo_id: string | null;
  titulo: string;
  descripcion: string | null;
  url_flyer: string | null;
  tipo_flyer: string | null;
  url_imagen: string | null;
  estado: "proximamente" | "activo" | "finalizado";
  modalidad: "en_vivo" | "grabado";
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horarios: string | null;
  duracion: string | null;
  precio: number | null;
  moneda: string | null;
  cotizacion_ars: number | null;
  tipo_precio: string | null;
  cantidad_cuotas: number | null;
  lecciones: { count: number }[];
  inscripciones: { count: number }[];
}

// wa.me arma solo el link correcto (app en mobile, WhatsApp Web en
// desktop) — el número va sin espacios/guiones/+, con el 9 de celular
// argentino incluido: +54 9 383 447-9734 -> 5493834479734.
const WHATSAPP_NUMBER = "5493834479734";

const Landing = () => {
  useDocumentMeta("Plataforma CapOL | Escuela Virtual de Informática", "/");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseMedia, setSelectedCourseMedia] = useState<{ url: string; type: "video" | "image"; titulo: string; descripcion: string | null } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalAlumnos, setTotalAlumnos] = useState<number | null>(null);
  const [totalRegistrados, setTotalRegistrados] = useState<number | null>(null);
  const [leccionesPorCurso, setLeccionesPorCurso] = useState<Record<string, number>>({});
  const [contactForm, setContactForm] = useState({ nombre: "", email: "", mensaje: "" });
  const [sendingContact, setSendingContact] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Contador de visitas para las métricas del admin — un registro por carga
  // de la Landing, sin importar si el visitante está logueado o no. Se
  // manda el país (mismo detectCountryCode que usa el precio automático)
  // para poder separar después "Argentina" vs "resto del mundo" en Métricas
  // — no bloquea el insert si la geolocalización falla, la visita se
  // cuenta igual, solo queda sin país conocido.
  useEffect(() => {
    detectCountryCode().then((pais_code) => {
      supabase.from("landing_visits").insert({ pais_code }).then(({ error }) => {
        if (error) console.error("No se pudo registrar la visita:", error);
      });
    });
  }, []);

  // Las tarjetas de curso van apareciendo a medida que se scrollea hasta ellas
  // (scrollrevealjs.org). Importante: agregamos una red de seguridad que, a los
  // pocos segundos, fuerza que todo quede visible igual, pase lo que pase — así
  // nunca puede repetirse el problema de contenido invisible que tuvimos antes.
  useEffect(() => {
    if (courses.length === 0) return;

    const sr = ScrollReveal({
      distance: "40px",
      duration: 700,
      easing: "cubic-bezier(0.5, 0, 0, 1)",
      interval: 70,
      reset: false,
    });
    sr.reveal(".reveal-card", { origin: "bottom" });

    const safety = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".reveal-card").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
    }, 2500);

    return () => {
      sr.destroy();
      window.clearTimeout(safety);
    };
  }, [courses.length]);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select(
          `
          id,
          grupo_id,
          titulo,
          descripcion,
          url_flyer,
          tipo_flyer,
          url_imagen,
          estado,
          modalidad,
          fecha_inicio,
          fecha_fin,
          horarios,
          duracion,
          precio,
          moneda,
          cotizacion_ars,
          tipo_precio,
          cantidad_cuotas,
          lecciones (count),
          inscripciones (count)
        `,
        )
        .eq("publicado", true)
        .order("creado_en", { ascending: false });

      if (!error && data) {
        // La Landing es la vidriera pública: se muestra una sola tarjeta por
        // curso, sin importar cuántas ediciones (copias) tenga. Se agrupan
        // por grupo_id (no por título, que puede repetirse o editarse) y
        // dentro de cada grupo se prioriza la edición "Próximamente" (la que
        // se puede inscribir), luego la "Activo" (cursando ahora mismo), y
        // recién si todas las ediciones ya terminaron, se muestra la más
        // reciente "Finalizado" como referencia. Así, a medida que una
        // edición termina y se crea la siguiente, la Landing va mostrando
        // automáticamente la que corresponda sin intervención manual.
        const porGrupo = new Map<string, Course[]>();
        for (const c of data as Course[]) {
          const key = c.grupo_id || c.id;
          if (!porGrupo.has(key)) porGrupo.set(key, []);
          porGrupo.get(key)!.push(c);
        }
        const deduplicados = Array.from(porGrupo.values()).map((ediciones) => {
          const proxima = ediciones.find((c) => c.estado === "proximamente");
          if (proxima) return proxima;
          const cursando = ediciones.find((c) => c.estado === "activo");
          if (cursando) return cursando;
          return [...ediciones].sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""))[0];
        });
        // Prioriza "Próximamente" (se pueden inscribir) y después "Activo"
        // (cursando ahora); "Finalizado" queda al final. Es un sort estable,
        // así que dentro de cada estado se mantiene el orden por creación
        // que ya trae la query.
        const prioridadEstado: Record<Course["estado"], number> = { proximamente: 0, activo: 1, finalizado: 2 };
        deduplicados.sort((a, b) => prioridadEstado[a.estado] - prioridadEstado[b.estado]);
        setCourses(deduplicados);
      }
      setLoading(false);

      // Estadísticas reales para el hero y las tarjetas de curso (vía funciones públicas,
      // ya que un visitante anónimo no tiene permiso para leer las tablas directamente)
      const { data: alumnos } = await supabase.rpc("contar_alumnos_totales");
      if (typeof alumnos === "number") setTotalAlumnos(alumnos);

      const { data: registrados } = await supabase.rpc("contar_registrados_totales");
      if (typeof registrados === "number") setTotalRegistrados(registrados);

      const { data: lecciones } = await supabase.rpc("contar_lecciones_por_curso");
      if (lecciones) {
        const map: Record<string, number> = {};
        lecciones.forEach((row) => { map[row.curso_id] = row.cantidad; });
        setLeccionesPorCurso(map);
      }
    };

    fetchCourses();
  }, []);

  const openMediaModal = (course: Course) => {
    const isVideo = course.tipo_flyer === "video" || course.url_flyer?.endsWith(".mp4");
    setSelectedCourseMedia({
      url: course.url_flyer || course.url_imagen || "",
      type: isVideo ? "video" : "image",
      titulo: course.titulo,
      descripcion: course.descripcion,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCourseMedia(null);
  };

  const handleScrollTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.nombre.trim() || !contactForm.email.trim() || !contactForm.mensaje.trim()) return;
    setSendingContact(true);
    try {
      // Guardamos el mensaje siempre (así no se pierde ninguno), y además
      // intentamos mandar el mail al admin a través de la función de Supabase.
      const { error: insertError } = await supabase.from("mensajes_contacto").insert(contactForm);
      if (insertError) throw insertError;

      const { error: fnError } = await supabase.functions.invoke("send-contact-email", {
        body: contactForm,
      });
      if (fnError) {
        // El mensaje ya quedó guardado en la base aunque falle el envío del mail,
        // así que igual lo tratamos como éxito parcial para el usuario.
        console.error("No se pudo enviar el mail de contacto:", fnError);
      }

      setContactForm({ nombre: "", email: "", mensaje: "" });
      toast.success("¡Mensaje enviado! Te vamos a responder a la brevedad.");
    } catch (err: any) {
      toast.error("No se pudo enviar el mensaje. Probá de nuevo en un rato.");
    } finally {
      setSendingContact(false);
    }
  };

  // Nota: antes usábamos la librería ScrollReveal acá para animar estas secciones
  // al entrar en pantalla, pero podía dejar el contenido con opacidad 0 de forma
  // permanente si el "reveal" no llegaba a dispararse (ver clases .reveal-up /
  // .reveal-fade, ahora reemplazadas por animate-fade-in vía CSS, sin ese riesgo).

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0f] text-slate-900 dark:text-white overflow-hidden">
      {/* Efecto de grid de fondo */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Glow effects */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[150px] pointer-events-none" />

      {/* NAVBAR */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-200 dark:border-white/5 backdrop-blur-xl bg-white/70 dark:bg-black/40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0 min-w-0">
            <div className="relative shrink-0">
              <img
                src="/logo-capol.webp"
                alt="CapOL"
                className="h-9 w-9 sm:h-12 sm:w-12 rounded-full object-cover shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow shrink-0"
              />
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur opacity-30 group-hover:opacity-50 transition-opacity -z-10" />
            </div>
            <div className="min-w-0">
              <span className="font-black text-lg sm:text-xl tracking-tight block leading-tight">CapOL</span>
              <p className="hidden sm:block text-[10px] text-indigo-600/80 dark:text-indigo-300/70 font-medium tracking-[0.2em] uppercase">
                Escuela Virtual
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-0.5 sm:gap-3 shrink-0">
            <ThemeToggle
              collapsed
              className="text-slate-500 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
            />
            <a href="#contacto" onClick={(e) => handleScrollTo(e, "contacto")}>
              <Button
                variant="ghost"
                className="text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-semibold hidden sm:inline-flex"
              >
                Contacto
              </Button>
            </a>
            <Link to="/auth">
              <Button
                variant="ghost"
                className="text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-semibold px-1.5 sm:px-4 text-xs sm:text-base"
              >
                Iniciar Sesión
              </Button>
            </Link>
            <Link to="/auth?registro=1">
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold px-2 sm:px-6 text-xs sm:text-base shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
                Registrarse
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
      {/* HERO SECTION */}
      <section className="relative pt-36 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-sm animate-fade-in">
              <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-300">
                Capacitación Online de Calidad
              </span>
            </div>

            {/* Título principal */}
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] animate-fade-in">
              <span className="block text-slate-900 dark:text-white">Aprende</span>
              <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Informática, Programación y más
              </span>
              <span className="block text-slate-700 dark:text-white/90">desde tu casa</span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 dark:text-white/50 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in">
              Cursos en vivo con profesores expertos, material de estudio
              interactivo y certificación al completar.
              <span className="text-indigo-600 dark:text-indigo-400">
                {" "}
                Tu futuro digital empieza acá.
              </span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in">
              <Link to="/auth?registro=1">
                <Button
                  size="lg"
                  className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90 font-black text-lg px-8 h-14 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-white/10 hover:shadow-slate-900/20 dark:hover:shadow-white/20 transition-all group"
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Comenzar Ahora
                </Button>
              </Link>
              <a href="#cursos" onClick={(e) => handleScrollTo(e, "cursos")}>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-slate-300 dark:border-white/30 text-slate-900 dark:text-white hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black font-semibold text-lg px-8 h-14 rounded-2xl transition-colors"
                >
                  Ver Cursos
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 pt-12 animate-fade-in">
              <div className="text-center">
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  {totalAlumnos !== null ? `${totalAlumnos}+` : "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-white/40 font-medium uppercase tracking-wider">
                  Alumnos
                </p>
              </div>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-black text-slate-900 dark:text-white">
                  {courses.length}
                </p>
                <p className="text-xs text-slate-500 dark:text-white/40 font-medium uppercase tracking-wider">
                  Cursos
                </p>
              </div>
              <div className="w-px h-10 bg-slate-200 dark:bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                  {totalRegistrados !== null ? totalRegistrados : "—"}
                </p>
                <p className="text-xs text-slate-500 dark:text-white/40 font-medium uppercase tracking-wider">
                  Inscripciones
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative py-14 px-6 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="animate-fade-in group p-8 rounded-3xl bg-gradient-to-br from-slate-50 dark:from-white/5 to-transparent border border-slate-200 dark:border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Monitor className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold mb-3">Clases en Vivo</h2>
              <p className="text-slate-600 dark:text-white/50 leading-relaxed">
                Videoconferencias interactivas con tus profesores. Preguntá,
                participá y aprendé en tiempo real.
              </p>
            </div>

            <div className="animate-fade-in group p-8 rounded-3xl bg-gradient-to-br from-slate-50 dark:from-white/5 to-transparent border border-slate-200 dark:border-white/10 hover:border-purple-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7 text-purple-500 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-bold mb-3">Material Interactivo</h2>
              <p className="text-slate-600 dark:text-white/50 leading-relaxed">
                Videos, ejercicios prácticos, consola integrada y quizzes para
                reforzar cada concepto.
              </p>
            </div>

            <div className="animate-fade-in group p-8 rounded-3xl bg-gradient-to-br from-slate-50 dark:from-white/5 to-transparent border border-slate-200 dark:border-white/10 hover:border-pink-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-pink-500 dark:text-pink-400" />
              </div>
              <h2 className="text-xl font-bold mb-3">A tu Ritmo</h2>
              <p className="text-slate-600 dark:text-white/50 leading-relaxed">
                Accedé al contenido cuando quieras. Cuando el profesor graba la
                clase, vas a poder repasarla las veces que necesites.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CURSOS */}
      <section id="cursos" className="relative py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold">
              CATÁLOGO
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Cursos Disponibles
            </h2>
            <p className="text-slate-600 dark:text-white/50 text-lg max-w-2xl mx-auto">
              Elegí el curso que mejor se adapte a tus objetivos profesionales
            </p>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[400px] rounded-3xl bg-slate-100 dark:bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-16 h-16 text-slate-300 dark:text-white/20 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Próximamente</h3>
              <p className="text-slate-600 dark:text-white/50">
                Estamos preparando nuevos cursos para vos
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course, index) => (
                <Tilt
                  key={course.id}
                  tiltMaxAngleX={8}
                  tiltMaxAngleY={8}
                  glareEnable
                  glareMaxOpacity={0.12}
                  glareColor="#818cf8"
                  glarePosition="all"
                  glareBorderRadius="24px"
                  scale={1.02}
                  transitionSpeed={1500}
                  className="reveal-card"
                >
                <Card
                  className="group bg-transparent border-slate-200 dark:border-white/10 hover:border-indigo-500/50 rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Flyer/Imagen/Video: sin proporción fija — la tarjeta toma
                      la altura que le da el propio archivo (w-full h-auto),
                      así se ve completa, a todo el ancho, sin recortarse y
                      sin dejar espacio vacío. Solo el estado "sin imagen"
                      necesita una proporción fija propia. */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                    {course.url_flyer || course.url_imagen ? (
                      course.tipo_flyer === "video" ||
                      course.url_flyer?.endsWith(".mp4") ? (
                        <button
                          type="button"
                          onClick={() => openMediaModal(course)}
                          className="relative w-full block cursor-pointer"
                          aria-label="Ver video del curso en grande"
                        >
                          <video
                            src={course.url_flyer || ""}
                            className="w-full h-auto block"
                            muted
                            loop
                            autoPlay
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
                              <Play className="w-7 h-7 text-black ml-1" fill="black" />
                            </div>
                          </div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMediaModal(course)}
                          className="relative w-full block cursor-pointer"
                          aria-label="Ver imagen del curso en grande"
                        >
                          <img
                            src={course.url_flyer || course.url_imagen || ""}
                            alt={course.titulo}
                            className="w-full h-auto block group-hover:scale-105 transition-transform duration-700"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
                              <Maximize2 className="w-6 h-6 text-black" />
                            </div>
                          </div>
                        </button>
                      )
                    ) : (
                      <div className="aspect-[4/3] flex items-center justify-center">
                        <GraduationCap className="w-20 h-20 text-slate-400 dark:text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                    {/* Banner diagonal: grabado vs en vivo, en colores distintos */}
                    <div
                      className={`absolute -right-11 top-6 z-20 w-40 rotate-45 text-white text-[11px] font-black uppercase tracking-widest text-center py-1 shadow-lg ${
                        course.modalidad === "grabado"
                          ? "bg-gradient-to-r from-fuchsia-600 to-purple-600"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500"
                      }`}
                    >
                      {course.modalidad === "grabado" ? "Grabado" : "En vivo"}
                    </div>

                    {/* Badge de estado */}
                    <div className="absolute top-4 left-4">
                      {course.estado === "proximamente" ? (
                        <Badge className="bg-amber-500/90 backdrop-blur-sm text-white border-none font-bold">
                          <Clock className="w-3 h-3 mr-1" /> Próximamente
                        </Badge>
                      ) : course.estado === "finalizado" ? (
                        <Badge className="bg-white/20 backdrop-blur-sm text-white border-none font-bold">
                          <GraduationCap className="w-3 h-3 mr-1" /> Última edición dictada
                        </Badge>
                      ) : (
                        <Badge className="bg-indigo-500/90 backdrop-blur-sm text-white border-none font-bold">
                          <Zap className="w-3 h-3 mr-1" /> Activo
                        </Badge>
                      )}
                    </div>

                    {/* Badge de clases (más abajo, para no chocar con el banner diagonal de arriba) */}
                    <div className="absolute right-4 top-14">
                      <Badge className="bg-amber-400 text-black border-none font-black text-sm px-3 py-1 shadow-lg">
                        <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                        {leccionesPorCurso[course.id] || 0} clases
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-4 bg-white dark:bg-[#0f0f15]">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                        {course.titulo}
                      </h3>
                      <p className="text-slate-600 dark:text-white/50 text-sm line-clamp-2 leading-relaxed">
                        {course.descripcion ||
                          "Próximamente más información sobre este curso."}
                      </p>
                      <div className={`mt-3 flex items-center gap-2 text-xs font-semibold ${course.modalidad === "grabado" ? "text-slate-500 dark:text-white/40" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {course.modalidad === "grabado" ? (
                          <><Film className="w-3.5 h-3.5 shrink-0" /> 100% grabado, sin clases en vivo</>
                        ) : (
                          <><Video className="w-3.5 h-3.5 shrink-0" /> Incluye clases en vivo</>
                        )}
                      </div>
                      {(course.fecha_inicio || course.horarios || course.duracion) && (
                        <div className="mt-3 space-y-1.5">
                          {course.fecha_inicio && (
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 text-xs font-semibold">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Próxima edición: {new Date(`${course.fecha_inicio}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                            </div>
                          )}
                          {course.horarios && (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-white/40 text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>{course.horarios}</span>
                            </div>
                          )}
                          {course.duracion && (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-white/40 text-xs font-semibold">
                              <Hourglass className="w-3.5 h-3.5 shrink-0" />
                              <span>{course.duracion}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/10">
                      {course.precio ? (
                        <div className="flex items-baseline gap-1">
                          {course.tipo_precio === "cuotas" && (
                            <span className="text-slate-600 dark:text-white/50 text-xs font-semibold">{course.cantidad_cuotas}x</span>
                          )}
                          {course.tipo_precio === "clase" && (
                            <span className="text-slate-600 dark:text-white/50 text-xs font-semibold">{course.cantidad_cuotas} clases x</span>
                          )}
                          <PriceTag
                            usdAmount={course.precio}
                            suffix={course.tipo_precio === "mensual" ? "/mes" : ""}
                            className="text-slate-900 dark:text-white font-bold text-lg"
                            arsRate={course.cotizacion_ars}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-white/30">Consultar precio</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
                </Tilt>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-[2.5rem] bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-slate-200 dark:border-white/10 p-12 md:p-16 text-center overflow-hidden">
            {/* Glow interno */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <div className="flex justify-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>

              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                ¿Listo para empezar tu carrera en tecnología?
              </h2>

              <p className="text-slate-600 dark:text-white/60 text-lg max-w-xl mx-auto">
                Unite a cientos de estudiantes que ya están transformando su
                futuro profesional con CapOL.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link to="/auth?registro=1">
                  <Button
                    size="lg"
                    className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90 font-black text-lg px-10 h-14 rounded-2xl shadow-2xl"
                  >
                    Crear Cuenta Gratis
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-6 pt-6 text-sm text-slate-500 dark:text-white/40">
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Sin tarjeta de crédito
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Cancela cuando quieras
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section id="contacto" className="relative py-16 px-6 border-t border-slate-200 dark:border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 animate-fade-in">
            <Badge className="mb-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-bold">
              CONTACTO
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              ¿Tenés dudas? Escribinos
            </h2>
            <p className="text-slate-600 dark:text-white/50 text-lg">
              Contanos qué necesitás y te respondemos a la brevedad.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="animate-fade-in bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-10 space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500 dark:text-white/40 tracking-wider">Nombre</label>
                <Input
                  required
                  value={contactForm.nombre}
                  onChange={(e) => setContactForm({ ...contactForm, nombre: e.target.value })}
                  placeholder="Tu nombre"
                  className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500 dark:text-white/40 tracking-wider">Email</label>
                <Input
                  required
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="tu@email.com"
                  className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 h-12 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-slate-500 dark:text-white/40 tracking-wider">Mensaje</label>
              <Textarea
                required
                value={contactForm.mensaje}
                onChange={(e) => setContactForm({ ...contactForm, mensaje: e.target.value })}
                placeholder="Contanos en qué te podemos ayudar..."
                rows={5}
                className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 rounded-xl resize-none"
              />
            </div>
            <Button
              type="submit"
              disabled={sendingContact}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold h-12 rounded-xl"
            >
              {sendingContact ? "Enviando..." : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Enviar Mensaje
                </>
              )}
            </Button>
          </form>

          <div className="flex items-center justify-center gap-2 mt-8 text-slate-500 dark:text-white/40 text-sm">
            <Mail className="w-4 h-4" />
            <span>También podés escribirnos directamente a nuestro correo</span>
          </div>
        </div>
      </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6 text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <img
              src="/logo-capol.webp"
              alt="CapOL"
              className="h-10 w-10 rounded-full object-cover"
            />
            <div className="text-left">
              <span className="font-bold text-slate-900 dark:text-white">CapOL</span>
              <p className="text-xs text-slate-500 dark:text-white/40">
                Escuela Virtual de Informática
              </p>
            </div>
          </div>

          <p className="text-slate-500 dark:text-white/50 text-sm text-center">
            © {new Date().getFullYear()} CapOL. Todos los derechos reservados.
          </p>

          <div className="flex flex-wrap items-center gap-3 justify-center md:justify-end">
            <Link
              to="/auth"
              className="text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Acceder
            </Link>
            <span className="text-slate-300 dark:text-white/20">|</span>
            <Link
              to="/terminos"
              className="text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Términos
            </Link>
            <span className="text-slate-300 dark:text-white/20">|</span>
            <Link
              to="/privacidad"
              className="text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Privacidad
            </Link>
            <span className="text-slate-300 dark:text-white/20">|</span>
            <a
              href="mailto:capolescuela@gmail.com"
              className="text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors"
            >
              Contacto
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 flex justify-center gap-3">
          <a
            href="https://www.youtube.com/@capolescuela"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="YouTube de CapOL"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:text-white hover:bg-red-600 hover:border-red-600 transition-colors"
          >
            <Youtube className="w-4 h-4" />
          </a>
          <a
            href="https://www.instagram.com/capolescuela/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram de CapOL"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:text-white hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 hover:border-transparent transition-colors"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a
            href="https://www.facebook.com/capolescuela/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook de CapOL"
            className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/50 hover:text-white hover:bg-blue-600 hover:border-blue-600 transition-colors"
          >
            <Facebook className="w-4 h-4" />
          </a>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-200 dark:border-white/5 flex justify-center">
          <a
            href="https://www.paralelo.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/70 text-xs font-medium transition-colors"
          >
            <span>Desarrollado por</span>
            <img src="/paralelo-iso.png" alt="Paralelo Software Studio" className="h-4 w-4 rounded" />
            <span className="font-bold tracking-wide">PARALELO SOFTWARE STUDIO</span>
          </a>
        </div>
      </footer>

      {/* Modal de video/imagen del flyer del curso, con descripción completa */}
      <Dialog open={isModalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-[#0f0f15] border-slate-200 dark:border-white/10 p-0 overflow-hidden max-h-[85vh] overflow-y-auto">
          {selectedCourseMedia && (
            <>
              {selectedCourseMedia.type === "video" ? (
                <video
                  src={selectedCourseMedia.url}
                  className="w-full max-h-[60vh] bg-black"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={selectedCourseMedia.url}
                  alt={selectedCourseMedia.titulo}
                  className="w-full max-h-[60vh] object-contain bg-black"
                />
              )}
              <div className="p-6 space-y-2">
                <DialogTitle asChild>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCourseMedia.titulo}</h3>
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-slate-600 dark:text-white/60 text-sm leading-relaxed whitespace-pre-line">
                    {selectedCourseMedia.descripcion || "Sin descripción disponible."}
                  </p>
                </DialogDescription>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Botón flotante de WhatsApp */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribinos por WhatsApp"
        className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-2xl shadow-emerald-500/30 flex items-center justify-center hover:scale-110 transition-transform"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
        </svg>
      </a>

      {/* Bot de consultas (FAQ interactivo) */}
      <FaqBot courses={courses} whatsappNumber={WHATSAPP_NUMBER} />

      {/* Botón flotante de "volver arriba" (bottom-24 para no chocar con la burbuja del bot en bottom-6) */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          className="fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 dark:bg-none dark:bg-white text-white dark:text-slate-900 shadow-2xl shadow-indigo-500/30 dark:shadow-black/40 flex items-center justify-center hover:scale-110 transition-transform animate-fade-in"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default Landing;