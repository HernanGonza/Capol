import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ExternalLink, Video, Circle } from "lucide-react";

interface Props {
  roomName: string;
  courseTitle?: string;
  lessonTitle?: string;
  onClose?: () => void;
  isTeacher?: boolean;
}

// Convierte el nombre de sala elegido por el profesor en un slug válido para Jitsi.
// Prioriza SIEMPRE el nombre elegido; solo arma uno automático si no hay ninguno.
const buildSlug = (roomName: string, courseTitle?: string, lessonTitle?: string): string => {
  const base = roomName?.trim()
    ? roomName
    : [courseTitle, lessonTitle].filter(Boolean).join("-") || "clase";

  const clean = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);

  return `CAPOL-${clean}`;
};

export const buildJitsiUrl = (roomName: string, displayName: string, courseTitle?: string, lessonTitle?: string) => {
  const slug = buildSlug(roomName, courseTitle, lessonTitle);
  const params = new URLSearchParams({
    "config.startWithAudioMuted": "true",
    "config.startWithVideoMuted": "true",
    "config.prejoinPageEnabled": "true",
    // Jitsi permite grabar la clase (grabación local, se guarda en el dispositivo de
    // quien la inicia). Nos aseguramos de que el botón de grabación esté visible.
    "config.localRecording.disable": "false",
    "config.localRecording.notifyAllParticipants": "true",
  });
  return `https://meet.jit.si/${slug}#userInfo.displayName="${encodeURIComponent(displayName)}"&${params.toString()}`;
};

const JitsiMeet = ({ roomName, courseTitle, lessonTitle, onClose, isTeacher }: Props) => {
  const { profile } = useAuth();

  const slug = buildSlug(roomName, courseTitle, lessonTitle);
  const userName = profile?.nombre_completo || "Participante";
  const jitsiUrl = buildJitsiUrl(roomName, userName, courseTitle, lessonTitle);

  const openInNewTab = () => {
    window.open(jitsiUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full min-h-0 bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl p-4 gap-3">
      <div className="text-center space-y-1.5">
        <div className="w-11 h-11 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Video className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-base font-bold text-white">Clase en Vivo</h2>
        <p className="text-white/60 text-xs max-w-md">
          {courseTitle && lessonTitle
            ? `${courseTitle} - ${lessonTitle}`
            : "Sala de videoconferencia"}
        </p>
      </div>

      <Button
        onClick={openInNewTab}
        className="h-10 text-sm font-bold bg-primary hover:bg-primary/90 px-6"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Abrir Video Llamada en Ventana Nueva
      </Button>

      {isTeacher && (
        <div className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-xl p-2.5 max-w-md text-[11px] text-white/60">
          <Circle className="w-2.5 h-2.5 text-red-500 fill-red-500 shrink-0 mt-0.5" />
          <p>
            Para grabar: dentro de Jitsi, abrí <strong className="text-white/80">"Más acciones"</strong> (los tres puntos) y elegí{" "}
            <strong className="text-white/80">"Iniciar grabación"</strong>. Se guarda en tu dispositivo al finalizar.
          </p>
        </div>
      )}

      {onClose && (
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white/50 hover:text-white">
          Cerrar
        </Button>
      )}
    </div>
  );
};

export default JitsiMeet;