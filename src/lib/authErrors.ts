// Los errores de Supabase Auth siempre vienen en inglés, sin importar el
// idioma del usuario ("User already registered", "Invalid login
// credentials", etc.) — esto los traduce a mensajes en español que tengan
// sentido para un alumno, en vez de mostrar error.message crudo en el
// toast. Se usa "error.code" (estable entre versiones del SDK) como
// primera opción, y el texto del mensaje como respaldo para los casos que
// no traen code (por ejemplo errores de red).
const MENSAJE_POR_CODIGO: Record<string, string> = {
  user_already_exists: "Ya existe una cuenta registrada con ese email. Probá iniciar sesión, o recuperar tu contraseña si no la recordás.",
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed: "Todavía no confirmaste tu cuenta — revisá el mail que te mandamos (y la carpeta de spam).",
  user_banned: "Esta cuenta está bloqueada. Contactanos si creés que es un error.",
  weak_password: "La contraseña es demasiado débil. Probá con una más larga, combinando letras, números y símbolos.",
  same_password: "La nueva contraseña tiene que ser distinta a la actual.",
  over_email_send_rate_limit: "Ya te mandamos un mail hace poco — esperá unos minutos antes de volver a intentar.",
  over_request_rate_limit: "Demasiados intentos. Esperá un momento y volvé a intentar.",
  email_address_invalid: "Ese email no es válido.",
  signup_disabled: "El registro de cuentas nuevas está deshabilitado por ahora.",
  session_not_found: "Tu sesión expiró. Volvé a iniciar sesión.",
  validation_failed: "Revisá los datos cargados, algo no es válido.",
};

const MENSAJE_POR_TEXTO: [RegExp, string][] = [
  [/user already registered|already registered/i, MENSAJE_POR_CODIGO.user_already_exists],
  [/invalid login credentials/i, MENSAJE_POR_CODIGO.invalid_credentials],
  [/email not confirmed/i, MENSAJE_POR_CODIGO.email_not_confirmed],
  [/password.*(least|weak|short)/i, MENSAJE_POR_CODIGO.weak_password],
  [/rate limit/i, MENSAJE_POR_CODIGO.over_request_rate_limit],
  [/failed to fetch|network/i, "No se pudo conectar. Revisá tu conexión a internet e intentá de nuevo."],
];

export function traducirErrorAuth(error: any): string {
  const code = error?.code as string | undefined;
  if (code && MENSAJE_POR_CODIGO[code]) return MENSAJE_POR_CODIGO[code];

  const message = (error?.message || "") as string;
  for (const [regex, mensaje] of MENSAJE_POR_TEXTO) {
    if (regex.test(message)) return mensaje;
  }

  return "Ocurrió un error inesperado. Intentá de nuevo en unos segundos.";
}
