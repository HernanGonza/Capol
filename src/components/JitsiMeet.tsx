import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ExternalLink, Video } from "lucide-react";

const JITSI_DOMAIN = "meet.jit.si";

interface Props {
  roomName: string;
  courseTitle?: string;
  lessonTitle?: string;
  onClose?: () => void;
  // El profesor entra sin mutear (es moderador: entra primero, ver
  // "clase_iniciada_en"). El alumno entra con cámara y micrófono apagados.
  isTeacher?: boolean;
}

// Convierte el nombre de sala elegido por el profesor en un slug válido para Jitsi.
const buildSlug = (roomName: string, courseTitle?: string, lessonTitle?: string): string => {
  const base = roomName?.trim()
    ? roomName
    : [courseTitle, lessonTitle].filter(Boolean).join("-") || "clase";

  const clean = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);

  return `CAPOL-${clean}`;
};

// meet.jit.si corta las llamadas EMBEBIDAS (iframe / API externa) a los 5
// minutos. Por eso la videollamada se abre siempre en una pestaña nueva, que
// no tiene ese límite. Pasamos la config por el hash de la URL.
export const buildJitsiUrl = (
  roomName: string,
  displayName: string,
  opts: { courseTitle?: string; lessonTitle?: string; muted?: boolean } = {},
) => {
  const slug = buildSlug(roomName, opts.courseTitle, opts.lessonTitle);
  const params = [
    `userInfo.displayName=%22${encodeURIComponent(displayName)}%22`,
    "config.prejoinPageEnabled=false",
    "config.disableDeepLinking=true",
    "interfaceConfig.MOBILE_APP_PROMO=false",
    "interfaceConfig.SHOW_JITSI_WATERMARK=false",
    "interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE=false",
  ];
  if (opts.muted) {
    params.push("config.startWithAudioMuted=true", "config.startWithVideoMuted=true");
  }
  return `https://${JITSI_DOMAIN}/${slug}#${params.join("&")}`;
};

const JitsiMeet = ({ roomName, courseTitle, lessonTitle, onClose, isTeacher }: Props) => {
  const { profile } = useAuth();
  const userName = profile?.nombre_completo || "Participante";
  const jitsiUrl = buildJitsiUrl(roomName, userName, {
    courseTitle,
    lessonTitle,
    muted: !isTeacher,
  });

  const openCall = () => window.open(jitsiUrl, "_blank", "noopener,noreferrer");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
        <Video className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-bold text-white">Clase en Vivo</h2>
        <p className="max-w-xs text-xs text-white/60">
          {courseTitle && lessonTitle ? `${courseTitle} — ${lessonTitle}` : "Sala de videoconferencia"}
        </p>
      </div>

      <Button onClick={openCall} className="h-11 bg-primary px-6 font-bold hover:bg-primary/90">
        <ExternalLink className="mr-2 h-4 w-4" />
        Entrar a la videollamada
      </Button>
      <p className="max-w-xs text-[11px] text-white/40">
        Se abre en una pestaña nueva. Si se cierra, volvé a entrar desde acá.
      </p>

      {onClose && (
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white/50 hover:text-white">
          Cerrar
        </Button>
      )}
    </div>
  );
};

export default JitsiMeet;
