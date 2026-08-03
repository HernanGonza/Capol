import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Eye,
  Upload,
} from "lucide-react";
import LessonBlocks from "@/components/LessonBlocks";
import { compressImageToWebP } from "@/lib/imageCompression";

const BLOCK_TYPES = [
  { id: "text", label: "Texto (Markdown)", icon: Type },
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

// Las clases creadas antes de este formato pueden tener un quiz de una sola
// pregunta (value/a/b/correct) o un checklist como texto con saltos de línea
// (value). Los convertimos al formato nuevo (arrays) al abrir el editor,
// así "+ Agregar pregunta" / "+ Agregar ítem" funcionan de entrada.
const normalizeBlocks = (rawBlocks: any[]) =>
  rawBlocks.map((b) => {
    if (b.type === "quiz" && !Array.isArray(b.preguntas)) {
      return {
        ...b,
        preguntas: b.value
          ? [{ id: Math.random().toString(36).substr(2, 9), pregunta: b.value, opciones: [b.a || "", b.b || ""], correcta: b.correct === "B" ? 1 : 0 }]
          : [{ id: Math.random().toString(36).substr(2, 9), pregunta: "", opciones: ["", ""], correcta: 0 }],
      };
    }
    if (b.type === "checklist" && !Array.isArray(b.items)) {
      const items = typeof b.value === "string" ? b.value.split("\n").filter((t: string) => t.trim() !== "") : [];
      return { ...b, items: items.length > 0 ? items : [""] };
    }
    return b;
  });

interface LessonEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  lesson?: any | null;
  nextOrder: number;
  onSaved: () => void;
}

