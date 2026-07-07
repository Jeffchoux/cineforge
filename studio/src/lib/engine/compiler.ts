import type { CompileOptions, Storyboard } from "./types";
import { THEMES } from "./themes";
import { SCENE_CSS, renderScene } from "./scenes";
import { escapeHtml } from "./escape";

const GSAP_CDN = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";

/**
 * Compile un storyboard en composition HTML autonome, conforme au
 * contrat HyperFrames (`data-composition-id`, clips `data-start` /
 * `data-duration` / `data-track-index`, timeline GSAP en pause
 * enregistrée sur `window.__timelines`).
 */
export function compileStoryboard(storyboard: Storyboard, options: CompileOptions = {}): string {
  const theme = THEMES[storyboard.theme];
  const { width, height, durationSec, fps } = storyboard;
  const unit = Math.min(width, height) / 100;

  const rendered = storyboard.scenes.map((scene) => renderScene(scene));
  const captionsHtml = options.captions ? buildCaptions(storyboard) : "";
  const scenesHtml = rendered.map((r) => r.html).join("\n\n") + captionsHtml;
  const scenesTimeline = rendered.map((r) => r.timeline).join("\n");

  const gsapTag =
    options.gsap?.mode === "inline"
      ? `<script>${options.gsap.source}</script>`
      : `<script src="${GSAP_CDN}"></script>`;

  const fontLink = theme.fontLink
    ? `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="${escapeHtml(theme.fontLink)}" />`
    : "";

  const playerRuntime = options.playerRuntime === false ? "" : buildPlayerRuntime(durationSec);

  return `<!doctype html>
<html lang="${escapeHtml(storyboard.brief.language)}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${width}, height=${height}" />
<title>${escapeHtml(storyboard.title)} — CineForge</title>
${fontLink}
${gsapTag}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
:root {
  --u: ${round3(unit)}px;
  --ink: ${theme.ink};
  --muted: ${theme.muted};
  --accent: ${theme.accent};
  --accent2: ${theme.accent2};
  --card-bg: ${theme.cardBg};
  --card-border: ${theme.cardBorder};
  --radius: calc(var(--u) * ${theme.radius});
  --font-head: ${theme.fontHead};
  --font-body: ${theme.fontBody};
}
body { font-family: var(--font-body); }
#root { position: relative; width: ${width}px; height: ${height}px; background: ${theme.bg}; }
${SCENE_CSS}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${durationSec}" data-width="${width}" data-height="${height}" data-fps="${fps}">
${scenesHtml}
</div>
<script>
window.__timelines = window.__timelines || {};
var tl = gsap.timeline({ paused: true });
${scenesTimeline}
window.__timelines["main"] = tl;
</script>
${playerRuntime}
</body>
</html>`;
}

/**
 * Runtime de contrôle : le parent (le Studio) pilote la lecture via
 * postMessage `{ type: "cf:seek", t }` ; le document reste passif et
 * seek-safe — exactement comme sous le renderer HyperFrames.
 */
function buildPlayerRuntime(durationSec: number): string {
  return `<script>
(function () {
  var DUR = ${durationSec};
  var clips = Array.prototype.slice.call(document.querySelectorAll(".clip"));
  function apply(t) {
    var tl = window.__timelines["main"];
    if (!tl) return;
    tl.pause();
    tl.time(Math.max(0, Math.min(t, DUR - 0.0001)));
    for (var i = 0; i < clips.length; i++) {
      var el = clips[i];
      var s = parseFloat(el.getAttribute("data-start") || "0");
      var d = parseFloat(el.getAttribute("data-duration") || "0");
      el.style.visibility = t >= s && t < s + d ? "visible" : "hidden";
    }
  }
  window.__cfSeek = apply;
  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.type === "cf:seek" && typeof m.t === "number") apply(m.t);
  });
  function boot() { apply(0); if (window.parent !== window) window.parent.postMessage({ type: "cf:ready", duration: DUR }, "*"); }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
</script>`;
}

/**
 * Piste de sous-titres optionnelle : la narration de chaque scène,
 * affichée en bas du stage sur une piste dédiée (data-track-index="2").
 */
function buildCaptions(storyboard: Storyboard): string {
  const clips = storyboard.scenes
    .filter((scene) => scene.narration.trim().length > 0)
    .map(
      (scene) => `<div class="clip caption-clip" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="2">
  <div class="caption-text">${escapeHtml(scene.narration)}</div>
</div>`,
    )
    .join("\n");
  if (!clips) return "";
  return `\n\n<!-- Sous-titres (narration) -->\n${clips}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
