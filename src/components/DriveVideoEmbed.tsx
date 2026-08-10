import { useEffect, useRef, useState } from "react";

const DRIVE_BASE_WIDTH = 640;
const DRIVE_BASE_HEIGHT = 480;

interface Props {
  src: string;
}

// El visor de Google Drive no es un reproductor "responsive": es la misma
// interfaz que se ve al abrir un archivo en Drive (con su barra de
// controles), pensada para el tamaño que Google usa en su embed oficial
// (640x480). Si el iframe se renderiza más chico que eso, esa interfaz no se
// reacomoda: los controles quedan tapados por el propio borde del iframe
// (abajo, a la derecha, o ambos) en vez de encogerse. Para evitarlo,
// renderizamos el iframe siempre a 640x480 y lo escalamos con CSS al ancho
// real disponible, así Drive "ve" siempre su tamaño de referencia.
const DriveVideoEmbed = ({ src }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.offsetWidth / DRIVE_BASE_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: DRIVE_BASE_HEIGHT * scale }}
    >
      <div
        style={{
          width: DRIVE_BASE_WIDTH,
          height: DRIVE_BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <iframe
          src={src}
          width={DRIVE_BASE_WIDTH}
          height={DRIVE_BASE_HEIGHT}
          allowFullScreen
          allow="autoplay; encrypted-media"
        />
        {/* Tapa el ícono de "abrir en ventana nueva" que Drive dibuja en la
            esquina: al ser contenido de otro origen no se puede quitar, así
            que lo cubrimos y bloqueamos el click ahí. */}
        <div className="absolute top-0 right-0 w-14 h-14" />
      </div>
    </div>
  );
};

export default DriveVideoEmbed;
