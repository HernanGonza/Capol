export type Modalidad = "en_vivo" | "grabado";

// Traducción y estilo únicos para la modalidad de un curso. Antes cada pantalla
// resolvía "en vivo" / "grabado" y sus colores a mano.
export const modalidadLabel = (m: Modalidad | string | null | undefined): string =>
  m === "grabado" ? "Grabado" : "En vivo";

export const esGrabado = (m: Modalidad | string | null | undefined): boolean =>
  m === "grabado";

// Clases de color para el badge (pill) según modalidad.
export const modalidadBadgeClass = (m: Modalidad | string | null | undefined): string =>
  esGrabado(m)
    ? "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900"
    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
