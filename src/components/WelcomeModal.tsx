import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  nombre?: string | null;
  onClose: () => void;
}

// Se muestra una sola vez por usuario, antes del tour de driver.js (ver
// AppLayout: solo arranca el tour una vez que este modal ya se cerró).
const WelcomeModal = ({ open, nombre, onClose }: Props) => {
  const primerNombre = nombre?.trim().split(" ")[0];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md text-center" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center space-y-4">
          <div className="w-14 h-14 rounded-full shadow-sm flex items-center justify-center overflow-hidden">
            <img src="/logo-capol.webp" alt="Logo CapOL" className="w-full h-full object-cover" />
          </div>
          <DialogTitle className="text-xl">
            {primerNombre ? `¡Bienvenido/a, ${primerNombre}!` : "¡Bienvenido/a a CapOL!"}
          </DialogTitle>
          <DialogDescription className="text-center">
            Nos alegra tenerte en la plataforma. Acá vas a encontrar tus cursos, clases en vivo y grabadas, y todo el contacto con tus profesores y compañeros. Te mostramos rápido cómo moverte.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onClose} className="gradient-primary text-primary-foreground font-bold w-full sm:w-auto px-8">
            Empezar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
