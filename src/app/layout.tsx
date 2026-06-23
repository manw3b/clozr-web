import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Garantiza el meta viewport (este Next no lo inyecta solo). Sin esto, el
// celular renderiza a ~980px y la app cae al layout de escritorio.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E11D48",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://clozr.online"),
  title: "Clozr — El sistema operativo para tu negocio",
  description:
    "Dejá el Excel. Clientes, ventas, caja e inventario en un solo lugar. En español, hecho en LATAM con calidad internacional.",
  openGraph: {
    title: "Clozr — El sistema operativo para tu negocio",
    description:
      "Dejá el Excel. Cerrá más ventas. Clientes, ventas, caja e inventario en un solo lugar.",
    url: "https://clozr.online",
    siteName: "Clozr",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clozr — El sistema operativo para tu negocio",
    description: "Dejá el Excel. Cerrá más ventas. Tu negocio en un solo lugar.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
