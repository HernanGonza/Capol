import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ExternalLink, Video, AlertTriangle } from "lucide-react";

interface Props {
  roomName: string;
  courseTitle?: string;
  lessonTitle?: string;
  onClose?: () => void;
}

// Función para generar un nombre de sala legible
const generateRoomName = (roomName: string, courseTitle?: string, lessonTitle?: string): string => {
  if (courseTitle && lessonTitle) {
    // Limpiar caracteres especiales y espacios
    const cleanCourse = courseTitle.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '').slice(0, 20);
    const cleanLesson = lessonTitle.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '').slice(0, 30);
    return `CAPOL-${cleanCourse}-${cleanLesson}`;
  }
  return `CAPOL-${roomName}`;
};

const JitsiMeet = ({ roomName, courseTitle, lessonTitle, onClose }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const { profile } = useAuth();
  const [showWarning, setShowWarning] = useState(true);
  const [useEmbed, setUseEmbed] = useState(false);

  const fullRoomName = generateRoomName(roomName, courseTitle, lessonTitle);
  const userName = profile?.full_name || "Participante";
  
  // URL para abrir en nueva pestaña
  const jitsiUrl = `https://meet.jit.si/${fullRoomName}#userInfo.displayName="${encodeURIComponent(userName)}"&config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.prejoinPageEnabled=false`;

  const openInNewTab = () => {
    window.open(jitsiUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!useEmbed) return;

    const domain = "meet.jit.si";
    const options = {
      roomName: fullRoomName,
      parentNode: containerRef.current,
      userInfo: {
        displayName: userName,
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: "#0a0a0f",
      },
      width: "100%",
      height: "100%",
    };

    const loadJitsi = () => {
      if ((window as any).JitsiMeetExternalAPI && containerRef.current) {
        const api = new (window as any).JitsiMeetExternalAPI(domain, options);
        apiRef.current = api;
        
        api.addEventListener("readyToClose", () => {
          api.dispose();
          apiRef.current = null;
          onClose?.();
        });
      }
    };

    if ((window as any).JitsiMeetExternalAPI) {
      loadJitsi();
    } else {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = loadJitsi;
      document.head.appendChild(script);
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [useEmbed, fullRoomName, userName, onClose]);

  // Vista inicial: Elegir cómo entrar
  if (!useEmbed) {
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
              : "Sala de videoconferencia"
            }
          </p>
        </div>

        {showWarning && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 max-w-md">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-200 font-medium mb-1">Aviso importante</p>
                <p className="text-amber-200/70">
                  El modo embebido tiene un límite de 5 minutos. Para clases largas, 
                  recomendamos abrir en nueva pestaña.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <Button 
            onClick={openInNewTab}
            className="flex-1 h-14 text-lg font-bold bg-primary hover:bg-primary/90"
          >
            <ExternalLink className="w-5 h-5 mr-2" />
            Abrir en Nueva Pestaña
          </Button>
          <Button 
            onClick={() => { setUseEmbed(true); setShowWarning(false); }}
            variant="outline"
            className="flex-1 h-14 text-lg font-medium border-white/20 text-white hover:bg-white/10"
          >
            Ver Aquí (5 min)
          </Button>
        </div>

        <p className="text-xs text-white/40 text-center">
          Nombre de sala: <span className="text-white/60 font-mono">{fullRoomName}</span>
        </p>
      </div>
    );
  }

  // Vista embed
  return (
    <div className="relative w-full h-full min-h-[600px] bg-slate-900 rounded-2xl overflow-hidden">
      <div 
        ref={containerRef} 
        className="absolute inset-0"
      />
      
      {/* Botón para salir */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (apiRef.current) {
              apiRef.current.dispose();
              apiRef.current = null;
            }
            setUseEmbed(false);
            onClose?.();
          }}
          className="bg-black/50 border-white/20 text-white hover:bg-black/70"
        >
          Salir
        </Button>
      </div>
    </div>
  );
};

export default JitsiMeet;