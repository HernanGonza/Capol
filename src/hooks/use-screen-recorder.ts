import { useCallback, useEffect, useRef, useState } from "react";

// Grabador de pantalla propio para las clases en vivo. Usa las APIs del
// navegador (getDisplayMedia + MediaRecorder), sin depender de la grabación de
// Jitsi. El archivo NO se sube a ningún lado: se descarga en la compu del
// profesor, que se lo pasa al admin para editar y armar el curso grabado.
//
// Limitaciones conocidas (son del navegador, no se pueden evitar):
//  - Al iniciar, el navegador SIEMPRE pregunta qué pantalla/ventana/pestaña
//    compartir. Para que se grabe el audio de la videollamada hay que elegir
//    la PESTAÑA de la clase y tildar "compartir audio de la pestaña".
//  - Graba mientras la pestaña de la plataforma esté abierta. Si se cierra, se
//    corta y se descarga lo grabado hasta ahí.
//  - Chrome / Edge andan bien. Firefox parcial. Safari casi no.

type RecorderStatus = "idle" | "recording" | "error";

interface UseScreenRecorderOptions {
  // Nombre base del archivo .webm (se le agrega fecha y hora).
  fileName?: string;
}

const pickMimeType = (): string => {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
};

export const screenRecordingSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getDisplayMedia &&
  typeof MediaRecorder !== "undefined";

export const useScreenRecorder = ({ fileName = "Clase" }: UseScreenRecorderOptions = {}) => {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Aviso NO fatal: la grabación sigue, pero le falta el audio de la
  // videollamada (no se escucharía a los alumnos). Lo mostramos en el momento
  // para que el profe pueda cortar y volver a compartir bien.
  const [warning, setWarning] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const download = useCallback(
    (blob: Blob) => {
      const stamp = new Date()
        .toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" })
        .replace(/[: ]/g, "-");
      const safe = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 -]/g, "").trim() || "Clase";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safe} - ${stamp}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    },
    [fileName],
  );

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop(); // dispara onstop -> arma el blob y descarga
    } else {
      cleanup();
      setStatus("idle");
      setWarning(null);
    }
  }, [cleanup]);

  const start = useCallback(async () => {
    if (!screenRecordingSupported()) {
      setError("Tu navegador no soporta grabación de pantalla. Usá Chrome o Edge en una computadora.");
      setStatus("error");
      return;
    }
    setError(null);
    setWarning(null);
    try {
      // 1. Pantalla / ventana / pestaña + su audio (si el profe lo tilda).
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      streamsRef.current.push(display);

      // ¿Entró el audio de la videollamada? Solo pasa si el profe eligió una
      // PESTAÑA de Chrome y tildó "compartir audio de la pestaña". Si compartió
      // una ventana o toda la pantalla, o se olvidó el tilde, la grabación
      // queda solo con su micrófono: no se escucha a los alumnos. Avisamos ya.
      if (display.getAudioTracks().length === 0) {
        const surface = (
          display.getVideoTracks()[0]?.getSettings?.() as { displaySurface?: string } | undefined
        )?.displaySurface;
        setWarning(
          surface && surface !== "browser"
            ? 'Estás grabando SIN el audio de la videollamada: compartiste una ventana o toda la pantalla. Cortá la grabación, dale a Grabar de nuevo, elegí la PESTAÑA de la videollamada y tildá "Compartir audio de la pestaña".'
            : 'Estás grabando SIN el audio de la videollamada: falta tildar "Compartir audio de la pestaña". Cortá la grabación, dale a Grabar de nuevo y tildá esa casilla — si no, no se escucha a los alumnos.',
        );
      }

      // 2. Micrófono del profe (por si comparte "toda la pantalla", que no
      //    captura audio de la llamada). Si lo rechaza, seguimos sin mic.
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamsRef.current.push(mic);
      } catch {
        mic = null;
      }

      // 3. Mezclamos el audio de la pantalla + el del micrófono en una sola
      //    pista con Web Audio.
      const displayAudio = display.getAudioTracks();
      const micAudio = mic?.getAudioTracks() ?? [];
      let mixedAudioTrack: MediaStreamTrack | null = null;

      if (displayAudio.length && micAudio.length) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(new MediaStream([displayAudio[0]])).connect(dest);
        ctx.createMediaStreamSource(new MediaStream([micAudio[0]])).connect(dest);
        mixedAudioTrack = dest.stream.getAudioTracks()[0];
      } else {
        mixedAudioTrack = displayAudio[0] || micAudio[0] || null;
      }

      const recordStream = new MediaStream([
        display.getVideoTracks()[0],
        ...(mixedAudioTrack ? [mixedAudioTrack] : []),
      ]);

      // Si el profe corta el "compartir pantalla" desde el navegador, paramos.
      display.getVideoTracks()[0].addEventListener("ended", () => stop());

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        chunksRef.current = [];
        cleanup();
        setStatus("idle");
        setWarning(null);
        setDurationSec(0);
        if (blob.size > 0) download(blob);
      };
      rec.onerror = () => {
        setError("Se cortó la grabación por un error del navegador.");
        setStatus("error");
        cleanup();
      };

      rec.start(5_000); // junta datos en trozos de 5s por si algo falla
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setDurationSec(0);
      timerRef.current = window.setInterval(
        () => setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000)),
        1_000,
      );
      setStatus("recording");
    } catch (e) {
      cleanup();
      // El profe canceló el diálogo de "compartir pantalla" -> no es un error real.
      if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        setStatus("idle");
        return;
      }
      setError("No se pudo iniciar la grabación de pantalla.");
      setStatus("error");
    }
  }, [cleanup, download, stop]);

  // Al desmontar, cortamos todo (y descargamos lo que haya).
  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      else cleanup();
    };
  }, [cleanup]);

  return { status, error, warning, durationSec, start, stop, isRecording: status === "recording" };
};
