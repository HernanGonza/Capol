import { AlertTriangle, Lock } from "lucide-react";
import type { EstadoPagoCurso } from "@/hooks/use-payment-status";
import { DIA_LIMITE_PAGO } from "@/lib/paymentCutoff";

// Aviso persistente (visible en todas las páginas, ver AppLayout) para que
// el alumno se entere de que tiene que pagar antes del día 10, y para que
// sepa a qué cursos ya se les cortó el acceso por no haber pagado a tiempo.
const PaymentDueBanner = ({ items }: { items: EstadoPagoCurso[] }) => {
  const bloqueados = items.filter((i) => i.bloqueado);
  const porVencer = items.filter((i) => i.porVencer);
  if (!bloqueados.length && !porVencer.length) return null;

  return (
    <div className="shrink-0 flex flex-col gap-1.5 px-4 pt-3 md:px-6 lg:px-8">
      {bloqueados.length > 0 && (
        <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-xs font-semibold">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Acceso bloqueado por falta de pago en {bloqueados.map((c) => c.cursoTitulo).join(", ")}.
            Regularizá el pago con administración para recuperarlo.
          </span>
        </div>
      )}
      {porVencer.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2.5 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Si no pagás antes del día {DIA_LIMITE_PAGO}, se va a desactivar tu acceso a{" "}
            {porVencer.map((c) => c.cursoTitulo).join(", ")}.
          </span>
        </div>
      )}
    </div>
  );
};

export default PaymentDueBanner;
