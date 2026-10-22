import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const archivoBlack = Archivo_Black({ variable: "--font-archivo-black", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Matvac Auto Detailing",
  description: "Get a price for mobile car detailing by Matvac.",
};

export const viewport: Viewport = { themeColor: "#141a2e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoBlack.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
