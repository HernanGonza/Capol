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

// --- Pago diferido ---------------------------------------------------------
// Una suscripción en "pago_diferido" tiene acceso concedido a mano y una fecha
// que el alumno se comprometió a pagar (pago_diferido_hasta). Cuando esa fecha
// pasa NO se corta el acceso solo: solo sirve de alarma para administración.

export const diferidoVencido = (
  fecha: string | null | undefined,
  ahora: Date = new Date()
) => !!fecha && new Date(fecha) <= ahora;

export const diferidoPorVencer = (
  fecha: string | null | undefined,
  ahora: Date = new Date()
) => {
  if (!fecha) return false;

  const diasRestantes =
    (new Date(fecha).getTime() - ahora.getTime()) /
    (1000 * 60 * 60 * 24);

  return diasRestantes >= 0 && diasRestantes <= DIAS_AVISO_PREVIO;
};

export type EstadoSuscripcionDisplay =
  | "activa"
  | "pago_pendiente"
  | "pago_diferido"
  | "suspendida"
  | "vencida"
  | "cancelada";

export const estadoSuscripcionDisplay = (
  sub: {
    estado: string | null;
    fin_en: string | null;
    suspendida_en?: string | null;
    pago_diferido_hasta?: string | null;
  },
  ahora: Date = new Date()
): EstadoSuscripcionDisplay => {
  if (sub.suspendida_en) {
    return "suspendida";
  }

  if (sub.estado === "cancelled") {
    return "cancelada";
  }

  // El pago diferido no se degrada a "vencida" aunque pase la fecha: el acceso
  // sigue hasta que administración lo suspenda a mano.
  if (sub.estado === "pago_diferido") {
    return "pago_diferido";
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
