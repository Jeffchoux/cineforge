import type { Scene, SceneType, Storyboard } from "@/lib/engine";

// --- Logique pure extraite de PreviewPlayer / ExportPanel ---------------------
// Isolée ici pour être testable sans monter les composants React (pas de DOM
// ni de dépendance de test lourde) : voir tests/unit/studio-ui.test.ts.

/**
 * Échelle d'affichage du stage : borne la largeur au conteneur ET la hauteur à
 * `maxStageHeight`. Retourne 0 tant que le conteneur n'est pas mesuré.
 */
export function computeStageScale(
  containerWidth: number,
  width: number,
  height: number,
  maxStageHeight: number,
): number {
  if (containerWidth <= 0) return 0;
  return Math.min(containerWidth / width, maxStageHeight / height);
}

/** Borne un temps de lecture dans [0, duration]. */
export function clampTime(t: number, duration: number): number {
  return Math.max(0, Math.min(t, duration));
}

/** Index de la scène active à l'instant `time` (-1 si aucune). */
export function activeSceneIndex(scenes: Pick<Scene, "start" | "duration">[], time: number): number {
  return scenes.findIndex((s) => time >= s.start && time < s.start + s.duration);
}

/**
 * Instant cible d'une navigation « scène précédente/suivante ». `offset` vaut
 * -1 ou +1. Retourne le `start` de la scène cible (+ epsilon pour tomber dans
 * la scène et non sur sa frontière), ou `null` s'il n'y a pas de scène.
 */
export function sceneNavTarget(
  scenes: Pick<Scene, "start">[],
  currentIndex: number,
  offset: number,
): number | null {
  if (scenes.length === 0) return null;
  const from = currentIndex === -1 ? scenes.length - 1 : currentIndex;
  const target = scenes[Math.max(0, Math.min(scenes.length - 1, from + offset))];
  return target ? target.start + 0.01 : null;
}

/** Commande CLI de rendu MP4 affichée dans le panneau d'export. */
export function renderCommandFor(slug: string): string {
  return `npm run render -- --storyboard ${slug}.json`;
}

/**
 * Recale les `start` en cascade après édition des durées :
 * les scènes s'enchaînent sans trou, la durée totale suit.
 */
export function retimeScenes(storyboard: Storyboard): Storyboard {
  let cursor = 0;
  const scenes = storyboard.scenes.map((scene) => {
    const next = { ...scene, start: round2(cursor) };
    cursor += scene.duration;
    return next;
  });
  return { ...storyboard, scenes, durationSec: round2(cursor) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "cineforge-video"
  );
}

/** `72.4` → `1:12,4` */
export function formatTime(t: number): string {
  const minutes = Math.floor(t / 60);
  const seconds = t - minutes * 60;
  const sec = seconds.toFixed(1).replace(".", ",");
  return `${minutes}:${seconds < 10 ? "0" : ""}${sec}`;
}

export const SCENE_TYPE_META: Record<
  SceneType,
  { label: string; badge: string; segment: string }
> = {
  hook: {
    label: "Accroche",
    badge: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30",
    segment: "bg-indigo-400",
  },
  metaphor: {
    label: "Métaphore",
    badge: "bg-sky-500/20 text-sky-300 border-sky-400/30",
    segment: "bg-sky-400",
  },
  stat: {
    label: "Chiffre",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    segment: "bg-emerald-400",
  },
  steps: {
    label: "Étapes",
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    segment: "bg-amber-400",
  },
  comparison: {
    label: "Comparaison",
    badge: "bg-rose-500/20 text-rose-300 border-rose-400/30",
    segment: "bg-rose-400",
  },
  quote: {
    label: "Citation",
    badge: "bg-violet-500/20 text-violet-300 border-violet-400/30",
    segment: "bg-violet-400",
  },
  cta: {
    label: "Appel à l'action",
    badge: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/30",
    segment: "bg-fuchsia-400",
  },
};

export const VIBE_LABELS: Record<string, string> = {
  cinematic: "Cinématique",
  minimal: "Minimal",
  energetic: "Énergique",
  techy: "Tech",
  warm: "Chaleureux",
};

export const METAPHOR_VISUAL_LABELS: Record<string, string> = {
  battery: "Batterie",
  orbit: "Orbite",
  growth: "Croissance",
  pulse: "Pulsation",
  network: "Réseau",
};

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
