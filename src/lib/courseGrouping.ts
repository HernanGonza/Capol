export interface CursoClasificable {
  id: string;
  grupo_id: string | null;
  estado: "proximamente" | "activo" | "finalizado";
  modalidad: "en_vivo" | "grabado";
  fecha_fin: string | null;
}

export interface Clasificacion<C> {
  enVivo: C[];
  grabado: C[];
  finalizado: C[];
}

// Separa el catálogo en 3 secciones (en vivo / grabado / finalizado).
//
// Los cursos en vivo pueden tener varias "ediciones" (copias) agrupadas por
// grupo_id — de cada grupo se muestra una sola tarjeta, priorizando la
// edición "Próximamente" (a la que se puede inscribir), después "Activo"
// (cursando ahora), y si todas las ediciones ya terminaron, la más reciente
// "Finalizado" como referencia.
//
// Los cursos grabados NUNCA se agrupan entre sí: no son "ediciones" de una
// misma cursada, así que un curso grabado y una edición en vivo del mismo
// grupo_id tienen que poder mostrarse (y comprarse) los dos a la vez.
export function clasificarCursos<C extends CursoClasificable>(cursos: C[]): Clasificacion<C> {
  const enVivo: C[] = [];
  const grabado: C[] = [];
  const finalizado: C[] = [];

  for (const c of cursos) {
    if (c.modalidad === "grabado") {
      (c.estado === "finalizado" ? finalizado : grabado).push(c);
    }
  }

  const porGrupo = new Map<string, C[]>();
  for (const c of cursos) {
    if (c.modalidad !== "en_vivo") continue;
    const key = c.grupo_id || c.id;
    if (!porGrupo.has(key)) porGrupo.set(key, []);
    porGrupo.get(key)!.push(c);
  }
  for (const ediciones of porGrupo.values()) {
    const proxima = ediciones.find((c) => c.estado === "proximamente");
    if (proxima) {
      enVivo.push(proxima);
      continue;
    }
    const activo = ediciones.find((c) => c.estado === "activo");
    if (activo) {
      enVivo.push(activo);
      continue;
    }
    finalizado.push([...ediciones].sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""))[0]);
  }

  const prioridadEstado: Record<CursoClasificable["estado"], number> = { proximamente: 0, activo: 1, finalizado: 2 };
  enVivo.sort((a, b) => prioridadEstado[a.estado] - prioridadEstado[b.estado]);
  finalizado.sort((a, b) => (b.fecha_fin || "").localeCompare(a.fecha_fin || ""));

  return { enVivo, grabado, finalizado };
}
