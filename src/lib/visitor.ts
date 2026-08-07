// ID anónimo de visitante, generado una vez por navegador y guardado en
// localStorage. No identifica a una persona (se resetea si borra los
// datos del sitio o entra en modo incógnito) — solo sirve para poder
// distinguir "una sola visita recargando la página muchas veces" de
// "muchos visitantes distintos", útil para el monitoreo de seguridad
// (detectar ráfagas de visitas).
const VISITOR_ID_KEY = "capol_visitor_id_v1";

export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    // localStorage puede fallar (modo privado, cuota llena, etc.) — devolvemos
    // un id efímero (no persiste, pero no rompe el registro de la visita).
    return crypto.randomUUID();
  }
}
