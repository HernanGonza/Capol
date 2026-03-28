import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  roomName: string;
}

const JitsiMeet = ({ roomName }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();

  useEffect(() => {
    const domain = "meet.jit.si";
    const options = {
      roomName,
      parentNode: containerRef.current,
      userInfo: {
        displayName: profile?.full_name || "Participante",
      },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: "#1a1f2e",
      },
      width: "100%",
      height: 500,
    };

    const loadJitsi = () => {
      if ((window as any).JitsiMeetExternalAPI) {
        const api = new (window as any).JitsiMeetExternalAPI(domain, options);
        return () => api.dispose();
      }
    };

    if ((window as any).JitsiMeetExternalAPI) {
      const cleanup = loadJitsi();
      return cleanup;
    }

    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = loadJitsi;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [roomName, profile?.full_name]);

  return (
    <div ref={containerRef} className="rounded-lg overflow-hidden" style={{ minHeight: 500 }} />
  );
};

export default JitsiMeet;
