import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, CheckCircle, Play, Video, Calendar, ChevronRight } from "lucide-react";
import { useState } from "react";
import LessonContent from "@/components/student/LessonContent";

const CourseView = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId!)
        .order("lesson_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["lesson-progress", user?.id, courseId],
    queryFn: async () => {
      if (!lessons) return [];
      const { data, error } = await supabase
        .from("lesson_progress")
        .select("*")
        .eq("user_id", user!.id)
        .in("lesson_id", lessons.map((l) => l.id));
      if (error) throw error;
      return data;
    },
    enabled: !!lessons && !!user,
  });

  const isLessonUnlocked = (lesson: any) => {
    if (!lesson.unlock_date) return true;
    return new Date(lesson.unlock_date) <= new Date();
  };

  const isLessonCompleted = (lessonId: string) => {
    return progress?.some((p) => p.lesson_id === lessonId && p.completed);
  };

  const selectedLesson = lessons?.find((l) => l.id === selectedLessonId);

  if (selectedLesson) {
    return (
      <AppLayout>
        <LessonContent
          lesson={selectedLesson}
          onBack={() => setSelectedLessonId(null)}
          userId={user!.id}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">{course?.title}</h1>
          <p className="text-muted-foreground">{course?.description}</p>
        </div>

        <div className="space-y-3">
          {lessons?.map((lesson, index) => {
            const unlocked = isLessonUnlocked(lesson);
            const completed = isLessonCompleted(lesson.id);

            return (
              <Card
                key={lesson.id}
                className={`shadow-card transition-all ${
                  unlocked ? "hover:shadow-elevated cursor-pointer hover:-translate-y-0.5" : "opacity-60"
                }`}
                onClick={() => unlocked && setSelectedLessonId(lesson.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono text-sm font-bold ${
                    completed
                      ? "bg-success/10 text-success"
                      : unlocked
                      ? "gradient-primary text-primary-foreground"
                      : "bg-muted text-locked"
                  }`}>
                    {completed ? <CheckCircle className="w-5 h-5" /> : unlocked ? index + 1 : <Lock className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold truncate ${!unlocked && "text-locked"}`}>{lesson.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {lesson.video_url && (
                        <span className="flex items-center gap-1"><Video className="w-3 h-3" /> Video</span>
                      )}
                      {lesson.unlock_date && !unlocked && (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Disponible: {lesson.unlock_date}</span>
                      )}
                      {completed && <span className="text-success">Completada</span>}
                    </div>
                  </div>
                  {unlocked && <ChevronRight className="w-5 h-5 text-muted-foreground" />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default CourseView;
