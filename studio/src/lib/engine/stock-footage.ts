import type { AspectRatio, Scene, VideoBackground } from "./types";
import type { Rng } from "./rng";

/**
 * Sélection automatique de fond vidéo réel (stock footage Pexels) par scène.
 *
 * Décision produit (voir PRD-VISUALS.md) : le motion design pur ne suffit plus —
 * chaque scène compatible reçoit en fond une vraie vidéo (humains, lieux, objets
 * réels), choisie par mots-clés dérivés du texte de la scène. Gratuit (API Pexels,
 * tier gratuit), jamais bloquant (repli sur le fond thème existant en cas d'échec).
 *
 * Types de scène concernés : hook, metaphor, steps, quote, cta. `stat` et
 * `comparison` gardent leur fond actuel — leurs chiffres/barres ont besoin d'un
 * fond neutre pour rester lisibles.
 */

const STOPWORDS_FR = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "à", "au", "aux",
  "en", "pour", "par", "sur", "sous", "avec", "sans", "dans", "est", "sont", "c'est",
  "qui", "que", "ce", "cette", "ces", "votre", "vos", "notre", "nos", "plus", "moins",
]);

const STOPWORDS_EN = new Set([
  "the", "a", "an", "and", "or", "of", "to", "for", "by", "on", "in", "is", "are",
  "with", "without", "that", "this", "these", "your", "our", "more", "less",
]);

const VIDEO_ELIGIBLE_TYPES = new Set<Scene["type"]>(["hook", "metaphor", "steps", "quote", "cta"]);

export function isVideoBackgroundEligible(sceneType: Scene["type"]): boolean {
  return VIDEO_ELIGIBLE_TYPES.has(sceneType);
}

/**
 * Texte source d'une scène pour l'extraction de mots-clés (avant tout état
 * IA/édition).
 *
 * `hook` retourne volontairement une chaîne vide : ce titre est écrit pour
 * l'impact marketing (métaphores, superlatifs — "super-pouvoir", "explose",
 * "révolutionne"), pas pour décrire une image filmable. L'inclure dilue la
 * requête vers du contenu hors-sujet (constaté : "super-pouvoir" fait
 * remonter des vidéos de plongeon ou de caméra vintage "super-8", sans
 * rapport avec le sujet réel). `extractKeywords` retombe alors sur le seul
 * sujet du brief, plus fiable pour ce type de scène.
 */
function sceneText(scene: Scene): string {
  switch (scene.type) {
    case "hook":
      return "";
    case "metaphor":
      return `${scene.label} ${scene.caption}`;
    case "steps":
      return scene.title;
    case "quote":
      return scene.text;
    case "cta":
      return scene.title;
    default:
      return "";
  }
}

/**
 * Extrait 2 à 4 mots-clés significatifs du texte de scène + du sujet du brief.
 * Le sujet est toujours inclus en dernier repli : une métaphore abstraite
 * ("réseau", "orbite") n'a pas de sens filmable seule, il faut l'ancrer au
 * sujet réel de la vidéo.
 */
export function extractKeywords(scene: Scene, topic: string, lang: "fr" | "en"): string {
  const stopwords = lang === "fr" ? STOPWORDS_FR : STOPWORDS_EN;
  const clean = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !stopwords.has(w));

  // Le sujet du brief passe en premier : c'est l'ancrage le plus fiable et le
  // plus concret (ex. "sommeil"). Le texte de scène vient en complément — il
  // peut contenir des tournures marketing/abstraites (ex. "super-pouvoir")
  // qui, seules ou en tête de requête, égarent la recherche vidéo vers du
  // contenu hors-sujet (constaté : "super-pouvoir" en tête a fait remonter
  // une vidéo de plongeon). Pexels trie par pertinence : le mot-clé en
  // première position pèse le plus dans le classement des résultats.
  const words = [...clean(topic), ...clean(sceneText(scene))];

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    keywords.push(w);
    if (keywords.length >= 4) break;
  }
  return keywords.length > 0 ? keywords.join(" ") : topic;
}

