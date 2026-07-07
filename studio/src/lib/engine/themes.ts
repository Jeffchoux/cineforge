import type { Theme, ThemeId, Vibe } from "./types";

export const THEMES: Record<ThemeId, Theme> = {
  midnight: {
    id: "midnight",
    name: "Midnight",
    bg: "radial-gradient(ellipse at 30% 20%, #131a3d 0%, #05070f 70%)",
    ink: "#f8fafc",
    muted: "#94a3b8",
    accent: "#818cf8",
    accent2: "#38bdf8",
    cardBg: "rgba(255,255,255,0.05)",
    cardBorder: "rgba(255,255,255,0.12)",
    fontHead: "'Sora', 'Archivo', -apple-system, 'Segoe UI', sans-serif",
    fontBody: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    fontLink:
      "https://fonts.googleapis.com/css2?family=Sora:wght@600;800&family=Inter:wght@400;600&display=swap",
    radius: 2.2,
  },
  paper: {
    id: "paper",
    name: "Paper",
    bg: "radial-gradient(ellipse at 50% 0%, #ffffff 0%, #f2f4f9 55%, #e7ebf4 100%)",
    ink: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
    accent2: "#38bdf8",
    cardBg: "#ffffff",
    cardBorder: "rgba(15,23,42,0.08)",
    fontHead: "'Archivo', 'Sora', -apple-system, 'Segoe UI', sans-serif",
    fontBody: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    fontLink:
      "https://fonts.googleapis.com/css2?family=Archivo:wght@600;900&family=Inter:wght@400;600&display=swap",
    radius: 2.2,
  },
  neon: {
    id: "neon",
    name: "Neon",
    bg: "radial-gradient(ellipse at 70% 10%, #1a0b2e 0%, #090014 65%)",
    ink: "#fdf4ff",
    muted: "#a78bca",
    accent: "#e879f9",
    accent2: "#22d3ee",
    cardBg: "rgba(232,121,249,0.06)",
    cardBorder: "rgba(232,121,249,0.25)",
    fontHead: "'Space Grotesk', 'Sora', -apple-system, sans-serif",
    fontBody: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    fontLink:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600&display=swap",
    radius: 1.4,
  },
  broadcast: {
    id: "broadcast",
    name: "Broadcast",
    bg: "linear-gradient(160deg, #101418 0%, #1c2530 100%)",
    ink: "#f1f5f9",
    muted: "#8ea3b5",
    accent: "#f59e0b",
    accent2: "#ef4444",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.14)",
    fontHead: "'Archivo', -apple-system, 'Segoe UI', sans-serif",
    fontBody: "'Inter', -apple-system, 'Segoe UI', sans-serif",
    fontLink:
      "https://fonts.googleapis.com/css2?family=Archivo:wght@700;900&family=Inter:wght@400;600&display=swap",
    radius: 0.8,
  },
  pastel: {
    id: "pastel",
    name: "Pastel",
    bg: "linear-gradient(180deg, #fdf6f0 0%, #f4ecfb 55%, #e8f4f8 100%)",
    ink: "#3b2f4a",
    muted: "#8d80a0",
    accent: "#8b5cf6",
    accent2: "#f472b6",
    cardBg: "#ffffff",
    cardBorder: "rgba(59,47,74,0.08)",
    fontHead: "'Outfit', 'Sora', -apple-system, sans-serif",
    fontBody: "'Outfit', -apple-system, 'Segoe UI', sans-serif",
    fontLink:
      "https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap",
    radius: 3,
  },
};

/** Thème par défaut selon la vibe demandée. */
export const VIBE_THEME: Record<Vibe, ThemeId> = {
  cinematic: "midnight",
  minimal: "paper",
  energetic: "neon",
  techy: "broadcast",
  warm: "pastel",
};

export function resolveTheme(themeId: ThemeId | undefined, vibe: Vibe): Theme {
  return THEMES[themeId ?? VIBE_THEME[vibe]];
}
