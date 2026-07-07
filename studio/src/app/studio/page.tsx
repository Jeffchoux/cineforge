import type { Metadata } from "next";
import { StudioApp } from "@/components/studio/StudioApp";

export const metadata: Metadata = {
  title: "CineForge Studio — créez votre vidéo",
  description:
    "Décrivez votre vidéo en une phrase : CineForge génère le storyboard, la preview et l'export MP4 — gratuit, local, sans boîte noire.",
};

export default function StudioPage() {
  return <StudioApp />;
}
