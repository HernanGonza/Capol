// Cantidad de días antes del vencimiento en los que mostramos
// el aviso de renovación.
export const DIAS_AVISO_PREVIO = 4;

export const estaVencido = (
  finEn: string | null | undefined,
  ahora: Date = new Date()
) => !!finEn && new Date(finEn) <= ahora;

export const estaPorVencer = (
  finEn: string | null | undefined,
  ahora: Date = new Date()
) => {
  if (!finEn) return false;

  const diasRestantes =
    (new Date(finEn).getTime() - ahora.getTime()) /
    (1000 * 60 * 60 * 24);

  return diasRestantes >= 0 && diasRestantes <= DIAS_AVISO_PREVIO;
};

export type EstadoSuscripcionDisplay =
  | "activa"
  | "pago_pendiente"
  | "vencida"
  | "cancelada";

export const estadoSuscripcionDisplay = (
  sub: {
    estado: string | null;
    fin_en: string | null;
  },
  ahora: Date = new Date()
): EstadoSuscripcionDisplay => {
  if (sub.estado === "cancelled") {
    return "cancelada";
  }

  if (
    sub.estado === "expired" ||
    (sub.estado === "active" && estaVencido(sub.fin_en, ahora))
  ) {
    return "vencida";
  }

  if (sub.estado === "pago_pendiente") {
    return "pago_pendiente";
  }

  return "activa";
};