import { useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircleQuestion, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DYNAMIC_COURSES_SENTINEL, faqCategorias, type FaqCategory, type FaqQuestion } from "@/data/faqBot";

interface Props {
  courses: { id: string; titulo: string }[];
  whatsappNumber: string;
}

interface PathEntry {
  categoryId: string;
  questionId?: string;
}

const buscarPregunta = (questionId: string): { categoria: FaqCategory; pregunta: FaqQuestion } | undefined => {
  for (const categoria of faqCategorias) {
    const pregunta = categoria.preguntas.find((p) => p.id === questionId);
    if (pregunta) return { categoria, pregunta };
  }
  return undefined;
};

const FaqBot = ({ courses, whatsappNumber }: Props) => {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState<PathEntry[]>([]);

  const last = path[path.length - 1];
  const currentCategory = last ? faqCategorias.find((c) => c.id === last.categoryId) : undefined;
  const currentQuestion =
    last?.questionId && currentCategory ? currentCategory.preguntas.find((q) => q.id === last.questionId) : undefined;

  const abrirCategoria = (categoryId: string) => setPath([...path, { categoryId }]);

  // Si la pregunta relacionada es de otra categoría, apilamos también el nivel de
  // categoría intermedio, así "atrás" primero muestra su lista antes de salir del todo.
  const abrirPregunta = (categoryId: string, questionId: string) => {
    if (last?.categoryId === categoryId) {
      setPath([...path, { categoryId, questionId }]);
    } else {
      setPath([...path, { categoryId }, { categoryId, questionId }]);
    }
  };

  const volver = () => setPath(path.slice(0, -1));

  const resolverRespuesta = (respuesta: string) => {
    if (respuesta !== DYNAMIC_COURSES_SENTINEL) return respuesta;
    if (courses.length === 0) {
      return "En este momento no hay cursos publicados, pero podés escribirnos para consultar por las próximas fechas.";
    }
    return `Estos son los cursos que tenemos disponibles ahora mismo:\n\n${courses
      .map((c) => `• ${c.titulo}`)
      .join("\n")}`;
  };

  const headerTitle = currentQuestion ? currentQuestion.pregunta : currentCategory ? currentCategory.titulo : "Preguntas frecuentes";

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] h-[70vh] sm:h-[520px] max-h-[80vh] bg-white dark:bg-[#0f0f15] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl shadow-indigo-500/20 flex flex-col overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-white/10">
            {path.length > 0 && (
              <button
                onClick={volver}
                aria-label="Volver"
                className="p-1 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="flex-1 font-semibold text-slate-900 dark:text-white text-sm truncate">{headerTitle}</h3>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <ScrollArea className="flex-1 p-4">
            {!currentCategory && (
              <div className="space-y-2">
                {faqCategorias.map((cat) => {
                  const Icon = cat.icono;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => abrirCategoria(cat.id)}
                      className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors text-left"
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{cat.titulo}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}

            {currentCategory && !currentQuestion && (
              <div className="space-y-2">
                {currentCategory.preguntas.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => abrirPregunta(currentCategory.id, q.id)}
                    className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{q.pregunta}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {currentQuestion && (
              <div className="space-y-4">
                <p className="whitespace-pre-line text-sm text-slate-600 dark:text-white/60 leading-relaxed">
                  {resolverRespuesta(currentQuestion.respuesta)}
                </p>
                {currentQuestion.relacionadas && currentQuestion.relacionadas.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 dark:text-white/40 uppercase tracking-wide">
                      Preguntas relacionadas
                    </p>
                    {currentQuestion.relacionadas.map((relId) => {
                      const encontrada = buscarPregunta(relId);
                      if (!encontrada) return null;
                      return (
                        <button
                          key={relId}
                          onClick={() => abrirPregunta(encontrada.categoria.id, encontrada.pregunta.id)}
                          className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-white/70 transition-colors"
                        >
                          {encontrada.pregunta.pregunta}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-white/40 mb-2">¿No encontrás lo que buscás?</p>
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold text-sm transition-colors"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar preguntas frecuentes" : "Abrir preguntas frecuentes"}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-2xl shadow-indigo-500/30 flex items-center justify-center hover:scale-110 transition-transform"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircleQuestion className="w-6 h-6" />}
      </button>
    </>
  );
};

export default FaqBot;
