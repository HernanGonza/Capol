// Separación de los alumnos según en qué punto están con sus cursos, para el
// Panel de Control y Métricas. Sale de la RPC public.progreso_alumnos_cursos()
// (una fila por alumno+curso con una suscripción vigente, con el total de clases
// del curso y cuántas completó).
//
// Estados de un (alumno, curso):
//  - "graduado":    el curso tiene clases y el alumno las completó todas.
//  - "por empezar": curso EN VIVO que todavía no arrancó (estado 'proximamente'
//                   o fecha de inicio futura). Está inscripto pero no cursa.
//  - "cursando":    curso EN VIVO ya en marcha, sin terminar.
//  - "en progreso": curso GRABADO comprado, sin terminar (es a ritmo propio, no
//                   hay cohorte "cursando").
//
// A nivel academia se toma el estado "más avanzado" del alumno: si tiene algún
// curso en vivo en marcha sin terminar es "cursando"; si no, pero tiene un
// grabado sin terminar, es "en progreso"; si solo tiene cursos que no arrancaron,
// "por empezar"; si completó todos, "graduado".

export interface ProgresoAlumnoCurso {
  usuario_id: string;
  curso_id: string;
  curso_titulo: string;
  curso_modalidad: "en_vivo" | "grabado";
  curso_estado: "proximamente" | "activo" | "finalizado";
  curso_fecha_inicio: string | null;
  estado_suscripcion: string;
  total_clases: number;
  clases_completadas: number;
}

export const cursoCompletado = (r: ProgresoAlumnoCurso): boolean =>
  r.total_clases > 0 && r.clases_completadas >= r.total_clases;

// Un curso EN VIVO está "en marcha" si ya llegó su fecha de inicio configurada.
// Si no tiene fecha, se cae al estado (todo menos 'proximamente' cuenta como
// iniciado). Los grabados no tienen "en marcha" — se cursan apenas se compran.
export const cursoEnVivoEnMarcha = (r: ProgresoAlumnoCurso): boolean => {
  if (r.curso_modalidad !== "en_vivo") return false;
  if (r.curso_fecha_inicio) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return new Date(`${r.curso_fecha_inicio}T00:00:00`) <= hoy;
  }
  return r.curso_estado !== "proximamente";
};

type EstadoAlumnoCurso = "graduado" | "cursando" | "en_progreso" | "por_empezar";

const estadoDe = (r: ProgresoAlumnoCurso): EstadoAlumnoCurso => {
  if (cursoCompletado(r)) return "graduado";
  if (r.curso_modalidad === "grabado") return "en_progreso";
  return cursoEnVivoEnMarcha(r) ? "cursando" : "por_empezar";
};

export interface ResumenPorCurso {
  cursoId: string;
  titulo: string;
  modalidad: "en_vivo" | "grabado";
  enMarcha: boolean;
  porEmpezar: number;
  actuales: number;
  enProgreso: number;
  graduados: number;
  total: number;
}

export interface ResumenAlumnos {
  /** Alumnos distintos con al menos un curso vigente. */
  totalConCurso: number;
  /** Personas distintas con algún curso en vivo en marcha sin terminar. */
  cursando: number;
  /** Personas distintas cuyo avance más adelantado es un grabado sin terminar. */
  enProgreso: number;
  /** Personas distintas que solo tienen cursos que todavía no arrancaron. */
  porEmpezar: number;
  /** Personas distintas que completaron todos sus cursos. */
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
        enMarcha: r.curso_modalidad === "grabado" || cursoEnVivoEnMarcha(r),
        porEmpezar: 0,
        actuales: 0,
        enProgreso: 0,
        graduados: 0,
        total: 0,
      };
    entry.total += 1;
    switch (estadoDe(r)) {
      case "graduado":
        entry.graduados += 1;
        break;
      case "cursando":
        entry.actuales += 1;
        break;
      case "en_progreso":
        entry.enProgreso += 1;
        break;
      case "por_empezar":
        entry.porEmpezar += 1;
        break;
    }
    porCursoMap.set(r.curso_id, entry);
  }
  const porCurso = Array.from(porCursoMap.values()).sort(
    (a, b) => b.total - a.total || a.titulo.localeCompare(b.titulo)
  );

  // Por alumno (para los totales de la academia): el estado más avanzado.
  const porAlumno = new Map<
    string,
    { total: number; graduados: number; cursando: number; enProgreso: number }
  >();
  for (const r of rows) {
    const entry =
      porAlumno.get(r.usuario_id) || { total: 0, graduados: 0, cursando: 0, enProgreso: 0 };
    entry.total += 1;
    const e = estadoDe(r);
    if (e === "graduado") entry.graduados += 1;
    else if (e === "cursando") entry.cursando += 1;
    else if (e === "en_progreso") entry.enProgreso += 1;
    porAlumno.set(r.usuario_id, entry);
  }

  let cursando = 0;
  let enProgreso = 0;
  let porEmpezar = 0;
  let graduados = 0;
  for (const a of porAlumno.values()) {
    if (a.total > 0 && a.graduados >= a.total) graduados += 1;
    else if (a.cursando > 0) cursando += 1;
    else if (a.enProgreso > 0) enProgreso += 1;
    else porEmpezar += 1;
  }

  return {
    totalConCurso: porAlumno.size,
    cursando,
    enProgreso,
    porEmpezar,
    graduados,
    porCurso,
  };
};
