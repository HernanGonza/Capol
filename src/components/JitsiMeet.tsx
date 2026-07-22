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
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl p-8 space-y-6">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
          <Video className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-white">Clase en Vivo</h2>
        <p className="text-white/60 max-w-md">
          {courseTitle && lessonTitle
            ? `${courseTitle} - ${lessonTitle}`
            : "Sala de videoconferencia"}
        </p>
      </div>

      <Button
        onClick={openInNewTab}
        className="h-14 text-lg font-bold bg-primary hover:bg-primary/90 px-10"
      >
        <ExternalLink className="w-5 h-5 mr-2" />
        Abrir Video Llamada en Ventana Nueva
      </Button>

      {isTeacher && (
        <div className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-xl p-3 max-w-md text-xs text-white/60">
          <Circle className="w-3 h-3 text-red-500 fill-red-500 shrink-0 mt-0.5" />
          <p>
            Para grabar la clase: dentro de Jitsi, abrí el menú <strong className="text-white/80">"Más acciones"</strong> (los
            tres puntos) y elegí <strong className="text-white/80">"Iniciar grabación"</strong>. Se guarda en tu dispositivo al finalizar.
          </p>
        </div>
      )}

      <p className="text-xs text-white/40 text-center break-all max-w-md">
        Enlace: <span className="text-white/60 font-mono">{jitsiUrl}</span>
      </p>

      {onClose && (
        <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">
          Cerrar
        </Button>
      )}
    </div>
  );
};

export default JitsiMeet;