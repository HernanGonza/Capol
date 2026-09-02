import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import ModalidadBadge from "@/components/ModalidadBadge";

export type ForoActividadCurso = {
  cursoId: string;
  cursoTitulo: string;
  cursoModalidad: string | null;
  count: number;
  ultimoContenido: string | null;
  ultimoCreadoEn: string;
};

interface NotificationBellProps {
  porCurso: ForoActividadCurso[];
  collapsed?: boolean;
  className?: string;
  id?: string;
}

// Campanita de "actividad en foros": no depende de una tabla de
// notificaciones propia, solo resume por curso lo que ya calcula AppLayout
// a partir de foro_ultima_lectura + mensajes (ver ["foro-no-leidos-count"]).
const NotificationBell = ({ porCurso, collapsed, className, id }: NotificationBellProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const total = porCurso.reduce((acc, c) => acc + c.count, 0);

  const goToForo = (cursoId: string) => {
    setOpen(false);
    navigate(`/messages?curso=${cursoId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          title="Notificaciones de foros"
          className={cn(
            "relative rounded-lg font-semibold transition-colors",
            collapsed ? "w-9 h-9" : "w-full justify-start",
            className
          )}
        >
          <Bell className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Notificaciones</span>}
          {total > 0 && (
            <span
              className={cn(
                "absolute bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center",
                collapsed ? "top-0.5 right-0.5 w-4 h-4" : "top-1 right-2 w-4 h-4"
              )}
            >
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="p-3 border-b">
          <p className="text-sm font-bold">Actividad en foros</p>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y">
          {porCurso.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">No hay actividad nueva.</p>
          )}
          {porCurso.map((c) => (
            <button
              key={c.cursoId}
              type="button"
              onClick={() => goToForo(c.cursoId)}
              className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{c.cursoTitulo}</p>
                  <ModalidadBadge modalidad={c.cursoModalidad} className="mt-0.5" />
                </div>
                <span className="bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                  {c.count}
                </span>
              </div>
              {c.ultimoContenido && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultimoContenido}</p>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
