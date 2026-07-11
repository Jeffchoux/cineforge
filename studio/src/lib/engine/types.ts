/**
 * CineForge Engine — types du domaine.
 * Un Brief devient un Storyboard (liste de scènes typées),
 * qui est compilé en composition HTML compatible HyperFrames.
 */

export type AspectRatio = "16:9" | "9:16" | "1:1";
export type Language = "fr" | "en";
export type Vibe = "cinematic" | "minimal" | "energetic" | "techy" | "warm";

export type ThemeId = "midnight" | "paper" | "neon" | "broadcast" | "pastel";

export interface Theme {
  id: ThemeId;
  name: string;
  /** Fond du stage (CSS background) */
  bg: string;
  /** Couleur d'encre principale */
  ink: string;
  /** Couleur atténuée (sous-titres, légendes) */
  muted: string;
  /** Accent principal */
  accent: string;
  /** Accent secondaire (dégradés, fills) */
  accent2: string;
  /** Fond des cartes */
  cardBg: string;
  /** Bordure des cartes */
  cardBorder: string;
  /** Police des titres (stack CSS) */
  fontHead: string;
  /** Police du corps (stack CSS) */
  fontBody: string;
  /** Lien Google Fonts optionnel */
  fontLink?: string;
  /** Rayon des cartes en unités (1 unité = 1% de la plus petite dimension) */
  radius: number;
}

export type MetaphorVisual = "battery" | "orbit" | "growth" | "pulse" | "network";

/**
 * Clip de fond réel (stock footage) attaché à une scène — résolu une fois par
 * le planner/sélecteur et mémorisé dans le storyboard, jamais re-résolu à la
 * compilation (déterminisme : même storyboard = même clip à chaque render).
 */
export interface VideoBackground {
  /** Identifiant du clip chez le fournisseur (pour cache/traçabilité) */
  id: string;
  /** URL directe du fichier vidéo (mp4) */
  url: string;
  /** Fournisseur (whitelist stricte côté sanitize) */
  provider: "pexels";
  /** Nom de l'auteur, pour attribution */
  credit?: string;
}

export interface SceneBase {
  id: string;
  /** Début en secondes (absolu dans la composition) */
  start: number;
  /** Durée en secondes */
  duration: number;
  /** Texte de narration associé (voix off / sous-titre) */
  narration: string;
  /** Fond vidéo réel optionnel (stock footage) — absent = fond thème par défaut */
  videoBackground?: VideoBackground;
}

export interface HookScene extends SceneBase {
  type: "hook";
  title: string;
  /** Mot mis en avant dans la couleur accent (doit apparaître dans title) */
  accentWord?: string;
  kicker?: string;
}

export interface MetaphorScene extends SceneBase {
  type: "metaphor";
  visual: MetaphorVisual;
  label: string;
  caption: string;
}

export interface StatScene extends SceneBase {
  type: "stat";
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

export interface StepsScene extends SceneBase {
  type: "steps";
  title: string;
  items: string[];
}

export interface ComparisonScene extends SceneBase {
  type: "comparison";
  title: string;
  leftLabel: string;
  rightLabel: string;
  /** Valeurs relatives 0–100 pour les barres */
  leftValue: number;
  rightValue: number;
}

export interface QuoteScene extends SceneBase {
  type: "quote";
  text: string;
  author?: string;
}

export interface CtaScene extends SceneBase {
  type: "cta";
  title: string;
  subtitle?: string;
}

export type Scene =
  | HookScene
  | MetaphorScene
  | StatScene
  | StepsScene
  | ComparisonScene
  | QuoteScene
  | CtaScene;

export type SceneType = Scene["type"];

export interface Brief {
  /** Sujet de la vidéo — phrase libre */
  topic: string;
  /** Points clés optionnels (un par beat) */
  points?: string[];
  durationSec: number;
  vibe: Vibe;
  aspect: AspectRatio;
  language: Language;
  themeId?: ThemeId;
  /** Graine du générateur — même brief + même seed = même vidéo */
  seed?: number;
}

export interface Storyboard {
  id: string;
  title: string;
  brief: Brief;
  theme: ThemeId;
  aspect: AspectRatio;
  fps: number;
  width: number;
  height: number;
  durationSec: number;
  scenes: Scene[];
  /** Version du schéma, pour migrations futures */
  version: 1;
}

export interface CompileOptions {
  /** Source de GSAP : CDN épinglé (défaut) ou code inliné fourni */
  gsap?: { mode: "cdn" } | { mode: "inline"; source: string };
  /** Inclure le runtime de contrôle postMessage (preview player) */
  playerRuntime?: boolean;
  /** Afficher la narration en sous-titres (piste dédiée) */
  captions?: boolean;
  /**
   * Charger les polices web distantes (Google Fonts). `false` par défaut :
   * l'artefact reste offline-first (zéro requête réseau, zéro surface CDN) et
   * s'appuie sur les stacks de polices système du thème. Passer `true` pour la
   * preview en ligne du Studio qui veut le rendu exact des polices web.
   */
  remoteFonts?: boolean;
}

export const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export const BRIEF_LIMITS = {
  topicMax: 300,
  pointMax: 160,
  pointsMax: 6,
  durationMin: 6,
  durationMax: 120,
} as const;

/**
 * Bornes des champs de scène, source de vérité UNIQUE partagée par les deux
 * frontières de confiance : la fusion des scènes IA (`mergeAiScenes`, ai.ts)
 * et la validation d'un storyboard importé (`sanitizeStoryboard`,
 * sanitize-storyboard.ts). Les deux chemins normalisent les mêmes champs ;
 * centraliser ces bornes ici garantit qu'elles ne divergent jamais.
 * (Les champs bornés par BRIEF_LIMITS — narration, hook.title, quote.text,
 * comparison.title, metaphor.caption — restent référencés via BRIEF_LIMITS.)
 */
export const SCENE_FIELD_LIMITS = {
  hook: { accentWord: 60, kicker: 40 },
  metaphor: { label: 80 },
  stat: { prefix: 4, suffix: 6, valueMin: 0, valueMax: 1_000_000_000 },
  steps: { title: 80, itemsMax: 3 },
  comparison: { label: 60, valueMin: 0, valueMax: 100, leftDefault: 30, rightDefault: 90 },
  quote: { author: 80 },
  cta: { title: 80, subtitle: 120 },
} as const;
