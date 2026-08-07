import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Code,
  Info,
  Download,
  ArrowRight,
  HelpCircle,
  CheckSquare,
  GitCompare,
} from "lucide-react";
import Terminal from "@/components/Terminal";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { isSafeUrl } from "@/lib/safeUrl";

marked.setOptions({ breaks: true, gfm: true });

// El bloque de texto se escribe en Markdown (con soporte de HTML embebido para casos
// puntuales). Lo convertimos a HTML y lo sanitizamos antes de mostrarlo: así "**negrita**",
// "# Títulos", listas, links, etc. se ven bien, y evitamos que contenido malicioso
// termine ejecutando scripts en el navegador del alumno.
export const renderMarkdown = (value: string) => {
  const rawHtml = marked.parse(value || "", { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, { ADD_ATTR: ["target"] });
};

const getEmbedUrl = (url: string) => {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Si no es ninguno de los dos, se embebe la URL tal cual (para otros
  // proveedores de video) — pero solo si es http/https, sino un iframe con
  // "javascript:" u otro esquema raro no tiene por qué estar ahí.
  return isSafeUrl(url) ? url : "";
};

interface Props {
  content: string | null;
  // true para la muestra gratis de un curso grabado: oculta los recursos
  // descargables, que son material exclusivo de quien compró el curso.
  restringido?: boolean;
}

// El quiz ahora soporta varias preguntas (antes era una sola, hardcodeada con
// 2 opciones A/B). Estas funciones también entienden el formato viejo, así
// las clases que ya tenían un quiz armado siguen funcionando sin tocar nada.
const getQuizQuestions = (block: any): { id: string; pregunta: string; opciones: string[]; correcta: number }[] => {
  if (Array.isArray(block.preguntas)) return block.preguntas;
  if (block.value) {
    return [{
      id: `${block.id}-legacy`,
      pregunta: block.value,
      opciones: [block.a || "", block.b || ""],
      correcta: block.correct === "B" ? 1 : 0,
    }];
  }
  return [];
};

// Mismo criterio para el checklist: antes era un textarea con un ítem por
// línea. Ahora es una lista de ítems propiamente dicha, pero se sigue
// leyendo el formato viejo si existe.
const getChecklistItems = (block: any): string[] => {
  if (Array.isArray(block.items)) return block.items.filter((t: string) => t.trim() !== "");
  if (typeof block.value === "string") return block.value.split("\n").filter((t: string) => t.trim() !== "");
  return [];
};

const LessonBlocks = ({ content, restringido }: Props) => {
  const blocks = (() => {
    try {
      return JSON.parse(content || "[]");
    } catch (e) {
      return [{ id: "old-html", type: "text", value: content }];
    }
  })();

  return (
    <div className="space-y-16">
      {blocks.map((block: any) => (
        <div key={block.id} className="animate-in fade-in slide-in-from-bottom-6 duration-700">

          {/* 1. TEXTO / MD */}
          {block.type === 'text' && (
            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-black prose-a:text-primary prose-img:rounded-2xl prose-pre:bg-slate-900 prose-pre:text-slate-100">
              <div
                dangerouslySetInnerHTML={{ __html: renderMarkdown(block.value) }}
                className="leading-relaxed"
              />
            </div>
          )}

          {/* 2. VIDEO — solo reproducir: sin menú de click derecho ni nada
              que sugiera "guardar/descargar" (más allá de eso, el video real
              vive en un iframe de otro origen — YouTube, Vimeo, Drive —, así
              que la protección real contra la descarga la da ese proveedor,
              no nosotros). */}
          {block.type === 'video' && (
            <Card
              className="overflow-hidden border-none shadow-2xl rounded-[2rem] bg-black ring-8 ring-muted"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="aspect-video">
                <iframe
                  src={getEmbedUrl(block.value)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; encrypted-media"
                />
              </div>
            </Card>
          )}

          {/* 3. IMAGEN */}
          {block.type === 'image' && (
            <div className="flex flex-col items-center group">
              <img src={block.value} alt="Visual" className="rounded-3xl shadow-2xl max-h-[700px] object-contain border-4 border-background" />
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
              block.style === 'warning' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-300' :
              block.style === 'tip' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-900 dark:text-emerald-300' :
              'bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-900 dark:text-blue-300'
            }`}>
              <Info className="w-7 h-7 shrink-0 opacity-80" />
              <div className="font-bold text-lg leading-snug">{block.value}</div>
            </div>
          )}

          {/* 6. RECURSO — material exclusivo de quien compró el curso, no
              se muestra en la muestra gratis. */}
          {block.type === 'download' && !restringido && isSafeUrl(block.value) && (
            <a href={block.value} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-6 bg-card border-2 border-border rounded-3xl hover:border-primary hover:shadow-xl transition-all group">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-muted rounded-2xl group-hover:bg-primary/10 transition-colors"><Download className="w-7 h-7 text-muted-foreground group-hover:text-primary" /></div>
                <div>
                  <div className="font-black text-xl text-foreground">{block.label || "Material de Apoyo"}</div>
                  <div className="text-sm text-muted-foreground font-bold uppercase tracking-tighter">Descargar archivo</div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-2 transition-all" />
            </a>
          )}

          {/* 7. MINI QUIZ */}
          {block.type === 'quiz' && (
            <div className="space-y-5">
              {getQuizQuestions(block).map((pregunta, qIndex) => (
                <Card key={pregunta.id} className="border-2 border-border shadow-xl rounded-[2rem] overflow-hidden">
                  <div className="bg-muted p-6 border-b flex items-center gap-4">
                    <HelpCircle className="w-6 h-6 text-primary shrink-0" />
                    <h4 className="font-black text-xl text-foreground">
                      {getQuizQuestions(block).length > 1 && <span className="text-primary mr-2">{qIndex + 1}.</span>}
                      {pregunta.pregunta}
                    </h4>
                  </div>
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pregunta.opciones.map((opcion, oIndex) => (
                      <Button
                        key={oIndex}
                        variant="outline"
                        className="h-auto py-6 px-8 text-lg font-bold rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left justify-start"
                        onClick={() => {
                          if (oIndex === pregunta.correcta) { toast.success("¡Respuesta Correcta!"); } else { toast.error("Incorrecto, prueba otra vez."); }
                        }}
                      >
                        <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center mr-4 shrink-0 text-sm">
                          {String.fromCharCode(65 + oIndex)}
                        </div>
                        {opcion}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 8. SNIPPET */}
          {block.type === 'snippet' && (
            <div className="relative group">
              <div className="absolute top-4 right-4 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
            <div className="bg-muted/50 p-8 rounded-[2rem] border-2 border-dashed border-border space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <CheckSquare className="w-6 h-6 text-primary" />
                <h4 className="font-black text-sm uppercase tracking-[0.2em] text-muted-foreground">Hoja de Ruta</h4>
              </div>
              <div className="grid gap-3">
                {getChecklistItems(block).map((task: string, i: number) => (
                  <label key={i} className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border cursor-pointer hover:shadow-md transition-all group">
                    <input type="checkbox" className="w-6 h-6 rounded-lg border-input text-primary cursor-pointer" />
                    <span className="text-foreground font-bold group-has-[:checked]:line-through group-has-[:checked]:text-muted-foreground transition-all text-lg">
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
              <div className="flex items-center gap-2 text-muted-foreground font-black text-[10px] uppercase tracking-[0.3em] px-4">
                <GitCompare className="w-4 h-4" /> <span>Comparativa de cambios</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border-4 border-border rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="bg-card p-6 border-r border-border">
                  <div className="text-[10px] font-black text-red-400 mb-3 uppercase">Anterior</div>
                  <pre className="font-mono text-xs text-muted-foreground bg-red-50/30 dark:bg-red-950/20 p-5 rounded-2xl"><code>{block.oldValue}</code></pre>
                </div>
                <div className="bg-card p-6">
                  <div className="text-[10px] font-black text-emerald-500 mb-3 uppercase">Nuevo</div>
                  <pre className="font-mono text-xs text-foreground bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900"><code>{block.newValue}</code></pre>
                </div>
              </div>
            </div>
          )}

        </div>
      ))}
      {blocks.length === 0 && (
        <p className="text-center text-muted-foreground py-16">Esta clase todavía no tiene contenido cargado.</p>
      )}
    </div>
  );
};

export default LessonBlocks;