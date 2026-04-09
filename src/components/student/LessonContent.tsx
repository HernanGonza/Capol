import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  CheckCircle, 
  Video, 
  Code, 
  Info, 
  Download, 
  ArrowRight, 
  HelpCircle, 
  FileCode, 
  CheckSquare, 
  GitCompare, 
  Trophy 
} from "lucide-react";
import JitsiMeet from "@/components/JitsiMeet";
import Terminal from "@/components/Terminal"; 
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import confetti from "canvas-confetti";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

interface Props {
  lesson: Lesson;
  onBack: () => void;
  userId: string;
  courseTitle?: string;
}

const LessonContent = ({ lesson, onBack, userId, courseTitle }: Props) => {
  const queryClient = useQueryClient();
  const [showJitsi, setShowJitsi] = useState(false);

  // 1. Consultar progreso para saber si ya está completada
  const { data: progress } = useQuery({
    queryKey: ["lesson-progress", lesson.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("lesson_id", lesson.id)
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const isCompleted = !!progress?.completed;

  const blocks = (() => {
    try {
      return JSON.parse(lesson.content || "[]");
    } catch (e) {
      return [{ id: "old-html", type: "text", value: lesson.content }];
    }
  })();

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lesson_progress").upsert({
        user_id: userId,
        lesson_id: lesson.id,
        completed: true,
        completed_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-courses-progress"] });
      queryClient.invalidateQueries({ queryKey: ["lesson-progress", lesson.id, userId] });
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });

      toast.success("¡Lección completada con éxito!", { icon: '🎓' });
    },
  });

  const getEmbedUrl = (url: string) => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };

  return (
    <div className={`max-w-5xl mx-auto space-y-12 animate-fade-in pb-24 px-4 transition-all duration-1000 ${isCompleted ? 'ring-2 ring-emerald-500/20 rounded-[3rem] bg-emerald-50/5 p-8' : ''}`}>
      
      {/* HEADER LIMPIO */}
      <div className="flex flex-col gap-5 border-b pb-8">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-2xl shadow-sm shrink-0 h-12 w-12 border-slate-200">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900 leading-tight">
                {lesson.title}
              </h1>
              {isCompleted && (
                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-bounce">
                  <CheckCircle className="w-3 h-3" /> Completada
                </div>
              )}
            </div>
            <p className="text-muted-foreground font-medium text-lg mt-1">{lesson.description || "Material de estudio"}</p>
          </div>
        </div>
      </div>

      {/* TODOS LOS BLOQUES DINÁMICOS */}
      <div className="space-y-16">
        {blocks.map((block: any) => (
          <div key={block.id} className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            
            {/* 1. TEXTO / MD */}
            {block.type === 'text' && (
              <div className="prose prose-slate max-w-none prose-lg prose-headings:font-black prose-p:text-slate-600">
                <div dangerouslySetInnerHTML={{ __html: block.value }} className="leading-relaxed" />
              </div>
            )}

            {/* 2. VIDEO */}
            {block.type === 'video' && (
              <Card className="overflow-hidden border-none shadow-2xl rounded-[2rem] bg-black ring-8 ring-slate-100">
                <div className="aspect-video">
                  <iframe src={getEmbedUrl(block.value)} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />
                </div>
              </Card>
            )}

            {/* 3. IMAGEN */}
            {block.type === 'image' && (
              <div className="flex flex-col items-center group">
                <img src={block.value} alt="Visual" className="rounded-3xl shadow-2xl max-h-[700px] object-contain border-4 border-white" />
              </div>
            )}

            {/* 4. TERMINAL */}
            {block.type === 'terminal' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-[0.2em] px-2">
                  <div className="p-1.5 bg-primary/10 rounded-lg"><Code className="w-4 h-4" /></div>
                  <span>Práctica en Consola</span>
                </div>
                <Terminal codigoInicial={block.value} />
              </div>
            )}

            {/* 5. CALLOUT */}
            {block.type === 'callout' && (
              <div className={`p-6 rounded-2xl border-l-[6px] flex gap-5 shadow-sm ${
                block.style === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-900' :
                block.style === 'tip' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' :
                'bg-blue-50 border-blue-500 text-blue-900'
              }`}>
                <Info className="w-7 h-7 shrink-0 opacity-80" />
                <div className="font-bold text-lg leading-snug">{block.value}</div>
              </div>
            )}

            {/* 6. RECURSO */}
            {block.type === 'download' && (
              <a href={block.value} target="_blank" className="flex items-center justify-between p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-primary hover:shadow-xl transition-all group">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-primary/10 transition-colors"><Download className="w-7 h-7 text-slate-400 group-hover:text-primary" /></div>
                  <div>
                    <div className="font-black text-xl text-slate-900">Material de Apoyo</div>
                    <div className="text-sm text-slate-400 font-bold uppercase tracking-tighter">Descargar archivos</div>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-primary group-hover:translate-x-2 transition-all" />
              </a>
            )}

            {/* 7. MINI QUIZ */}
            {block.type === 'quiz' && (
              <Card className="border-2 border-slate-100 shadow-xl rounded-[2rem] overflow-hidden">
                <div className="bg-slate-50 p-6 border-b flex items-center gap-4">
                  <HelpCircle className="w-6 h-6 text-primary" />
                  <h4 className="font-black text-xl text-slate-800">{block.value}</h4>
                </div>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['A', 'B'].map((opt) => (
                    <Button key={opt} variant="outline" className="h-auto py-6 px-8 text-lg font-bold rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left justify-start" onClick={() => {
                      opt === block.correct ? toast.success("¡Respuesta Correcta!") : toast.error("Incorrecto, prueba otra vez.");
                    }}>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-4 shrink-0 text-sm">{opt}</div>
                      {opt === 'A' ? block.a : block.b}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 8. SNIPPET */}
            {block.type === 'snippet' && (
              <div className="relative group">
                <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="sm" className="font-bold" onClick={() => {
                    navigator.clipboard.writeText(block.value);
                    toast.success("Copiado");
                  }}>COPIAR</Button>
                </div>
                <pre className="p-8 bg-slate-900 text-slate-100 rounded-[2rem] overflow-x-auto font-mono text-sm leading-relaxed shadow-2xl border-4 border-slate-800">
                  <code>{block.value}</code>
                </pre>
              </div>
            )}

            {/* 9. CHECKLIST */}
            {block.type === 'checklist' && (
              <div className="bg-slate-50/50 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <CheckSquare className="w-6 h-6 text-primary" />
                  <h4 className="font-black text-sm uppercase tracking-[0.2em] text-slate-500">Hoja de Ruta</h4>
                </div>
                <div className="grid gap-3">
                  {block.value.split('\n').filter((t: any) => t.trim() !== "").map((task: string, i: number) => (
                    <label key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 cursor-pointer hover:shadow-md transition-all group">
                      <input type="checkbox" className="w-6 h-6 rounded-lg border-slate-300 text-primary cursor-pointer" />
                      <span className="text-slate-700 font-bold group-has-[:checked]:line-through group-has-[:checked]:text-slate-300 transition-all text-lg">
                        {task}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 10. DIFF (COMPARACIÓN) */}
            {block.type === 'diff' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] px-4">
                  <GitCompare className="w-4 h-4" /> <span>Comparativa de cambios</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-200 border-4 border-slate-200 rounded-[2rem] overflow-hidden shadow-2xl">
                  <div className="bg-white p-6 border-r">
                    <div className="text-[10px] font-black text-red-400 mb-3 uppercase">Anterior</div>
                    <pre className="font-mono text-xs text-slate-500 bg-red-50/30 p-5 rounded-2xl"><code>{block.oldValue}</code></pre>
                  </div>
                  <div className="bg-white p-6">
                    <div className="text-[10px] font-black text-emerald-500 mb-3 uppercase">Nuevo</div>
                    <pre className="font-mono text-xs text-slate-800 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100"><code>{block.newValue}</code></pre>
                  </div>
                </div>
              </div>
            )}

          </div>
        ))}
      </div>

      {/* JITSI */}
      {lesson.jitsi_room_name && (
        <div className="pt-16">
          <Card className="border-none shadow-elevated bg-slate-900 text-white overflow-hidden rounded-[3rem]">
            <CardContent className="p-0">
              {showJitsi ? (
                <div className="h-[700px]">
                  <JitsiMeet 
                    roomName={lesson.jitsi_room_name}
                    courseTitle={courseTitle}
                    lessonTitle={lesson.title}
                    onClose={() => setShowJitsi(false)}
                  />
                </div>
              ) : (
                <div className="text-center py-20 px-10">
                  <Video className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse" />
                  <h3 className="text-3xl font-black mb-4 tracking-tighter">Clase en Vivo</h3>
                  <Button onClick={() => setShowJitsi(true)} className="bg-white text-slate-900 font-black px-12 h-14 rounded-2xl text-lg shadow-2xl">INGRESAR AHORA</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* BOTÓN FINAL DE COMPLETADO */}
      <div className="pt-16 mt-20 border-t border-slate-100 space-y-10">
        {!isCompleted ? (
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-center space-y-6 shadow-2xl shadow-primary/20">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white tracking-tight">¿Terminaste de estudiar?</h3>
              <p className="text-slate-400 font-medium">Marca esta lección como completada para seguir avanzando.</p>
            </div>
            <Button 
              onClick={() => completeMutation.mutate()} 
              className="gradient-primary text-white font-black px-12 h-16 rounded-2xl text-xl shadow-xl hover:scale-105 transition-transform w-full md:w-auto"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? "GUARDANDO..." : "MARCAR COMO CLASE COMPLETADA"}
              <CheckCircle className="ml-2 w-6 h-6" />
            </Button>
          </div>
        ) : (
          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-[2.5rem] p-10 text-center space-y-4 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-emerald-900 tracking-tight">¡Lección Dominada!</h3>
            <p className="text-emerald-700 font-medium max-w-md mx-auto">Ya completaste este contenido. ¡Buen trabajo!</p>
          </div>
        )}

        <div className="flex items-center justify-between opacity-60">
          <Button variant="ghost" onClick={onBack} className="text-slate-500 hover:text-slate-900 font-bold">
            <ArrowLeft className="w-5 h-5 mr-2" /> Volver al Programa
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LessonContent;