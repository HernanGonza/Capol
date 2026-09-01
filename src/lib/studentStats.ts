// Separación "alumnos cursando" vs "graduados", a partir de la RPC
// public.progreso_alumnos_cursos() (una fila por alumno+curso con una
// suscripción vigente, con el total de clases del curso y cuántas completó).
//
// Un (alumno, curso) está "graduado" cuando el curso tiene clases cargadas y
// el alumno las completó todas. Un alumno de la academia es "graduado" cuando
// TODOS sus cursos vigentes están graduados (y tiene al menos uno); si le
// queda alguno sin terminar, está "cursando".

export interface ProgresoAlumnoCurso {
  usuario_id: string;
  curso_id: string;
  curso_titulo: string;
  curso_modalidad: "en_vivo" | "grabado";
  estado_suscripcion: string;
  total_clases: number;
  clases_completadas: number;
}

export const cursoCompletado = (r: ProgresoAlumnoCurso): boolean =>
  r.total_clases > 0 && r.clases_completadas >= r.total_clases;

export interface ResumenPorCurso {
  cursoId: string;
  titulo: string;
  modalidad: "en_vivo" | "grabado";
  actuales: number;
  graduados: number;
  total: number;
}

export interface ResumenAlumnos {
  /** Alumnos distintos con al menos un curso vigente. */
  totalConCurso: number;
  /** De esos, los que tienen algún curso sin terminar. */
  cursando: number;
  /** De esos, los que completaron todos sus cursos. */
  graduados: number;
  porCurso: ResumenPorCurso[];
}

export const resumirProgresoAlumnos = (
  filas: ProgresoAlumnoCurso[] | null | undefined
): ResumenAlumnos => {
  const rows = filas || [];

  // Por curso.
  const porCursoMap = new Map<string, ResumenPorCurso>();
  for (const r of rows) {
    const entry =
      porCursoMap.get(r.curso_id) || {
        cursoId: r.curso_id,
        titulo: r.curso_titulo,
        modalidad: r.curso_modalidad,
        actuales: 0,
        graduados: 0,
        total: 0,
      };
    entry.total += 1;
    if (cursoCompletado(r)) entry.graduados += 1;
    else entry.actuales += 1;
    porCursoMap.set(r.curso_id, entry);
  }
  const porCurso = Array.from(porCursoMap.values()).sort(
    (a, b) => b.total - a.total || a.titulo.localeCompare(b.titulo)
  );

  // Por alumno (para los totales de la academia).
  const porAlumno = new Map<string, { total: number; completos: number }>();
  for (const r of rows) {
    const entry = porAlumno.get(r.usuario_id) || { total: 0, completos: 0 };
    entry.total += 1;
    if (cursoCompletado(r)) entry.completos += 1;
    porAlumno.set(r.usuario_id, entry);
  }

  let cursando = 0;
  let graduados = 0;
  for (const { total, completos } of porAlumno.values()) {
    if (total > 0 && completos >= total) graduados += 1;
    else cursando += 1;
  }

  return {
    totalConCurso: porAlumno.size,
    cursando,
    graduados,
    porCurso,
  };
};
