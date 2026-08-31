import { AlertTriangle, Lock, CalendarClock } from "lucide-react";
import type { EstadoPagoCurso } from "@/hooks/use-payment-status";
import { diferidoVencido } from "@/lib/paymentCutoff";

// Aviso persistente (visible en todas las páginas, ver AppLayout) para que
// el alumno se entere de que se le vence la suscripción, de los pagos que se
// comprometió a hacer, y de a qué cursos ya se les cortó el acceso.
const PaymentDueBanner = ({ items }: { items: EstadoPagoCurso[] }) => {
  const suspendidos = items.filter((i) => i.suspendida);
  const bloqueados = items.filter((i) => i.bloqueado && !i.suspendida);
  const porVencer = items.filter((i) => i.porVencer);
  const diferidos = items.filter((i) => i.esDiferido && !i.suspendida);

  if (
    !suspendidos.length &&
    !bloqueados.length &&
    !porVencer.length &&
    !diferidos.length
  )
    return null;

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("es-AR") : "";

  return (
    <div className="shrink-0 flex flex-col gap-1.5 px-4 pt-3 md:px-6 lg:px-8">
      {suspendidos.length > 0 && (
        <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-xs font-semibold">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Acceso suspendido en {suspendidos.map((c) => c.cursoTitulo).join(", ")}.
            Contactate con administración para reactivarlo.
          </span>
        </div>
      )}
      {bloqueados.length > 0 && (
        <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-xl px-4 py-2.5 text-xs font-semibold">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Acceso bloqueado por falta de pago en {bloqueados.map((c) => c.cursoTitulo).join(", ")}.
            Regularizá el pago con administración para recuperarlo.
          </span>
        </div>
      )}
      {diferidos.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2.5 text-xs font-semibold">
          <CalendarClock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {diferidos.map((c, i) => (
              <span key={c.cursoId}>
                {i > 0 && " · "}
                {c.cursoTitulo}: te comprometiste a pagar{" "}
                {diferidoVencido(c.diferidoHasta) ? "el" : "antes del"}{" "}
                {fmt(c.diferidoHasta)}
                {diferidoVencido(c.diferidoHasta) ? " (fecha vencida)" : ""}
              </span>
            ))}
            . Regularizá el pago con administración para no perder el acceso.
          </span>
        </div>
      )}
      {porVencer.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2.5 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Tu suscripción está por vencer — regularizá el pago con administración para no perder el acceso a{" "}
            {porVencer.map((c) => c.cursoTitulo).join(", ")}.
          </span>
        </div>
      )}
    </div>
  );
};

export default PaymentDueBanner;
