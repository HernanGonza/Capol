import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Maximize2, AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  roomName: string;
  onClose?: () => void;
}

interface JitsiAPI {
  dispose: () => void;
  executeCommand: (command: string, ...args: any[]) => void;
  addEventListener: (event: string, handler: (...args: any[]) => void) => void;
  removeEventListener: (event: string, handler: (...args: any[]) => void) => void;
  getNumberOfParticipants: () => Promise<number>;
  isVideoMuted: () => Promise<boolean>;
  isAudioMuted: () => Promise<boolean>;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: any) => JitsiAPI;
  }
}

const JitsiMeet = ({ roomName, onClose }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiAPI | null>(null);
  const { profile } = useAuth();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [participantCount, setParticipantCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleReadyToClose = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.dispose();
      apiRef.current = null;
    }
    setIsConnected(false);
    onClose?.();
  }, [onClose]);

  const handleParticipantJoined = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.getNumberOfParticipants().then(setParticipantCount);
    }
  }, []);

  const handleParticipantLeft = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.getNumberOfParticipants().then(setParticipantCount);
    }
  }, []);

  const handleVideoConferenceJoined = useCallback(() => {
    setIsConnected(true);
    setIsLoading(false);
    setError(null);
    if (apiRef.current) {
      apiRef.current.getNumberOfParticipants().then(setParticipantCount);
    }
  }, []);

  const handleAudioMuteStatusChanged = useCallback((data: { muted: boolean }) => {
    setIsMuted(data.muted);
  }, []);

  const handleVideoMuteStatusChanged = useCallback((data: { muted: boolean }) => {
    setIsVideoOff(data.muted);
  }, []);

  const handleVideoConferenceLeft = useCallback(() => {
    setIsConnected(false);
    onClose?.();
  }, [onClose]);

  const initJitsi = useCallback(() => {
    if (!window.JitsiMeetExternalAPI || !containerRef.current) {
      return null;
    }

    const domain = "meet.jit.si";
    const options = {
      roomName: `capol-${roomName}`,
      parentNode: containerRef.current,
      userInfo: {
        displayName: profile?.full_name || "Participante",
        email: "",
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        enableWelcomePage: false,
        enableClosePage: false,
        disableInviteFunctions: true,
        hideConferenceSubject: false,
        hideConferenceTimer: false,
        resolution: 720,
        constraints: {
          video: {
            height: { ideal: 720, max: 720, min: 180 }
          }
        },
        toolbarButtons: [
          'camera',
          'chat',
          'desktop',
          'fullscreen',
          'hangup',
          'microphone',
          'participants-pane',
          'raisehand',
          'settings',
          'tileview',
        ],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        DEFAULT_BACKGROUND: "#0a0a0f",
        TOOLBAR_ALWAYS_VISIBLE: false,
        HIDE_INVITE_MORE_HEADER: true,
        MOBILE_APP_PROMO: false,
        PROVIDER_NAME: "CAPOL",
        APP_NAME: "CAPOL Clases",
        TOOLBAR_TIMEOUT: 4000,
        DEFAULT_REMOTE_DISPLAY_NAME: "Participante",
      },
      width: "100%",
      height: "100%",
    };

    try {
      const api = new window.JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;

      api.addEventListener("readyToClose", handleReadyToClose);
      api.addEventListener("participantJoined", handleParticipantJoined);
      api.addEventListener("participantLeft", handleParticipantLeft);
      api.addEventListener("videoConferenceJoined", handleVideoConferenceJoined);
      api.addEventListener("videoConferenceLeft", handleVideoConferenceLeft);
      api.addEventListener("audioMuteStatusChanged", handleAudioMuteStatusChanged);
      api.addEventListener("videoMuteStatusChanged", handleVideoMuteStatusChanged);

      return api;
    } catch (err) {
      console.error("Error initializing Jitsi:", err);
      setError("Error al iniciar la videoconferencia");
      setIsLoading(false);
      return null;
    }
  }, [
    roomName,
    profile?.full_name,
    handleReadyToClose,
    handleParticipantJoined,
    handleParticipantLeft,
    handleVideoConferenceJoined,
    handleVideoConferenceLeft,
    handleAudioMuteStatusChanged,
    handleVideoMuteStatusChanged
  ]);

  const loadJitsiScript = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Si ya existe, resolver inmediatamente
      if (window.JitsiMeetExternalAPI) {
        resolve();
        return;
      }

      // Verificar si ya hay un script cargando
      const existingScript = document.querySelector('script[src*="external_api.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Script failed to load')));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Jitsi script"));
      document.head.appendChild(script);
    });
  }, []);

  const retry = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    
    try {
      await loadJitsiScript();
      initJitsi();
    } catch (err) {
      setError("No se pudo cargar Jitsi. Verifica tu conexión.");
      setIsLoading(false);
    }
  }, [loadJitsiScript, initJitsi]);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        await loadJitsiScript();
        if (mounted) {
          // Pequeño delay para asegurar que el DOM está listo
          setTimeout(() => {
            if (mounted) {
              initJitsi();
            }
          }, 100);
        }
      } catch (err) {
        if (mounted) {
          setError("No se pudo cargar la videoconferencia");
          setIsLoading(false);
        }
      }
    };

    setup();

    return () => {
      mounted = false;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [loadJitsiScript, initJitsi]);

  const toggleAudio = () => {
    apiRef.current?.executeCommand("toggleAudio");
  };

  const toggleVideo = () => {
    apiRef.current?.executeCommand("toggleVideo");
  };

  const hangUp = () => {
    apiRef.current?.executeCommand("hangup");
  };

  const toggleFullScreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#0a0a0f] rounded-2xl overflow-hidden">
      {/* Loading State */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <Video className="absolute inset-0 m-auto w-6 h-6 text-indigo-400" />
          </div>
          <p className="mt-4 text-white/60 font-medium">Conectando a la clase...</p>
          <p className="text-sm text-white/40 mt-1">Preparando audio y video</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-white/80 font-medium mb-2">{error}</p>
          <p className="text-sm text-white/40 mb-6">Intenta nuevamente</p>
          <Button onClick={retry} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      )}

      {/* Jitsi Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ minHeight: "500px" }}
      />

      {/* Custom Controls Overlay */}
      {isConnected && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 text-white/70 text-sm font-medium">
            <Users className="w-4 h-4" />
            <span>{participantCount}</span>
          </div>

          <div className="w-px h-8 bg-white/10" />

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleAudio}
            className={`rounded-xl h-10 w-10 ${
              isMuted 
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleVideo}
            className={`rounded-xl h-10 w-10 ${
              isVideoOff 
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullScreen}
            className="rounded-xl h-10 w-10 bg-white/10 text-white hover:bg-white/20"
          >
            <Maximize2 className="w-5 h-5" />
          </Button>

          <div className="w-px h-8 bg-white/10" />

          <Button
            size="icon"
            onClick={hangUp}
            className="rounded-xl h-10 w-10 bg-red-500 hover:bg-red-600 text-white"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default JitsiMeet;
