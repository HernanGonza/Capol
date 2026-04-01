import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Video,
  Trash2,
  Type,
  Code,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Info,
  HelpCircle,
  Download,
  FileCode,
  CheckSquare,
  GitCompare,
  Calendar,
  LockOpen
} from "lucide-react";

const BLOCK_TYPES = [
  { id: "text", label: "Texto / MD", icon: Type },
  { id: "video", label: "Video URL", icon: Video },
  { id: "image", label: "Imagen URL", icon: ImageIcon },
  { id: "terminal", label: "Consola JS", icon: Code },
  { id: "callout", label: "Nota / Tip", icon: Info },
  { id: "quiz", label: "Mini Quiz", icon: HelpCircle },
  { id: "download", label: "Recurso", icon: Download },
  { id: "snippet", label: "Snippet", icon: FileCode },
  { id: "checklist", label: "Checklist", icon: CheckSquare },
  { id: "diff", label: "Comparación", icon: GitCompare },
];

const AdminLessons = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // ESTADOS DEL EDITOR
  const [blocks, setBlocks] = useState<any[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [unlockDate, setUnlockDate] = useState(""); 
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["lessons", courseId],
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lessonData = {
        title: lessonTitle,
        content: JSON.stringify(blocks),
        unlock_date: unlockDate || null,
        course_id: courseId!,
      };

      if (editingLessonId) {
        const { error } = await supabase.from("lessons").update(lessonData).eq("id", editingLessonId);
        if (error) throw error;
      } else {
        const order = lessons?.length || 0;
        const { error } = await supabase.from("lessons").insert({ ...lessonData, lesson_order: order });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons", courseId] });
      toast.success("Clase guardada correctamente");
      setOpen(false);
      resetEditor();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetEditor = () => {
    setBlocks([]);
    setLessonTitle("");
    setUnlockDate(""); 
    setEditingLessonId(null);
  };

  const addBlock = (type: string) => {
    const newBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: "",
      ...(type === 'callout' && { style: 'info' }),
      ...(type === 'quiz' && { a: '', b: '', correct: 'A' }),
      ...(type === 'diff' && { oldValue: '', newValue: '' }),
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, value: string, extraData = {}) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, value, ...extraData } : b)));
  };

  const removeBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  // Función para determinar si la fecha de desbloqueo ya pasó
  const isDatePassed = (dateString: string) => {
    const unlockDateObj = new Date(dateString);
    const now = new Date();
    // Normalizamos a solo fecha para comparar días
    now.setHours(0, 0, 0, 0);
    unlockDateObj.setHours(0, 0, 0, 0);
    return now >= unlockDateObj;
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter">Gestión de Clases</h1>
            <p className="text-muted-foreground text-sm">Arma tu clase usando bloques interactivos</p>
          </div>
          <Button onClick={() => { resetEditor(); setOpen(true); }} className="gradient-primary text-white font-bold">
            <Plus className="w-4 h-4 mr-2" /> Nueva Clase
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-none shadow-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">{editingLessonId ? "Editar Clase" : "Crear Nueva Clase"}</DialogTitle>
              <DialogDescription>Configura el acceso y el contenido de la lección.</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Título de la clase</Label>
                  <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Ej: Introducción a Props" className="font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Fecha de Desbloqueo (Opcional)
                  </Label>
                  <Input 
                    type="date" 
                    value={unlockDate ? unlockDate.split('T')[0] : ""} 
                    onChange={(e) => setUnlockDate(e.target.value)} 
                    className="font-medium"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="min-h-[350px] border-2 border-dashed rounded-3xl p-6 bg-slate-50/50 space-y-4">
                  {blocks.map((block, index) => {
                    const blockType = BLOCK_TYPES.find((t) => t.id === block.type);
                    const Icon = blockType?.icon || Type;

                    return (
                      <div key={block.id} className="group bg-white border rounded-2xl p-5 flex gap-4 items-start shadow-sm transition-all hover:shadow-md">
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" onClick={() => moveBlock(index, "up")} className="h-7 w-7"><ArrowUp className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => moveBlock(index, "down")} className="h-7 w-7"><ArrowDown className="w-4 h-4" /></Button>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-primary/10 rounded-lg"><Icon className="w-4 h-4 text-primary" /></div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{block.type}</span>
                          </div>

                          {block.type === "text" && <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Escribe aquí tu contenido (acepta HTML)..." className="min-h-[120px]" />}
                          
                          {(block.type === "video" || block.type === "image" || block.type === "download") && (
                            <Input value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Pega la URL del recurso aquí..." />
                          )}

                          {block.type === "terminal" && <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} className="font-mono bg-slate-900 text-emerald-400" placeholder="// Código JS inicial..." />}

                          {block.type === "callout" && (
                            <div className="space-y-2">
                              <Select value={block.style} onValueChange={(v) => updateBlock(block.id, block.value, { style: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="info">Info (Azul)</SelectItem>
                                  <SelectItem value="warning">Aviso (Amarillo)</SelectItem>
                                  <SelectItem value="tip">Tip (Verde)</SelectItem>
                                </SelectContent>
                              </Select>
                              <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Texto destacado..." />
                            </div>
                          )}

                          {block.type === "quiz" && (
                            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border">
                              <Input placeholder="Tu pregunta" value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} />
                              <div className="grid grid-cols-2 gap-2">
                                <Input placeholder="Opción A" value={block.a} onChange={(e) => updateBlock(block.id, block.value, { a: e.target.value })} />
                                <Input placeholder="Opción B" value={block.b} onChange={(e) => updateBlock(block.id, block.value, { b: e.target.value })} />
                              </div>
                              <Select value={block.correct} onValueChange={(v) => updateBlock(block.id, block.value, { correct: v })}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Correcta" /></SelectTrigger>
                                <SelectContent><SelectItem value="A">A es correcta</SelectItem><SelectItem value="B">B es correcta</SelectItem></SelectContent>
                              </Select>
                            </div>
                          )}

                          {block.type === "snippet" && <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} className="font-mono bg-slate-50 text-sm" placeholder="Código de solo lectura..." />}
                          
                          {block.type === "checklist" && (
                            <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Tarea 1&#10;Tarea 2..." />
                          )}

                          {block.type === "diff" && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1"><Label className="text-[10px] font-bold">ANTES</Label><Textarea value={block.oldValue} onChange={(e) => updateBlock(block.id, block.value, { oldValue: e.target.value })} className="font-mono text-xs bg-red-50/30" /></div>
                              <div className="space-y-1"><Label className="text-[10px] font-bold">DESPUÉS</Label><Textarea value={block.newValue} onChange={(e) => updateBlock(block.id, block.value, { newValue: e.target.value })} className="font-mono text-xs bg-emerald-50/30" /></div>
                            </div>
                          )}
                        </div>

                        <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 justify-center p-4 bg-white border rounded-2xl sticky bottom-0 shadow-lg z-50">
                  {BLOCK_TYPES.map((type) => (
                    <Button key={type.id} variant="outline" size="sm" onClick={() => addBlock(type.id)} className="rounded-full font-bold hover:bg-primary hover:text-white transition-all">
                      <type.icon className="w-3.5 h-3.5 mr-2" /> {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Button onClick={() => saveMutation.mutate()} className="w-full h-14 gradient-primary text-white font-black text-lg shadow-xl" disabled={!lessonTitle || blocks.length === 0 || saveMutation.isPending}>
                {saveMutation.isPending ? "GUARDANDO..." : "GUARDAR CLASE"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* LISTA DE CLASES CON LÓGICA DE FECHA DINÁMICA */}
        <div className="grid gap-4">
          {isLoading ? <p>Cargando lecciones...</p> : lessons?.map((lesson, idx) => {
            const unlocked = lesson.unlock_date ? isDatePassed(lesson.unlock_date) : true;

            return (
              <Card key={lesson.id} className="group hover:border-primary/50 transition-all cursor-pointer shadow-card" onClick={() => {
                setEditingLessonId(lesson.id);
                setLessonTitle(lesson.title);
                setUnlockDate(lesson.unlock_date || "");
                try { setBlocks(JSON.parse(lesson.content || "[]")); } catch (e) { setBlocks([]); }
                setOpen(true);
              }}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">{idx + 1}</div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg">{lesson.title}</h3>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">{JSON.parse(lesson.content || "[]").length} bloque(s)</p>
                        
                        {lesson.unlock_date && (
                          unlocked ? (
                            <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                              <LockOpen className="w-2.5 h-2.5" /> Clase desbloqueada
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">
                              <Calendar className="w-2.5 h-2.5" /> Desbloquea: {new Date(lesson.unlock_date).toLocaleDateString()}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 font-bold">EDITAR</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminLessons;