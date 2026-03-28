import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Video, MessageSquare } from "lucide-react";
import JitsiMeet from "@/components/JitsiMeet";
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
      queryClient.invalidateQueries({ queryKey: ["lesson-progress"] });
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{lesson.title}</h1>
          <p className="text-muted-foreground">{lesson.description}</p>
        </div>
      </div>

      {/* Video */}
      {lesson.video_url && (
        <Card className="overflow-hidden shadow-card">
          <div className="aspect-video">
            <iframe
              src={getEmbedUrl(lesson.video_url)}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        </Card>
      )}

      {/* Content */}
      {lesson.content && (
        <Card className="shadow-card">
          <CardContent className="p-6 prose prose-sm max-w-none">
            <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
          </CardContent>
        </Card>
      )}

      {/* Jitsi */}
      {lesson.jitsi_room_name && (
        <Card className="shadow-card">
          <CardContent className="p-6">
            {showJitsi ? (
              <JitsiMeet roomName={lesson.jitsi_room_name} />
            ) : (
              <div className="text-center py-6">
                <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold mb-2">Videollamada en vivo</h3>
                <p className="text-sm text-muted-foreground mb-4">Únete a la clase en vivo con tu profesor</p>
                <Button onClick={() => setShowJitsi(true)} className="gradient-accent text-accent-foreground">
                  <Video className="w-4 h-4 mr-2" /> Unirse a la llamada
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Complete button */}
      <div className="flex justify-end">
        <Button onClick={() => completeMutation.mutate()} className="gradient-primary text-primary-foreground" disabled={completeMutation.isPending}>
          <CheckCircle className="w-4 h-4 mr-2" />
          {completeMutation.isPending ? "Marcando..." : "Marcar como completada"}
        </Button>
      </div>
    </div>
  );
};

export default LessonContent;
