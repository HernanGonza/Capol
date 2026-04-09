import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Calendar
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string | null;
  flyer_url: string | null;
  flyer_type: string | null;
  image_url: string | null;
  lessons: { count: number }[];
  enrollments: { count: number }[];
}

const Landing = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          id,
          title,
          description,
          flyer_url,
          flyer_type,
          image_url,
          lessons (count),
          enrollments (count)
        `)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCourses(data);
      }
      setLoading(false);
    };

    fetchCourses();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Efecto de grid de fondo */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />
      
      {/* Glow effects */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/15 rounded-full blur-[150px] pointer-events-none" />

      {/* NAVBAR */}
      <nav className="relative z-50 border-b border-white/5 backdrop-blur-xl bg-black/20">
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
              <p className="text-[10px] text-indigo-300/70 font-medium tracking-[0.2em] uppercase">Escuela Virtual</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5 font-semibold">
                Iniciar Sesión
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-bold px-6 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
                Inscribirme
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm animate-fade-in">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-indigo-300">Capacitación Online de Calidad</span>
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
              Cursos en vivo con profesores expertos, material de estudio interactivo y certificación al completar. 
              <span className="text-indigo-400"> Tu futuro digital empieza acá.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-fade-in">
              <Link to="/auth">
                <Button size="lg" className="bg-white text-black hover:bg-white/90 font-black text-lg px-8 h-14 rounded-2xl shadow-2xl shadow-white/10 hover:shadow-white/20 transition-all group">
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Comenzar Ahora
                </Button>
              </Link>
              <a href="#cursos">
                <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 font-semibold text-lg px-8 h-14 rounded-2xl">
                  Ver Cursos
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center gap-8 pt-12 animate-fade-in">
              <div className="text-center">
                <p className="text-3xl font-black text-white">100+</p>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Alumnos</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-black text-white">{courses.length}+</p>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Cursos</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-3xl font-black text-indigo-400">4.9</p>
                <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative py-20 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="group p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-indigo-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Monitor className="w-7 h-7 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Clases en Vivo</h3>
              <p className="text-white/50 leading-relaxed">Videoconferencias interactivas con tus profesores. Preguntá, participá y aprendé en tiempo real.</p>
            </div>

            <div className="group p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-purple-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Material Interactivo</h3>
              <p className="text-white/50 leading-relaxed">Videos, ejercicios prácticos, consola integrada y quizzes para reforzar cada concepto.</p>
            </div>

            <div className="group p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 hover:border-pink-500/30 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">A tu Ritmo</h3>
              <p className="text-white/50 leading-relaxed">Accedé al contenido cuando quieras. Las clases quedan grabadas para que las repases.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CURSOS */}
      <section id="cursos" className="relative py-24 px-6">
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
                <div key={i} className="h-[400px] rounded-3xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-20">
              <GraduationCap className="w-16 h-16 text-white/20 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-2">Próximamente</h3>
              <p className="text-white/50">Estamos preparando nuevos cursos para vos</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courses.map((course, index) => (
                <Card 
                  key={course.id} 
                  className="group bg-transparent border-white/10 hover:border-indigo-500/50 rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Flyer/Imagen/Video */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                    {course.flyer_url || course.image_url ? (
                      course.flyer_type === "video" || course.flyer_url?.endsWith(".mp4") ? (
                        <video 
                          src={course.flyer_url || ''} 
                          className="w-full h-full object-contain bg-black"
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <img 
                          src={course.flyer_url || course.image_url || ''} 
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      )
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <GraduationCap className="w-20 h-20 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Badge de clases */}
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-black/50 backdrop-blur-sm text-white border-none font-bold">
                        <BookOpen className="w-3 h-3 mr-1" />
                        {course.lessons[0]?.count || 0} clases
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-4 bg-[#0f0f15]">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-white/50 text-sm line-clamp-2 leading-relaxed">
                        {course.description || "Próximamente más información sobre este curso."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 text-white/40 text-sm">
                        <Users className="w-4 h-4" />
                        <span>{course.enrollments[0]?.count || 0} inscritos</span>
                      </div>
                      
                      <Link to="/auth">
                        <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl group-hover:shadow-lg group-hover:shadow-indigo-500/25 transition-all">
                          Inscribirme
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
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
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              
              <h2 className="text-3xl md:text-4xl font-black tracking-tight">
                ¿Listo para empezar tu carrera en tecnología?
              </h2>
              
              <p className="text-white/60 text-lg max-w-xl mx-auto">
                Unite a cientos de estudiantes que ya están transformando su futuro profesional con CAPOL.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link to="/auth">
                  <Button size="lg" className="bg-white text-black hover:bg-white/90 font-black text-lg px-10 h-14 rounded-2xl shadow-2xl">
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

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo-capol.webp" alt="CAPOL" className="h-10 w-10 rounded-xl" />
            <div>
              <span className="font-bold text-white">CAPOL</span>
              <p className="text-xs text-white/40">Escuela Virtual de Informática</p>
            </div>
          </div>

          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} CAPOL. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-4">
            <Link to="/auth" className="text-white/50 hover:text-white text-sm font-medium transition-colors">
              Acceder
            </Link>
            <span className="text-white/20">|</span>
            <a href="mailto:contacto@capol.com" className="text-white/50 hover:text-white text-sm font-medium transition-colors">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
