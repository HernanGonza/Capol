// Regla de negocio: para seguir teniendo acceso a un curso, hay que registrar
// un pago dentro de cada mes calendario antes del día 10. Si llega el día 11
// y no hay un pago de ese mes, el acceso se bloquea. La regla se resetea
// cada mes: apenas se registra el pago (aunque sea tarde), se recupera el
// acceso hasta el próximo corte.
export const DIA_LIMITE_PAGO = 10;

// Días antes del corte en los que se empieza a avisar (ej: 4 => desde el
// día 6 al 10 se muestra el aviso de vencimiento próximo).
export const DIAS_AVISO_PREVIO = 4;

export const estaVencidoEsteMes = (pagoEsteMes: boolean, ahora: Date = new Date()) =>
  !pagoEsteMes && ahora.getDate() > DIA_LIMITE_PAGO;

export const estaPorVencer = (pagoEsteMes: boolean, ahora: Date = new Date()) => {
  const dia = ahora.getDate();
  return !pagoEsteMes && dia <= DIA_LIMITE_PAGO && dia >= DIA_LIMITE_PAGO - DIAS_AVISO_PREVIO;
};
