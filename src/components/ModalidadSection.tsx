import { ReactNode } from "react";
import { Film, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type Modalidad = "en_vivo" | "grabado";

// Cada modalidad tiene su propio color de bloque, bien distinto al de la otra
// (naranja vs. índigo), con una combinación para modo claro y otra para oscuro.
const ESTILOS: Record<Modalidad, { label: string; icon: typeof Radio; texto: string; chip: string; linea: string; fondo: string }> = {
  en_vivo: {
    label: "En vivo",
    icon: Radio,
    texto: "text-orange-900 dark:text-orange-200",
    chip: "bg-orange-500 text-white border-orange-600 dark:bg-orange-500 dark:border-orange-300",
    linea: "from-orange-600 dark:from-orange-300",
    fondo: "bg-orange-200 border-orange-500 dark:bg-orange-900/70 dark:border-orange-400",
  },
  grabado: {
    label: "Grabados",
    icon: Film,
    texto: "text-indigo-900 dark:text-indigo-200",
    chip: "bg-indigo-600 text-white border-indigo-700 dark:bg-indigo-500 dark:border-indigo-300",
    linea: "from-indigo-600 dark:from-indigo-300",
    fondo: "bg-indigo-200 border-indigo-500 dark:bg-indigo-900/70 dark:border-indigo-400",
  },
};

// Título grande de cada modalidad ("En vivo · 3", "Grabados · 5") con una línea
// de color que se desvanece hacia la derecha. Se usa en la landing, en la
// pantalla de cursos del alumno y en la del admin, así se ve igual en todos lados.
export const ModalidadTitulo = ({
  modalidad,
  count,
  subtitulo,
}: {
  modalidad: Modalidad;
  count: number;
  subtitulo?: string;
}) => {
  const e = ESTILOS[modalidad];
  const Icon = e.icon;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn("flex items-center justify-center w-11 h-11 rounded-2xl border", e.chip)}>
          <Icon className="w-5 h-5" />
        </span>
        <h2 className={cn("text-3xl md:text-4xl font-black tracking-tight", e.texto)}>{e.label}</h2>
        <span className={cn("text-base md:text-lg font-black px-3 py-0.5 rounded-full border", e.chip)}>{count}</span>
        <div className={cn("hidden sm:block flex-1 h-0.5 bg-gradient-to-r to-transparent min-w-8", e.linea)} />
      </div>
      {subtitulo && <p className={cn("text-sm md:text-base mt-3 opacity-80", e.texto)}>{subtitulo}</p>}
    </div>
  );
};

// Bloque de color de una modalidad. Los dos bloques (en vivo / grabados) van uno
// pegado al otro y el borde grueso de cada uno hace de línea de separación.
// `fullBleed` lo estira al ancho de toda la pantalla (landing); sin eso queda
// como una tarjeta redondeada dentro del contenido (dashboard y admin).
export const ModalidadZona = ({
  modalidad,
  children,
  fullBleed = false,
  className,
}: {
  modalidad: Modalidad;
  children: ReactNode;
  fullBleed?: boolean;
  className?: string;
}) => (
  <div className={cn("relative isolate", className)}>
    <div
      aria-hidden
      className={cn(
        "absolute inset-y-0 -z-10 pointer-events-none",
        ESTILOS[modalidad].fondo,
        fullBleed ? "left-1/2 w-screen -translate-x-1/2 border-y-4" : "-inset-x-4 rounded-3xl border-4"
      )}
    />
    {children}
  </div>
);
