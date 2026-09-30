import { addMonths, format } from "date-fns";

// Un período financiero "yyyy-MM" va desde el día posterior al corte del mes
// anterior hasta el cierre del día de corte de ese mes. Ningún instante
// pertenece a dos períodos.
export function periodoFinanciero(mes: string, diaCorte: number) {
  const [y, m] = mes.split("-").map(Number);
  const end = new Date(y, m - 1, diaCorte, 23, 59, 59, 999);
  const start = new Date(y, m - 2, diaCorte + 1, 0, 0, 0, 0);
  return { start, end };
}

// Período al que pertenece hoy: pasado el día de corte, ya corre el del mes
// siguiente (con corte 25, el 30/09 es parte de octubre).
export function mesFinancieroActual(diaCorte: number, hoy = new Date()) {
  return format(hoy.getDate() > diaCorte ? addMonths(hoy, 1) : hoy, "yyyy-MM");
}
