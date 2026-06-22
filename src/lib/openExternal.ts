/**
 * Apertura de links externos para la webapp (WhatsApp / teléfono).
 * Versión web del openExternal del desktop (que usa el plugin de Tauri):
 * acá simplemente usamos window.open / location.
 */

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function openWhatsApp(phone: string, text?: string): void {
  const p = digits(phone);
  if (!p) return;
  const url = `https://wa.me/${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openTel(phone: string): void {
  const p = phone.replace(/[^\d+]/g, "");
  if (!p) return;
  window.location.href = `tel:${p}`;
}

export function openMail(email: string): void {
  if (!email) return;
  window.location.href = `mailto:${email}`;
}

/** Normaliza un usuario de Instagram: saca @, espacios y el prefijo de URL. */
export function instagramHandle(value: string): string {
  return value
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .trim();
}

export function openInstagram(value: string): void {
  const h = instagramHandle(value);
  if (!h) return;
  window.open(`https://instagram.com/${h}`, "_blank", "noopener,noreferrer");
}
