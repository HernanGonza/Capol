import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Tilt from "react-parallax-tilt";
import {
  GraduationCap,
  Users,
  BookOpen,
  ArrowRight,
  Sparkles,
  Play,
  CheckCircle,
  Star,
  Zap,
  Monitor,
  Calendar,
  Mail,
  Send,
  ArrowUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Course {
  id: string;
  titulo: string;
  descripcion: string | null;
  url_flyer: string | null;
  tipo_flyer: string | null;
  url_imagen: string | null;
  lecciones: { count: number }[];
  inscripciones: { count: number }[];
}

const Landing = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [totalAlumnos, setTotalAlumnos] = useState<number | null>(null);
  const [inscritosPorCurso, setInscritosPorCurso] = useState<Record<string, number>>({});
  const [leccionesPorCurso, setLeccionesPorCurso] = useState<Record<string, number>>({});
  const [contactForm, setContactForm] = useState({ nombre: "", email: "", mensaje: "" });
  const [sendingContact, setSendingContact] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("cursos")
        .select(
          `
          id,
          titulo,
          descripcion,
          url_flyer,
          tipo_flyer,
          url_imagen,
          lecciones (count),
          inscripciones (count)
        `,
        )
        .eq("publicado", true)
        .order("creado_en", { ascending: false });

      if (!error && data) {
        setCourses(data);
      }
      setLoading(false);

      // Estadísticas reales para el hero y las tarjetas de curso (vía funciones públicas,
      // ya que un visitante anónimo no tiene permiso para leer las tablas directamente)
      const { data: alumnos } = await supabase.rpc("contar_alumnos_totales");
      if (typeof alumnos === "number") setTotalAlumnos(alumnos);

      const { data: inscritos } = await supabase.rpc("contar_inscritos_por_curso");
      if (inscritos) {
        const map: Record<string, number> = {};
        inscritos.forEach((row) => { map[row.curso_id] = row.cantidad; });
        setInscritosPorCurso(map);
      }

      const { data: lecciones } = await supabase.rpc("contar_lecciones_por_curso");
      if (lecciones) {
        const map: Record<string, number> = {};
        lecciones.forEach((row) => { map[row.curso_id] = row.cantidad; });
        setLeccionesPorCurso(map);
      }
    };

    fetchCourses();
  }, []);

  const openVideoModal = (videoUrl: string) => {
    setSelectedVideo(videoUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedVideo(null);
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
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Efecto de grid de fondo */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Glow effects */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[150px] pointer-events-none" />

      {/* NAVBAR */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 backdrop-blur-xl bg-black/40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img
                src="/logo-capol.webp"
                alt="CAPOL"
                className="h-12 w-12 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow"
              />
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity" />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight">CAPOL</span>
              <p className="text-[10px] text-indigo-300/70 font-medium tracking-[0.2em] uppercase">
                Escuela Virtual
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-1 md:gap-3">
            <a href="#contacto" onClick={(e) => handleScrollTo(e, "contacto")}>
              <Button
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/5 font-semibold hidden sm:inline-flex"
              >
                Contacto
              </Button>
            </a>
            <Link to="/auth">
              <Button
                variant="ghost"
                className="text-white/70 hover:text-white hover:bg-white/5 font-semibold"
              >
                Iniciar Sesión
              </Button>
            </Link>
            <Link to="/auth?registro=1">
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold px-6 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
                Inscribirme
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-36 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm animate-fade-in">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300">
                Capacitación Online de Calidad
              </span>
            </div>

            {/* Título principal */}
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] animate-fade-in">
              <span className="block text-white">Aprendé</span>
              <span className="block bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Informática
              </span>
              <span className="block text-white/90">desde tu casa</span>
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in">
              Cursos en vivo con profesores expertos, material de estudio
              interactivo y certificación al completar.
              <span className="text-indigo-400">
                {" "}
                Tu futuro digital empieza acá.
              </span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in">
              <Link to="/auth?registro=1">
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 font-black text-lg px-8 h-14 rounded-2xl shadow-2xl shadow-white/10 hover:shadow-white/20 transition-all group"
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Comenzar Ahora
                </Button>
              </Link>
              <a href="#cursos" onClick={(e) => handleScrollTo(e, "cursos")}>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-white/30 text-white hover:bg-white hover:text-black font-semibold text-lg px-8 h-14 rounded-2xl transition-colors"
                >
                  Ver Cursos
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 pt-12 animate-fade-in">
              <div className="text-center">
                <p className="text-3xl font-black text-white">
                  {totalAlumnos !== null ? `${totalAlumnos}+` : "—"}
                </p>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
                  Alumnos
                </p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-black text-white">
                  {courses.length}
                </p>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
                  Cursos
                </p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-black text-indigo-400">
                  {Object.values(inscritosPorCurso).reduce((a, b) => a + b, 0)}
                </p>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
                  Inscripciones
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative py-14 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="animate-fade-in group p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Monitor className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Clases en Vivo</h3>
              <p className="text-white/50 leading-relaxed">
                Videoconferencias interactivas con tus profesores. Preguntá,
                participá y aprendé en tiempo real.
              </p>
            </div>

            <div className="animate-fade-in group p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-purple-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Material Interactivo</h3>
              <p className="text-white/50 leading-relaxed">
                Videos, ejercicios prácticos, consola integrada y quizzes para
                reforzar cada concepto.
              </p>
            </div>

            <div className="animate-fade-in group p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-pink-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">A tu Ritmo</h3>
              <p className="text-white/50 leading-relaxed">
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
            <Badge className="mb-4 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-bold">
              CATÁLOGO
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Cursos Disponibles
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Elegí el curso que mejor se adapte a tus objetivos profesionales
            </p>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[400px] rounded-3xl bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-16 h-16 text-white/20 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Próximamente</h3>
              <p className="text-white/50">
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
                  className="animate-fade-in"
                >
                <Card
                  className="group bg-transparent border-white/10 hover:border-indigo-500/50 rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Flyer/Imagen/Video */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                    {course.url_flyer || course.url_imagen ? (
                      course.tipo_flyer === "video" ||
                      course.url_flyer?.endsWith(".mp4") ? (
                        <button
                          type="button"
                          onClick={() => openVideoModal(course.url_flyer || "")}
                          className="relative w-full h-full block cursor-pointer"
                          aria-label="Ver video del curso en grande"
                        >
                          <video
                            src={course.url_flyer || ""}
                            className="w-full h-full object-contain bg-black"
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
                        <img
                          src={course.url_flyer || course.url_imagen || ""}
                          alt={course.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <GraduationCap className="w-20 h-20 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                    {/* Badge de clases */}
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-black/50 backdrop-blur-sm text-white border-none font-bold">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {leccionesPorCurso[course.id] || 0} clases
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-4 bg-[#0f0f15]">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                        {course.titulo}
                      </h3>
                      <p className="text-white/50 text-sm line-clamp-2 leading-relaxed">
                        {course.descripcion ||
                          "Próximamente más información sobre este curso."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 text-white/40 text-sm">
                        <Users className="w-4 h-4" />
                        <span>
                          {inscritosPorCurso[course.id] || 0} inscriptos
                        </span>
                      </div>

                      <Link to="/auth?registro=1">
                        <Button
                          size="sm"
                          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl group-hover:shadow-lg group-hover:shadow-indigo-500/25 transition-all"
                        >
                          Inscribirme
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
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
          <div className="relative rounded-[2.5rem] bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 p-12 md:p-16 text-center overflow-hidden">
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

              <p className="text-white/60 text-lg max-w-xl mx-auto">
                Unite a cientos de estudiantes que ya están transformando su
                futuro profesional con CAPOL.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link to="/auth?registro=1">
                  <Button
                    size="lg"
                    className="bg-white text-black hover:bg-white/90 font-black text-lg px-10 h-14 rounded-2xl shadow-2xl"
                  >
                    Crear Cuenta Gratis
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-6 pt-6 text-sm text-white/40">
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
      <section id="contacto" className="relative py-16 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 animate-fade-in">
            <Badge className="mb-4 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-bold">
              CONTACTO
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
              ¿Tenés dudas? Escribinos
            </h2>
            <p className="text-white/50 text-lg">
              Contanos qué necesitás y te respondemos a la brevedad.
            </p>
          </div>

          <form onSubmit={handleContactSubmit} className="animate-fade-in bg-white/5 border border-white/10 rounded-3xl p-6 md:p-10 space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-white/40 tracking-wider">Nombre</label>
                <Input
                  required
                  value={contactForm.nombre}
                  onChange={(e) => setContactForm({ ...contactForm, nombre: e.target.value })}
                  placeholder="Tu nombre"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-white/40 tracking-wider">Email</label>
                <Input
                  required
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="tu@email.com"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-12 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-white/40 tracking-wider">Mensaje</label>
              <Textarea
                required
                value={contactForm.mensaje}
                onChange={(e) => setContactForm({ ...contactForm, mensaje: e.target.value })}
                placeholder="Contanos en qué te podemos ayudar..."
                rows={5}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl resize-none"
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

          <div className="flex items-center justify-center gap-2 mt-8 text-white/40 text-sm">
            <Mail className="w-4 h-4" />
            <span>También podés escribirnos directamente a nuestro correo</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6 text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <img
              src="/logo-capol.webp"
              alt="CAPOL"
              className="h-10 w-10 rounded-xl"
            />
            <div className="text-left">
              <span className="font-bold text-white">CAPOL</span>
              <p className="text-xs text-white/40">
                Escuela Virtual de Informática
              </p>
            </div>
          </div>

          <p className="text-white/30 text-sm text-center">
            © {new Date().getFullYear()} CAPOL. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-4 justify-center md:justify-end">
            <Link
              to="/auth"
              className="text-white/50 hover:text-white text-sm font-medium transition-colors"
            >
              Acceder
            </Link>
            <span className="text-white/20">|</span>
            <a
              href="mailto:contacto@capol.com"
              className="text-white/50 hover:text-white text-sm font-medium transition-colors"
            >
              Contacto
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/5 flex justify-center">
          <a
            href="https://www.paralelo.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white/30 hover:text-white/70 text-xs font-medium transition-colors"
          >
            <span>Desarrollado por</span>
            <img src="/paralelo-iso.png" alt="Paralelo Software Studio" className="h-4 w-4 rounded" />
            <span className="font-bold tracking-wide">PARALELO SOFTWARE STUDIO</span>
          </a>
        </div>
      </footer>

      {/* Modal de video del flyer del curso */}
      <Dialog open={isModalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="sm:max-w-2xl bg-black border-white/10 p-2">
          {selectedVideo && (
            <video
              src={selectedVideo}
              className="w-full max-h-[80vh] rounded-xl"
              controls
              autoPlay
              playsInline
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Botón flotante de "volver arriba" */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Volver arriba"
          className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-white text-slate-900 shadow-2xl shadow-black/40 flex items-center justify-center hover:scale-110 transition-transform animate-fade-in"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default Landing;