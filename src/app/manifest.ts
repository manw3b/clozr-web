import type { MetadataRoute } from "next";

/** Web App Manifest — habilita "Agregar al inicio" con ícono y nombre de Clozr. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clozr",
    short_name: "Clozr",
    description: "El sistema operativo para tu negocio.",
    start_url: "/app",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#E11D48",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
