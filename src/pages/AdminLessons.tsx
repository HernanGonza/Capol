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
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Video,
  Trash2,
  Type,
  Code,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

// Definición de tipos de bloques
const BLOCK_TYPES = [
  { id: "text", label: "Texto / MD", icon: Type },
  { id: "video", label: "Video URL", icon: Video },
  { id: "image", label: "Imagen URL", icon: ImageIcon },
  { id: "terminal", label: "Consola JS", icon: Code },
];

const AdminLessons = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Estados del Editor
  const [blocks, setBlocks] = useState<any[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
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
        course_id: courseId!,
      };

      if (editingLessonId) {
        const { error } = await supabase
          .from("lessons")
          .update(lessonData)
          .eq("id", editingLessonId);
        if (error) throw error;
      } else {
        const order = lessons?.length || 0;
        const { error } = await supabase
          .from("lessons")
          .insert({ ...lessonData, lesson_order: order });
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
    setEditingLessonId(null);
  };

  const addBlock = (type: string) => {
    const newBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: "",
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, value: string) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, value } : b)));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [
      newBlocks[targetIndex],
      newBlocks[index],
    ];
    setBlocks(newBlocks);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Clases</h1>
            <p className="text-muted-foreground text-sm">Arma tu clase usando bloques interactivos</p>
          </div>
          <Button onClick={() => { resetEditor(); setOpen(true); }} className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" /> Nueva Clase
          </Button>
        </div>

        {/* Modal Editor */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLessonId ? "Editar Clase" : "Crear Nueva Clase"}</DialogTitle>
              <DialogDescription>
                Agrega bloques de texto, video o código para construir la lección.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Título</Label>
                <Input
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Ej: Introducción a React"
                />
              </div>

              <div className="space-y-4">
                <div className="min-h-[300px] border-2 border-dashed rounded-2xl p-4 bg-slate-50/50 space-y-4">
                  {blocks.map((block, index) => {
                    const blockType = BLOCK_TYPES.find((t) => t.id === block.type);
                    const Icon = blockType?.icon || Type;

                    return (
                      <div key={block.id} className="group bg-white border rounded-xl p-4 flex gap-4 items-start shadow-sm">
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => moveBlock(index, "up")} className="h-6 w-6"><ArrowUp className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => moveBlock(index, "down")} className="h-6 w-6"><ArrowDown className="w-3 h-3" /></Button>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground">{block.type}</span>
                          </div>

                          {block.type === "text" && (
                            <Textarea
                              value={block.value}
                              onChange={(e) => updateBlock(block.id, e.target.value)}
                              placeholder="Escribe contenido o Markdown..."
                              className="min-h-[120px]"
                            />
                          )}
                          {(block.type === "video" || block.type === "image") && (
                            <Input
                              value={block.value}
                              onChange={(e) => updateBlock(block.id, e.target.value)}
                              placeholder="Pega la URL aquí..."
                            />
                          )}
                          {block.type === "terminal" && (
                            <Textarea
                              value={block.value}
                              onChange={(e) => updateBlock(block.id, e.target.value)}
                              placeholder="// Escribe el código inicial..."
                              className="font-mono text-sm bg-slate-900 text-emerald-400 min-h-[150px]"
                            />
                          )}
                        </div>

                        <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)} className="text-destructive hover:bg-destructive/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}

                  {blocks.length === 0 && (
                    <div className="h-40 flex items-center justify-center text-muted-foreground italic text-sm">
                      Aún no has agregado bloques de contenido.
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap gap-2 justify-center p-4 bg-white border rounded-xl sticky bottom-0 shadow-sm">
                  {BLOCK_TYPES.map((type) => {
                    const BtnIcon = type.icon;
                    return (
                      <Button key={type.id} variant="outline" size="sm" onClick={() => addBlock(type.id)} className="rounded-full">
                        <BtnIcon className="w-3.5 h-3.5 mr-2" /> {type.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={() => saveMutation.mutate()}
                className="w-full h-12 gradient-primary text-white font-bold"
                disabled={!lessonTitle || blocks.length === 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? "Guardando..." : "Guardar Lección"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Lista de Lecciones Existentes */}
        <div className="grid gap-3">
          {isLoading ? (
            <p>Cargando clases...</p>
          ) : (
            lessons?.map((lesson, idx) => {
              let blocksCount = 0;
              try {
                const parsed = JSON.parse(lesson.content || "[]");
                blocksCount = Array.isArray(parsed) ? parsed.length : 0;
              } catch (e) {
                blocksCount = lesson.content ? 1 : 0;
              }

              return (
                <Card
                  key={lesson.id}
                  className="group hover:border-primary/50 transition-all cursor-pointer shadow-card"
                  onClick={() => {
                    setEditingLessonId(lesson.id);
                    setLessonTitle(lesson.title);
                    try {
                      const parsed = JSON.parse(lesson.content || "[]");
                      setBlocks(Array.isArray(parsed) ? parsed : [{ id: "1", type: "text", value: lesson.content }]);
                    } catch (e) {
                      setBlocks([{ id: "1", type: "text", value: lesson.content || "" }]);
                    }
                    setOpen(true);
                  }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{lesson.title}</h3>
                        <p className="text-xs text-muted-foreground">{blocksCount} bloque(s) de contenido</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      Editar Clase
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminLessons;