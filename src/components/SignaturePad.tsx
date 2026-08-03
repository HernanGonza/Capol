import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

interface Props {
  onSave: (file: File) => void;
  saving?: boolean;
}

// Firma dibujada a mano con el mouse/dedo (pointer events cubre mouse, touch
// y stylus con una sola API) — sin librerías externas, mismo criterio que
// Terminal.tsx para todo lo interactivo de esta app.
const SignaturePad = ({ onSave, saving }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e1b3a";
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // El canvas tiene resolución interna fija (500x180) pero se renderiza a
    // w-full, así que su tamaño en pantalla casi nunca coincide 1:1 con eso
    // — hay que escalar el punto del puntero a la resolución interna, sino
    // el trazo queda desplazado/deformado en cualquier ancho != 500px.
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    setIsEmpty(false);
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const save = () => {
    canvasRef.current!.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], "firma.png", { type: "image/png" }));
    }, "image/png");
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full h-[180px] bg-white rounded-xl border-2 border-dashed border-border touch-none cursor-crosshair"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Eraser className="w-3.5 h-3.5 mr-2" /> Limpiar
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={isEmpty || saving}>
          {saving ? "Guardando..." : "Guardar firma"}
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
