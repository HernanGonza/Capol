import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Video, MessageSquare, Code, Play } from "lucide-react";
import JitsiMeet from "@/components/JitsiMeet";
import Terminal from "@/components/Terminal"; // Importamos tu terminal
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

interface Props {
  lesson: Lesson;
  onBack: () => void;
  userId: string;
}

const LessonContent = ({ lesson, onBack, userId }: Props) => {
  const queryClient = useQueryClient();
  const [showJitsi, setShowJitsi] = useState(false);

  // Parseamos el contenido JSON de bloques
  const blocks = (() => {
    try {
      return JSON.parse(lesson.content || "[]");
    } catch (e) {
      // Fallback si el contenido era HTML viejo
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
      toast.success("¡Clase completada!");
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
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-20">
      {/* Header mejorado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">{lesson.title}</h1>
            <p className="text-muted-foreground font-medium">{lesson.description || "Lección interactiva"}</p>
          </div>
        </div>
        
        <Button 
          onClick={() => completeMutation.mutate()} 
          className="gradient-primary text-primary-foreground font-bold px-6 shadow-lg shadow-primary/20"
          disabled={completeMutation.isPending}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          {completeMutation.isPending ? "Guardando..." : "Terminar clase"}
        </Button>
      </div>

      {/* Renderizado Dinámico de Bloques */}
      <div className="space-y-12">
        {blocks.map((block: any) => (
          <div key={block.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* BLOQUE DE TEXTO */}
            {block.type === 'text' && (
              <div className="prose prose-slate max-w-none prose-lg prose-headings:font-black prose-p:text-slate-600 prose-strong:text-slate-900">
                {/* Usamos un div simple pero podrías usar ReactMarkdown aquí */}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {block.value}
                </div>
              </div>
            )}

            {/* BLOQUE DE VIDEO */}
            {block.type === 'video' && (
              <Card className="overflow-hidden border-none shadow-2xl rounded-2xl bg-black">
                <div className="aspect-video">
                  <iframe
                    src={getEmbedUrl(block.value)}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                </div>
              </Card>
            )}

            {/* BLOQUE DE IMAGEN */}
            {block.type === 'image' && (
              <div className="flex flex-col items-center">
                <img 
                  src={block.value} 
                  alt="Contenido visual" 
                  className="rounded-2xl shadow-xl max-h-[600px] object-contain border-4 border-white" 
                />
              </div>
            )}

            {/* BLOQUE DE TERMINAL/CONSOLA JS */}
            {block.type === 'terminal' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Code className="w-4 h-4" />
                  </div>
                  <span>Práctica en vivo</span>
                </div>
                <Terminal codigoInicial={block.value} />
              </div>
            )}

          </div>
        ))}
      </div>

      {/* Jitsi (Sala en vivo) */}
      {lesson.jitsi_room_name && (
        <div className="pt-10">
          <Card className="border-none shadow-elevated bg-slate-900 text-white overflow-hidden">
            <CardContent className="p-0">
              {showJitsi ? (
                <div className="h-[600px]">
                  <JitsiMeet roomName={lesson.jitsi_room_name} />
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Video className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">¿Listo para el vivo?</h3>
                  <p className="text-slate-400 mb-6 max-w-sm mx-auto">
                    Tu profesor inició una sala de consulta. Únete para participar de la videollamada.
                  </p>
                  <Button 
                    onClick={() => setShowJitsi(true)} 
                    className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-8"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" /> Entrar ahora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer final */}
      <div className="pt-10 flex items-center justify-between border-t border-slate-100">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-slate-900">
          Volver al curso
        </Button>
        <p className="text-xs font-bold text-slate-300 uppercase tracking-tighter">
          Plataforma CAPOL • Material Educativo
        </p>
      </div>
    </div>
  );
};

export default LessonContent;