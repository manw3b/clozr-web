/**
 * Resolución de imágenes del catálogo template (assets en /public/products/).
 * Portado de clozr/src/lib/templates/productImageMap.ts, adaptado a Next:
 * los archivos viven en public/ y se sirven en su ruta literal, así que no
 * hace falta el glob de Vite — construimos la URL y dejamos que <img> con
 * onError caiga a la imagen del modelo si la variante de color no existe.
 */

const safe = (s: string) => s.replace(/["'().]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_");

export function inferFolder(category: string | undefined, modelName: string): string | null {
  const c = (category ?? "").toLowerCase();
  const m = modelName.toLowerCase();
  if (c === "iphone" || m.includes("iphone")) return "iphones";
  if (c === "ipad" || m.includes("ipad")) return "ipads";
  if (c.includes("watch") || m.includes("watch")) return "watch";
  if (c === "mac" || m.includes("mac")) return "mac";
  if (c.includes("airpod") || m.includes("airpod")) return "airpods";
  return null;
}

/** URL candidata color-aware: /products/<folder>/<Model>_<Color>.jpg */
export function colorImageUrl(
  category: string | undefined,
  modelName: string,
  color: string | null | undefined,
): string | null {
  if (!color) return null;
  const folder = inferFolder(category, modelName);
  if (!folder) return null;
  return `/products/${folder}/${safe(modelName)}_${safe(color)}.jpg`;
}

export function categoryEmoji(category: string | null | undefined): string {
  const c = category?.toLowerCase() ?? "";
  if (c === "iphone") return "📱";
  if (c === "ipad") return "🖥️";
  if (c.includes("watch")) return "⌚";
  if (c === "mac" || c.includes("macbook")) return "💻";
  if (c.includes("airpod")) return "🎧";
  return "📦";
}