// Editor de contenido de una clase (bloques + configuración de acceso/video llamada).
// Se usa tanto desde la gestión de cursos del admin como desde "Gestionar Clases"
// del profesor — antes el profesor tenía que salir a una pantalla aparte
// (/admin/courses/:id/lessons) para esto y perdía el contexto de su propia lista.
const LessonEditorDialog = ({ open, onOpenChange, courseId, lesson, nextOrder, onSaved }: LessonEditorDialogProps) => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [classEndDate, setClassEndDate] = useState("");
  const [salaJitsi, setSalaJitsi] = useState("");
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (lesson) {
      setEditingLessonId(lesson.id);
      setLessonTitle(lesson.titulo);
      setUnlockDate(lesson.fecha_desbloqueo || "");
      setClassEndDate(lesson.fecha_fin_clase ? lesson.fecha_fin_clase.slice(0, 16) : "");
      setSalaJitsi(lesson.sala_jitsi || "");
      try { setBlocks(normalizeBlocks(JSON.parse(lesson.content || "[]"))); } catch (e) { setBlocks([]); }
    } else {
      setEditingLessonId(null);
      setLessonTitle("");
      setUnlockDate("");
      setClassEndDate("");
      setSalaJitsi("");
      setBlocks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lesson?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const lessonData = {
        titulo: lessonTitle,
        content: JSON.stringify(blocks),
        fecha_desbloqueo: unlockDate || null,
        fecha_fin_clase: classEndDate || null,
        sala_jitsi: salaJitsi.trim() || null,
        curso_id: courseId,
      };

      if (editingLessonId) {
        const { error } = await supabase.from("lecciones").update(lessonData).eq("id", editingLessonId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lecciones").insert({ ...lessonData, orden: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Clase guardada correctamente");
      onOpenChange(false);
      onSaved();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addBlock = (type: string) => {
    const newBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: "",
      ...(type === 'callout' && { style: 'info' }),
      ...(type === 'quiz' && { preguntas: [{ id: Math.random().toString(36).substr(2, 9), pregunta: '', opciones: ['', ''], correcta: 0 }] }),
      ...(type === 'checklist' && { items: [''] }),
      ...(type === 'diff' && { oldValue: '', newValue: '' }),
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, value: string, extraData = {}) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, value, ...extraData } : b)));
  };

  // Adjuntar un archivo real (PDF, ZIP, etc.) a un bloque "Recurso", en vez
  // de depender de que alguien pegue un link externo. Precarga el nombre a
  // mostrar con el nombre del archivo si todavía no se escribió uno.
  const handleResourceUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Máximo 20MB"); return; }
    setUploadingBlockId(blockId);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("lesson-resources").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("lesson-resources").getPublicUrl(path);
      const current = blocks.find((b) => b.id === blockId);
      updateBlock(blockId, publicUrl, { label: current?.label || file.name });
      toast.success("Archivo subido");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingBlockId(null);
      e.target.value = "";
    }
  };

  // Igual que arriba pero para el bloque "Imagen" — se comprime a WebP antes
  // de subir, mismo criterio que ya se usa para los flyers de curso.
  const handleImageBlockUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Solo imágenes"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    setUploadingBlockId(blockId);
    try {
      const compressed = await compressImageToWebP(file);
      const path = `${courseId}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from("lesson-resources").upload(path, compressed, { cacheControl: "31536000" });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("lesson-resources").getPublicUrl(path);
      updateBlock(blockId, publicUrl);
      toast.success("Imagen subida");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingBlockId(null);
      e.target.value = "";
    }
  };

  // Helper genérico para los bloques con estructura interna más compleja (quiz, checklist)
  const patchBlock = (id: string, updater: (b: any) => any) => {
    setBlocks(blocks.map((b) => (b.id === id ? updater(b) : b)));
  };

  // --- QUIZ: varias preguntas, cada una con varias opciones ---
  const addPregunta = (blockId: string) => {
    patchBlock(blockId, (b) => ({
      ...b,
      preguntas: [...b.preguntas, { id: Math.random().toString(36).substr(2, 9), pregunta: '', opciones: ['', ''], correcta: 0 }],
    }));
  };

  const removePregunta = (blockId: string, preguntaId: string) => {
    patchBlock(blockId, (b) => ({ ...b, preguntas: b.preguntas.filter((p: any) => p.id !== preguntaId) }));
  };

  const updatePregunta = (blockId: string, preguntaId: string, patch: any) => {
    patchBlock(blockId, (b) => ({
      ...b,
      preguntas: b.preguntas.map((p: any) => (p.id === preguntaId ? { ...p, ...patch } : p)),
    }));
  };

  const addOpcion = (blockId: string, preguntaId: string) => {
    patchBlock(blockId, (b) => ({
      ...b,
      preguntas: b.preguntas.map((p: any) => (p.id === preguntaId ? { ...p, opciones: [...p.opciones, ''] } : p)),
    }));
  };

  const removeOpcion = (blockId: string, preguntaId: string, index: number) => {
    patchBlock(blockId, (b) => ({
      ...b,
      preguntas: b.preguntas.map((p: any) => {
        if (p.id !== preguntaId || p.opciones.length <= 2) return p;
        const opciones = p.opciones.filter((_: string, i: number) => i !== index);
        // Si borramos la opción marcada como correcta, la correcta pasa a ser la primera.
        const correcta = p.correcta === index ? 0 : p.correcta > index ? p.correcta - 1 : p.correcta;
        return { ...p, opciones, correcta };
      }),
    }));
  };

  const updateOpcion = (blockId: string, preguntaId: string, index: number, value: string) => {
    patchBlock(blockId, (b) => ({
      ...b,
      preguntas: b.preguntas.map((p: any) =>
        p.id === preguntaId ? { ...p, opciones: p.opciones.map((o: string, i: number) => (i === index ? value : o)) } : p
      ),
    }));
  };

  // --- CHECKLIST: lista de ítems ---
  const addChecklistItem = (blockId: string) => {
    patchBlock(blockId, (b) => ({ ...b, items: [...b.items, ''] }));
  };

  const removeChecklistItem = (blockId: string, index: number) => {
    patchBlock(blockId, (b) => (b.items.length <= 1 ? b : { ...b, items: b.items.filter((_: string, i: number) => i !== index) }));
  };

  const updateChecklistItem = (blockId: string, index: number, value: string) => {
    patchBlock(blockId, (b) => ({ ...b, items: b.items.map((t: string, i: number) => (i === index ? value : t)) }));
  };

  const removeBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));

  const moveBlock = (index: number, direction: "up" | "down") => {
    const newBlocks = [...blocks];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl xl:max-w-7xl max-h-[90vh] overflow-y-auto border-none shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">{editingLessonId ? "Editar Clase" : "Crear Nueva Clase"}</DialogTitle>
          <DialogDescription>Configura el acceso y el contenido de la lección.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">Título de la clase</Label>
              <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="Ej: Introducción a Props" className="font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Fecha de Desbloqueo (Opcional)
              </Label>
              <Input
                type="date"
                value={unlockDate ? unlockDate.split('T')[0] : ""}
                onChange={(e) => setUnlockDate(e.target.value)}
                className="font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Fecha de Fin de Clase (Opcional)
              </Label>
              <Input
                type="datetime-local"
                value={classEndDate}
                onChange={(e) => setClassEndDate(e.target.value)}
                className="font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Después de esta fecha se oculta la video llamada y se puede subir la grabación.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                <Video className="w-3 h-3" /> Nombre de la Video Llamada (Opcional)
              </Label>
              <Input
                value={salaJitsi}
                onChange={(e) => setSalaJitsi(e.target.value)}
                placeholder="Ej: Clase de los Martes"
                className="font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Con este nombre se genera el link de la video llamada en Jitsi. Si lo dejás vacío, se arma uno automático con el curso y la clase.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <div className="min-h-[350px] border-2 border-dashed rounded-3xl p-6 bg-muted/50 space-y-4">
              {blocks.map((block, index) => {
                const blockType = BLOCK_TYPES.find((t) => t.id === block.type);
                const Icon = blockType?.icon || Type;

                return (
                  <div key={block.id} className="group bg-card border rounded-2xl p-5 flex gap-4 items-start shadow-sm transition-all hover:shadow-md">
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" size="icon" onClick={() => moveBlock(index, "up")} className="h-7 w-7"><ArrowUp className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => moveBlock(index, "down")} className="h-7 w-7"><ArrowDown className="w-4 h-4" /></Button>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg"><Icon className="w-4 h-4 text-primary" /></div>
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{block.type}</span>
                      </div>

                      {block.type === "text" && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground">
                            Se escribe en Markdown: **negrita**, # Título, - lista, [link](url), etc. Mirá el resultado en la vista previa de la derecha →
                          </p>
                          <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder={"Ej:\n# Título de la sección\n\nUn párrafo con **negrita** y _cursiva_.\n\n- Punto uno\n- Punto dos"} className="min-h-[120px] font-mono text-sm" />
                        </div>
                      )}

                      {block.type === "video" && (
                        <Input value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Pega la URL del video aquí..." />
                      )}

                      {block.type === "image" && (
                        <div className="space-y-2">
                          <Input value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Pegá la URL de una imagen o subí un archivo abajo..." />
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id={`img-upload-${block.id}`}
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageBlockUpload(e, block.id)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingBlockId === block.id}
                              onClick={() => document.getElementById(`img-upload-${block.id}`)?.click()}
                            >
                              <Upload className="w-3.5 h-3.5 mr-2" />
                              {uploadingBlockId === block.id ? "Subiendo..." : "Subir imagen"}
                            </Button>
                            <p className="text-[10px] text-muted-foreground">hasta 10MB</p>
                          </div>
                        </div>
                      )}

                      {block.type === "download" && (
                        <div className="space-y-2">
                          <Input value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} placeholder="Pegá una URL externa (Drive, etc.) o subí un archivo abajo..." />
                          <Input
                            placeholder="Nombre a mostrar (ej: Guía de instalación.pdf)"
                            value={block.label || ""}
                            onChange={(e) => updateBlock(block.id, block.value, { label: e.target.value })}
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id={`file-upload-${block.id}`}
                              className="hidden"
                              onChange={(e) => handleResourceUpload(e, block.id)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingBlockId === block.id}
                              onClick={() => document.getElementById(`file-upload-${block.id}`)?.click()}
                            >
                              <Upload className="w-3.5 h-3.5 mr-2" />
                              {uploadingBlockId === block.id ? "Subiendo..." : "Subir archivo"}
                            </Button>
                            <p className="text-[10px] text-muted-foreground">PDF, ZIP, Word, etc. hasta 20MB</p>
                          </div>
                        </div>
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
                        <div className="space-y-3">
                          {block.preguntas.map((pregunta: any, pIndex: number) => (
                            <div key={pregunta.id} className="space-y-2 bg-muted p-3 rounded-xl border">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-muted-foreground shrink-0">P{pIndex + 1}</span>
                                <Input
                                  placeholder="Tu pregunta"
                                  value={pregunta.pregunta}
                                  onChange={(e) => updatePregunta(block.id, pregunta.id, { pregunta: e.target.value })}
                                  className="bg-background"
                                />
                                {block.preguntas.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removePregunta(block.id, pregunta.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>

                              <div className="space-y-1.5 pl-6">
                                {pregunta.opciones.map((opcion: string, oIndex: number) => (
                                  <div key={oIndex} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`correcta-${pregunta.id}`}
                                      checked={pregunta.correcta === oIndex}
                                      onChange={() => updatePregunta(block.id, pregunta.id, { correcta: oIndex })}
                                      title="Marcar como correcta"
                                    />
                                    <Input
                                      placeholder={`Opción ${String.fromCharCode(65 + oIndex)}`}
                                      value={opcion}
                                      onChange={(e) => updateOpcion(block.id, pregunta.id, oIndex, e.target.value)}
                                      className="bg-background"
                                    />
                                    {pregunta.opciones.length > 2 && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={() => removeOpcion(block.id, pregunta.id, oIndex)}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button variant="ghost" size="sm" className="text-xs font-bold text-primary h-7" onClick={() => addOpcion(block.id, pregunta.id)}>
                                  <Plus className="w-3 h-3 mr-1" /> Agregar opción
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="w-full font-bold" onClick={() => addPregunta(block.id)}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar pregunta
                          </Button>
                        </div>
                      )}

                      {block.type === "snippet" && <Textarea value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} className="font-mono bg-muted text-sm" placeholder="Código de solo lectura..." />}

                      {block.type === "checklist" && (
                        <div className="space-y-1.5">
                          {block.items.map((item: string, iIndex: number) => (
                            <div key={iIndex} className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">{iIndex + 1}</span>
                              <Input
                                placeholder="Ej: Instalar Node.js"
                                value={item}
                                onChange={(e) => updateChecklistItem(block.id, iIndex, e.target.value)}
                              />
                              {block.items.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => removeChecklistItem(block.id, iIndex)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="w-full font-bold" onClick={() => addChecklistItem(block.id)}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> Agregar ítem
                          </Button>
                        </div>
                      )}

                      {block.type === "diff" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-[10px] font-bold">ANTES</Label><Textarea value={block.oldValue} onChange={(e) => updateBlock(block.id, block.value, { oldValue: e.target.value })} className="font-mono text-xs bg-red-50/30 dark:bg-red-950/20" /></div>
                          <div className="space-y-1"><Label className="text-[10px] font-bold">DESPUÉS</Label><Textarea value={block.newValue} onChange={(e) => updateBlock(block.id, block.value, { newValue: e.target.value })} className="font-mono text-xs bg-emerald-50/30 dark:bg-emerald-950/20" /></div>
                        </div>
                      )}
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => removeBlock(block.id)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 justify-center p-4 bg-card border rounded-2xl sticky bottom-0 shadow-lg z-50">
              {BLOCK_TYPES.map((type) => (
                <Button key={type.id} variant="outline" size="sm" onClick={() => addBlock(type.id)} className="rounded-full font-bold hover:bg-primary hover:text-white transition-all">
                  <type.icon className="w-3.5 h-3.5 mr-2" /> {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* VISTA PREVIA EN VIVO: así lo va a ver el alumno, se actualiza a medida
              que se arma la clase, sin necesidad de guardar para verla. */}
          <div className="min-w-0 xl:sticky xl:top-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Eye className="w-4 h-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Vista Previa (como la ve el alumno)</span>
            </div>
            <div className="border-2 rounded-3xl bg-white text-slate-900 p-6 md:p-8 max-h-[75vh] overflow-y-auto shadow-inner">
              {lessonTitle && (
                <h2 className="text-2xl font-black text-slate-900 mb-6 pb-4 border-b">{lessonTitle}</h2>
              )}
              {blocks.length > 0 ? (
                <LessonBlocks content={JSON.stringify(blocks)} />
              ) : (
                <p className="text-center text-muted-foreground py-16">
                  Agregá bloques a la izquierda para ver cómo va quedando la clase acá.
                </p>
              )}
            </div>
          </div>
          </div>

          <Button onClick={() => saveMutation.mutate()} className="w-full h-14 gradient-primary text-white font-black text-lg shadow-xl" disabled={!lessonTitle || blocks.length === 0 || saveMutation.isPending}>
            {saveMutation.isPending ? "GUARDANDO..." : "GUARDAR CLASE"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LessonEditorDialog;
