// Regla de negocio: cada suscripción vence en la fecha que tiene cargada en
// "fin_en" (lo que el admin ve/edita como "Vence Acceso" en el panel de
// Suscripciones — se actualiza sola al usar "Renovar Mes"). Si "fin_en" está
// vacío, todavía no se le asignó vencimiento a esa suscripción y no se
// bloquea. El aviso previo empieza DIAS_AVISO_PREVIO días antes de esa fecha.
export const DIAS_AVISO_PREVIO = 4;

export const estaVencido = (finEn: string | null | undefined, ahora: Date = new Date()) =>
  !!finEn && new Date(finEn) <= ahora;

export const estaPorVencer = (finEn: string | null | undefined, ahora: Date = new Date()) => {
  if (!finEn) return false;
  const diasRestantes = (new Date(finEn).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24);
  return diasRestantes >= 0 && diasRestantes <= DIAS_AVISO_PREVIO;
};

// "pago_pendiente" es un valor real de "estado" (igual que "active"/"expired"/
// "cancelled"), no algo inventado solo para mostrar: da el mismo acceso que
// "active" (RLS, mensajería e inscripción automática lo tratan igual — ver
// migración "agregar_estado_pago_pendiente"), y sirve para marcar una
// suscripción a la que se le habilitó el acceso sin haber cobrado todavía.
//
// Se mueve solo entre los 4 valores según las fechas de la suscripción — ver
// checkAndSyncSubscriptionStatuses en AdminSubscriptions.tsx:
//   active --(pasó proxima_fecha_pago)--> pago_pendiente --(pasó fin_en)--> expired
// y también se puede forzar a mano desde el panel (Estado Manual, o editando
// fin_en/proxima_fecha_pago).
export type EstadoSuscripcionDisplay = "activa" | "pago_pendiente" | "vencida" | "cancelada";

export const estadoSuscripcionDisplay = (
  sub: { estado: string | null; fin_en: string | null },
  ahora: Date = new Date()
): EstadoSuscripcionDisplay => {
  if (sub.estado === "cancelled") return "cancelada";
  // Si fin_en ya pasó pero la fila todavía no se sincronizó (nadie abrió el
  // panel de Suscripciones desde entonces), lo mostramos vencido igual.
  if (sub.estado === "expired" || estaVencido(sub.fin_en, ahora)) return "vencida";
  if (sub.estado === "pago_pendiente") return "pago_pendiente";
  return "activa";
};
