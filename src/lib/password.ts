// Reglas de fortaleza compartidas entre el registro (Auth.tsx) y el cambio
// de contraseña (Profile.tsx) — mismo criterio en los dos lugares.
export const passwordChecks = (pw: string) => [
  { label: "Al menos 8 caracteres", ok: pw.length >= 8 },
  { label: "Una mayúscula", ok: /[A-Z]/.test(pw) },
  { label: "Un número", ok: /[0-9]/.test(pw) },
  { label: "Un carácter especial", ok: /[^A-Za-z0-9]/.test(pw) },
];
