import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "CineForge Studio — Décrivez. Générez. Diffusez.",
    template: "%s — CineForge Studio",
  },
  description:
    "Le studio vidéo IA open-source : une phrase devient une vidéo professionnelle, rendue depuis du HTML animé. Storyboard éditable, preview instantanée, export MP4 — sans timeline, sans crédits.",
  keywords: [
    "vidéo IA",
    "génération vidéo",
    "HyperFrames",
    "studio vidéo",
    "HTML vers vidéo",
    "open source",
  ],
  openGraph: {
    title: "CineForge Studio",
    description:
      "Une phrase → une vidéo professionnelle. Storyboard éditable, preview instantanée, export MP4.",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
