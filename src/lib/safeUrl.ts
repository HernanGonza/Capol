// Antes de usar una URL que vino de datos (no del código fuente) como href
// de un link o src de un iframe, hay que confirmar que sea http/https.
// Sin este chequeo, alguien podría guardar "javascript:..." en un campo
// como el link de entrega de un trabajo final (la validación del formulario
// es solo del lado del cliente, evitable llamando a la API directo) y ese
// código se ejecutaría en el navegador de quien haga click — por ejemplo el
// profesor revisando entregas, con su propia sesión.
export const isSafeUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};
