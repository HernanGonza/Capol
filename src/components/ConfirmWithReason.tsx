import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  // Si es true, no se puede confirmar sin escribir un motivo.
  motivoRequerido?: boolean;
  motivoLabel?: string;
  motivoPlaceholder?: string;
  loading?: boolean;
  onConfirm: (motivo: string) => void;
}

// Confirmación + campo de motivo/comentario para acciones de administración
// (rechazos, bajas, pausas, pagos...). El motivo queda en la bitácora
// movimientos_admin para poder medirlo después.
const ConfirmWithReason = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  motivoRequerido = false,
  motivoLabel = "Motivo",
  motivoPlaceholder = "Escribí el motivo (queda registrado, uso interno)",
  loading = false,
  onConfirm,
}: Props) => {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const faltaMotivo = motivoRequerido && !motivo.trim();

  return (
    <AlertDialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">
            {motivoLabel} {motivoRequerido ? "" : "(opcional)"}
          </Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={motivoPlaceholder}
            rows={3}
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || faltaMotivo}
            className={cn(destructive && "bg-destructive hover:bg-destructive/90 text-destructive-foreground")}
            onClick={(e) => {
              e.preventDefault();
              if (faltaMotivo || loading) return;
              onConfirm(motivo.trim());
            }}
          >
            {loading ? "Guardando…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmWithReason;
