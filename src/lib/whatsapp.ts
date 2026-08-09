// wa.me arma solo el link correcto (app en mobile, WhatsApp Web en
// desktop) — el número va sin espacios/guiones/+, con el 9 de celular
// argentino incluido: +54 9 383 447-9734 -> 5493834479734.
export const WHATSAPP_NUMBER = "5493834479734";

export function buildWhatsappLink(message?: string): string {
  return message
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${WHATSAPP_NUMBER}`;
}
