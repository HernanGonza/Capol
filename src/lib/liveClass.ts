// "Terminar Clase" (que pone fecha_fin_clase) es una acción manual del
// profesor — si solo cierra su ventana con "Cerrar Clase" y nunca la
// termina del todo, fecha_fin_clase queda en null para siempre y la
// videollamada le sigue apareciendo disponible al alumno días o semanas
// después. Para que la vista del alumno no dependa de que el profesor se
// acuerde de terminarla, además del cierre explícito tratamos como
// finalizada cualquier clase iniciada hace más de este tiempo (bien por
// encima de la duración real de una clase en vivo).
const MAX_HORAS_CLASE_EN_VIVO = 6;

export function claseEstaFinalizada(
  claseIniciadaEn: string | null | undefined,
  fechaFinClase: string | null | undefined
): boolean {
  if (fechaFinClase && new Date(fechaFinClase) <= new Date()) return true;
  if (!claseIniciadaEn) return false;
  const horasDesdeInicio = (Date.now() - new Date(claseIniciadaEn).getTime()) / 3_600_000;
  return horasDesdeInicio > MAX_HORAS_CLASE_EN_VIVO;
}