function pexelsOrientation(aspect: AspectRatio): "landscape" | "portrait" | "square" {
  if (aspect === "16:9") return "landscape";
  if (aspect === "9:16") return "portrait";
  return "square";
}

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
}

interface PexelsVideo {
  id: number;
  user?: { name?: string };
  video_files: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

/** Choisit le meilleur fichier HD disponible pour un clip (évite le 4K inutile en preview). */
function pickVideoFile(video: PexelsVideo): { url: string; width: number; height: number } | null {
  const hd = video.video_files
    .filter((f) => f.quality === "hd" && f.link)
    .sort((a, b) => b.width - a.width);
  const best = hd[0] ?? video.video_files.find((f) => f.link);
  if (!best) return null;
  return { url: best.link, width: best.width, height: best.height };
}

export interface StockFootageProvider {
  search(query: string, orientation: "landscape" | "portrait" | "square"): Promise<VideoBackground[]>;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — aligné sur la fenêtre de quota Pexels (200 req/h).
const searchCache = new Map<string, { results: VideoBackground[]; expiresAt: number }>();

/**
 * Cache en mémoire par requête+orientation, pour ne pas ré-interroger Pexels à
 * chaque preview/recompile d'un même storyboard et rester sous le quota gratuit
 * (200 req/h, 20 000/mois). Best-effort par instance — pas de garantie multi-
 * instances en V1 (même limite assumée que le rate-limit mémoire, voir
 * rate-limit.ts) ; un store partagé (KV) serait la suite logique si le volume
 * le justifie.
 */
export function withSearchCache(provider: StockFootageProvider): StockFootageProvider {
  return {
    async search(query, orientation) {
      const key = `${orientation}:${query}`;
      const cached = searchCache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.results;
      const results = await provider.search(query, orientation);
      searchCache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
      if (searchCache.size > 5000) searchCache.clear();
      return results;
    },
  };
}

/** Client Pexels — nécessite `PEXELS_API_KEY` (clé gratuite, pexels.com/api). */
export function createPexelsProvider(apiKey: string): StockFootageProvider {
  return {
    async search(query, orientation) {
      const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=6`;
      const res = await fetch(url, { headers: { Authorization: apiKey } });
      if (!res.ok) throw new Error(`Pexels API ${res.status}`);
      const data = (await res.json()) as PexelsSearchResponse;
      const results: VideoBackground[] = [];
      for (const video of data.videos ?? []) {
        const file = pickVideoFile(video);
        if (!file) continue;
        results.push({
          id: String(video.id),
          url: file.url,
          provider: "pexels",
          credit: video.user?.name,
        });
      }
      return results;
    },
  };
}

/**
 * Nombre de meilleurs résultats parmi lesquels piocher. Pexels trie ses
 * résultats par pertinence décroissante ; sur une requête multi-mots, les
 * derniers résultats de la page peuvent être hors-sujet (le moteur élargit
 * la recherche s'il manque de correspondances exactes — constaté : sur
 * "sommeil super-pouvoir bienfaits profond", le résultat n°3/6 était une
 * vidéo de plongeon sans rapport). Se limiter au wagon de tête garde de la
 * variété (pas toujours le même clip) sans sacrifier la pertinence.
 */
const TOP_CANDIDATES = 2;

/**
 * Résout le fond vidéo d'une scène : cherche des candidats via le provider,
 * choisit déterministiquement parmi les plus pertinents via le RNG seedé du
 * storyboard. Ne throw jamais — un échec (réseau, quota, aucun résultat)
 * retourne `undefined` et la scène retombe sur son fond thème existant.
 */
export async function resolveSceneVideoBackground(
  scene: Scene,
  topic: string,
  lang: "fr" | "en",
  aspect: AspectRatio,
  provider: StockFootageProvider,
  rng: Rng,
): Promise<VideoBackground | undefined> {
  if (!isVideoBackgroundEligible(scene.type)) return undefined;
  try {
    const query = extractKeywords(scene, topic, lang);
    const candidates = await provider.search(query, pexelsOrientation(aspect));
    if (candidates.length === 0) return undefined;
    return rng.pick(candidates.slice(0, TOP_CANDIDATES));
  } catch {
    return undefined;
  }
}
