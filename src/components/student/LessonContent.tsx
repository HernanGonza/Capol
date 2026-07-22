import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  CheckCircle, 
  Video, 
  Trophy 
} from "lucide-react";
import JitsiMeet from "@/components/JitsiMeet";
import LessonBlocks from "@/components/LessonBlocks";
import { useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import confetti from "canvas-confetti";

type Lesson = Database["public"]["Tables"]["lecciones"]["Row"];

interface Props {
  lesson: Lesson;
  onBack: () => void;
  userId: string;
  courseTitle?: string;
  isPreview?: boolean;
}

const LessonContent = ({ lesson, onBack, userId, courseTitle, isPreview }: Props) => {
  const queryClient = useQueryClient();
  const [showJitsi, setShowJitsi] = useState(false);

  // 1. Consultar progreso para saber si ya está completada
  const { data: progress } = useQuery({
    queryKey: ["lesson-progress", lesson.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("progreso_lecciones")
        .select("*")
        .eq("leccion_id", lesson.id)
        .eq("usuario_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const isCompleted = !!progress?.completado;

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("progreso_lecciones").upsert({
        usuario_id: userId,
        leccion_id: lesson.id,
        completado: true,
        completado_en: new Date().toISOString(),
      }, { onConflict: "usuario_id,leccion_id" });
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
                {lesson.titulo}
              </h1>
              {isCompleted && (
                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-bounce">
                  <CheckCircle className="w-3 h-3" /> Completada
                </div>
              )}
            </div>
            <p className="text-muted-foreground font-medium text-lg mt-1">{lesson.descripcion || "Material de estudio"}</p>
          </div>
        </div>
      </div>

      {/* TODOS LOS BLOQUES DINÁMICOS */}
      <LessonBlocks content={lesson.content} />

      {/* JITSI */}
      {lesson.sala_jitsi && (
        <div className="pt-16">
          <Card className="border-none shadow-elevated bg-slate-900 text-white overflow-hidden rounded-[3rem]">
            <CardContent className="p-0">
              {showJitsi ? (
                <div className="h-[700px]">
                  <JitsiMeet 
                    roomName={lesson.sala_jitsi}
                    courseTitle={courseTitle}
                    lessonTitle={lesson.titulo}
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
        {isPreview ? (
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem] p-10 text-center space-y-2">
            <p className="text-indigo-700 font-bold">Estás en modo vista previa: así es como un alumno ve esta clase.</p>
          </div>
        ) : !isCompleted ? (
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