import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle,
  Video,
  Trophy,
  ExternalLink,
  Clock,
  FileDown,
  PlayCircle,
  UploadCloud,
  Link2,
  Lock,
  FileCheck2,
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
  isLastLesson?: boolean;
}

// Convierte un link de Google Drive (de cualquier formato habitual) en la URL
// embebible que se puede mostrar dentro de un iframe.
const getDriveEmbedUrl = (url: string): string | null => {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://drive.google.com/file/d/${match[1]}/preview`;
};

const LessonContent = ({ lesson, onBack, userId, courseTitle, isPreview, isLastLesson }: Props) => {
  const queryClient = useQueryClient();
  const [showJitsi, setShowJitsi] = useState(false);
  const [showRecording, setShowRecording] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submissionTab, setSubmissionTab] = useState<"link" | "archivo">("link");
  const [linkValue, setLinkValue] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const exportToPdf = async () => {
    setExporting(true);
    try {
      // Carga diferida: son librerías pesadas que solo hacen falta si se exporta un PDF.
      // Generamos el PDF con @react-pdf/renderer: texto vectorial real (no una captura
      // de pantalla), con fuentes propias embebidas (Helvetica, que soporta tildes/ñ/¿/¡
      // sin problemas) y soporte real de negrita/cursiva dentro del texto en Markdown.
      const [{ pdf: buildPdf }, { default: LessonPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/LessonPdfDocument"),
      ]);

      const blob = await buildPdf(
        <LessonPdfDocument
          lessonTitle={lesson.titulo}
          lessonDescription={lesson.descripcion}
          content={lesson.content}
        />
      ).toBlob();

      const safeTitle = lesson.titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 -]/g, "");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("PDF descargado");
    } catch (e) {
      console.error("Error exportando PDF:", e);
      toast.error("No se pudo exportar el PDF. Si el problema sigue, avisale a soporte.");
    } finally {
      setExporting(false);
    }
  };

  const isClassOver = !!lesson.fecha_fin_clase && new Date(lesson.fecha_fin_clase) <= new Date();
  const driveEmbedUrl = lesson.grabacion_url ? getDriveEmbedUrl(lesson.grabacion_url) : null;

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

  // Esta es la última clase configurada del curso: hay que entregar un
  // trabajo final (archivo o link) antes de poder marcarla como completada.
  const { data: entrega, isLoading: loadingEntrega } = useQuery({
    queryKey: ["trabajo-final", lesson.id, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("entregas_trabajo_final")
        .select("*")
        .eq("leccion_id", lesson.id)
        .eq("usuario_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!isLastLesson,
  });

  // El archivo se guarda en un bucket privado — para poder verlo/descargarlo
  // hace falta armar una URL firmada (con expiración) cada vez, no una pública.
  const { data: entregaFileUrl } = useQuery({
    queryKey: ["trabajo-final-file-url", entrega?.url],
    queryFn: async () => {
      const { data } = await supabase.storage.from("trabajos-finales").createSignedUrl(entrega!.url, 3600);
      return data?.signedUrl || null;
    },
    enabled: !!entrega && entrega.tipo === "archivo",
  });

  const submitFinalMutation = useMutation({
    mutationFn: async () => {
      let url = linkValue.trim();
      let nombre_archivo: string | null = null;

      if (submissionTab === "archivo") {
        if (!file) throw new Error("Elegí un archivo para subir");
        const path = `${userId}/${lesson.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("trabajos-finales").upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        url = path;
        nombre_archivo = file.name;
      } else {
        if (!url || !/^https?:\/\/.+/i.test(url)) throw new Error("Pegá un link válido (tiene que empezar con http:// o https://)");
      }

      const { error } = await supabase.from("entregas_trabajo_final").upsert({
        leccion_id: lesson.id,
        usuario_id: userId,
        tipo: submissionTab,
        url,
        nombre_archivo,
      }, { onConflict: "leccion_id,usuario_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trabajo-final", lesson.id, userId] });
      setFile(null);
      setLinkValue("");
      toast.success("¡Trabajo final entregado! Ya podés marcar la clase como completada.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const requiresSubmission = !!isLastLesson && !entrega;

  return (
    <div className={`max-w-5xl mx-auto space-y-12 animate-fade-in pb-24 px-4 transition-all duration-1000 ${isCompleted ? 'ring-2 ring-emerald-500/20 rounded-[3rem] bg-emerald-50/5 p-8' : ''}`}>
      
      {/* HEADER LIMPIO */}
      <div className="flex flex-col gap-5 border-b pb-8">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-2xl shadow-sm shrink-0 h-12 w-12">
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-foreground leading-tight">
                {lesson.titulo}
              </h1>
              {isCompleted && (
                <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-bounce">
                  <CheckCircle className="w-3 h-3" /> Completada
                </div>
              )}
            </div>
            <p className="text-muted-foreground font-medium text-lg mt-1">{lesson.descripcion || "Material de estudio"}</p>
          </div>
          <Button
            variant="outline"
            onClick={exportToPdf}
            disabled={exporting}
            className="rounded-2xl shrink-0 font-bold"
            title="Descarga el material de esta clase en PDF (el video embebido y la consola interactiva quedan como un link/nota, no se pueden incluir tal cual)"
          >
            <FileDown className="w-4 h-4 mr-2" />
            {exporting ? "Generando..." : "Exportar PDF"}
          </Button>
        </div>
      </div>

      {/* TODOS LOS BLOQUES DINÁMICOS */}
      <LessonBlocks content={lesson.content} />

      {/* CLASE EN VIVO O GRABACIÓN */}
      {isClassOver ? (
        lesson.grabacion_url ? (
          <div className="pt-16">
            <Card className="border-none shadow-elevated bg-slate-900 text-white overflow-hidden rounded-[3rem]">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/20 rounded-xl"><Video className="w-6 h-6 text-primary" /></div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">Grabación de la Clase</h3>
                    <p className="text-white/50 text-sm">Esta clase ya finalizó, pero podés repasarla cuando quieras.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => setShowRecording(true)} className="bg-white text-slate-900 font-black hover:bg-white/90">
                    <PlayCircle className="w-5 h-5 mr-2" /> Ver Grabación
                  </Button>
                  <a href={lesson.grabacion_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="bg-transparent border-white/20 text-white hover:bg-white hover:text-black">
                      <ExternalLink className="w-4 h-4 mr-2" /> Abrir en Drive
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : lesson.sala_jitsi ? (
          <div className="pt-16">
            <Card className="border-none shadow-elevated bg-slate-900 text-white overflow-hidden rounded-[3rem]">
              <CardContent className="text-center py-20 px-10 space-y-4">
                <Clock className="w-16 h-16 text-primary mx-auto" />
                <h3 className="text-3xl font-black tracking-tighter">Clase Finalizada</h3>
                <p className="text-white/50 max-w-md mx-auto">
                  Esta clase ya terminó. El profesor todavía no subió la grabación — volvé a revisar más tarde.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : null
      ) : (
        lesson.sala_jitsi && (
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
        )
      )}

      {/* TRABAJO FINAL: solo en la última clase configurada del curso, y hasta que el profesor la apruebe */}
      {isLastLesson && !isPreview && !isCompleted && (
        <div className="pt-16">
          <Card className="border-2 border-primary/20 shadow-elevated rounded-[2rem] overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl"><FileCheck2 className="w-6 h-6 text-primary" /></div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">Trabajo Final</h3>
                  <p className="text-muted-foreground text-sm">Esta es la última clase del curso — subí tu entrega para poder completarla.</p>
                </div>
              </div>

              {entrega && (
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Ya entregaste tu trabajo final</p>
                    <a
                      href={entrega.tipo === "link" ? entrega.url : (entregaFileUrl || "#")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 dark:text-emerald-400 underline break-all"
                    >
                      {entrega.tipo === "link" ? entrega.url : entrega.nombre_archivo}
                    </a>
                  </div>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); submitFinalMutation.mutate(); }} className="space-y-4">
                <div className="flex gap-2">
                  <Button type="button" variant={submissionTab === "link" ? "default" : "outline"} size="sm" onClick={() => setSubmissionTab("link")}>
                    <Link2 className="w-4 h-4 mr-2" /> Link
                  </Button>
                  <Button type="button" variant={submissionTab === "archivo" ? "default" : "outline"} size="sm" onClick={() => setSubmissionTab("archivo")}>
                    <UploadCloud className="w-4 h-4 mr-2" /> Subir archivo
                  </Button>
                </div>

                {submissionTab === "link" ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Link de GitHub o de tu página</Label>
                    <Input type="url" placeholder="https://github.com/..." value={linkValue} onChange={(e) => setLinkValue(e.target.value)} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Archivo</Label>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-semibold hover:file:bg-primary/90"
                    />
                  </div>
                )}

                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={submitFinalMutation.isPending}>
                  {submitFinalMutation.isPending ? "Enviando..." : entrega ? "Reemplazar entrega" : "Entregar trabajo final"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal con la grabación embebida de Drive */}
      <Dialog open={showRecording} onOpenChange={setShowRecording}>
        <DialogContent className="sm:max-w-4xl bg-black border-white/10 p-2">
          {driveEmbedUrl ? (
            <iframe
              src={driveEmbedUrl}
              className="w-full aspect-video rounded-xl"
              allow="autoplay"
              allowFullScreen
            />
          ) : (
            <div className="p-10 text-center text-white space-y-3">
              <p>No pudimos mostrar la grabación acá adentro.</p>
              {lesson.grabacion_url && (
                <a href={lesson.grabacion_url} target="_blank" rel="noopener noreferrer" className="underline text-primary">
                  Abrir en Google Drive
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BOTÓN FINAL DE COMPLETADO */}
      <div className="pt-16 mt-20 border-t border-border space-y-10">
        {isPreview ? (
          <div className="bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-100 dark:border-indigo-900 rounded-[2.5rem] p-10 text-center space-y-2">
            <p className="text-indigo-700 dark:text-indigo-400 font-bold">Estás en modo vista previa: así es como un alumno ve esta clase.</p>
          </div>
        ) : isLastLesson && !isCompleted ? (
          // La última clase no se auto-completa: la aprueba el profesor después de
          // revisar el trabajo final entregado (ver tarjeta "Trabajo Final" arriba).
          <div className="bg-slate-900 rounded-[2.5rem] p-10 text-center space-y-4">
            {requiresSubmission ? (
              <>
                <Lock className="w-12 h-12 text-amber-400 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Todavía falta tu entrega</h3>
                  <p className="text-slate-400 font-medium max-w-md mx-auto">
                    Subí tu trabajo final más arriba para que tu profesor lo pueda corregir.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Clock className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white tracking-tight">Tu profesor va a corregir tu trabajo final</h3>
                  <p className="text-slate-400 font-medium max-w-md mx-auto">
                    Te vamos a avisar cuando lo apruebe — ahí la clase va a quedar completada automáticamente.
                  </p>
                </div>
              </>
            )}
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
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-100 dark:border-emerald-900 rounded-[2.5rem] p-10 text-center space-y-4 animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-emerald-900 dark:text-emerald-300 tracking-tight">¡Lección Dominada!</h3>
            <p className="text-emerald-700 dark:text-emerald-400 font-medium max-w-md mx-auto">Ya completaste este contenido. ¡Buen trabajo!</p>
          </div>
        )}

        <div className="flex items-center justify-between opacity-60">
          <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground font-bold">
            <ArrowLeft className="w-5 h-5 mr-2" /> Volver al Programa
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LessonContent;