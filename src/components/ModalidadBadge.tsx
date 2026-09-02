import { Radio, Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { modalidadLabel, modalidadBadgeClass, esGrabado, type Modalidad } from "@/lib/modalidad";

interface Props {
  modalidad: Modalidad | string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

// Pill "En vivo" / "Grabado" para usar en listas donde aparecen cursos de las
// dos modalidades (mensajería, tablas de admin, selects, etc.).
const ModalidadBadge = ({ modalidad, className, showIcon = true }: Props) => {
  const Icon = esGrabado(modalidad) ? Film : Radio;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] font-bold uppercase tracking-wide", modalidadBadgeClass(modalidad), className)}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {modalidadLabel(modalidad)}
    </Badge>
  );
};

export default ModalidadBadge;
