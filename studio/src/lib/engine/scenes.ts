import type { Scene } from "./types";
import { escapeHtml } from "./escape";

/**
 * Templates de scènes : chaque scène produit son markup HTML (clip)
 * et le code GSAP de sa timeline (positions absolues en secondes).
 * Tout texte utilisateur est échappé (XSS).
 *
 * Unités : `--u` = 1% de la plus petite dimension du stage → les
 * compositions s'adaptent aux formats 16:9, 9:16 et 1:1.
 */

export interface SceneRender {
  html: string;
  timeline: string;
}

/** CSS partagé par tous les types de scènes (paramétré par variables de thème). */
export const SCENE_CSS = `
.clip { position: absolute; inset: 0; display: grid; place-items: center; visibility: hidden; }
.scene-inner { display: grid; place-items: center; gap: calc(var(--u) * 3); padding: calc(var(--u) * 8); text-align: center; max-width: 92%; }

.kicker {
  font-family: var(--font-body); font-size: calc(var(--u) * 2.6); font-weight: 600;
  letter-spacing: 0.35em; color: var(--accent); text-transform: uppercase;
}
.hook-title {
  font-family: var(--font-head); font-size: calc(var(--u) * 9); font-weight: 800;
  color: var(--ink); line-height: 1.12; letter-spacing: -0.02em; max-width: 88%;
}
.hook-title .accent { color: var(--accent); }

.metaphor-label {
  font-family: var(--font-head); font-size: calc(var(--u) * 5.4); font-weight: 800; color: var(--ink);
}
.metaphor-caption {
  font-family: var(--font-body); font-size: calc(var(--u) * 3.2); color: var(--muted); max-width: 70%;
}
.visual-stage { position: relative; width: calc(var(--u) * 46); height: calc(var(--u) * 30); display: grid; place-items: center; }

.v-battery { width: calc(var(--u) * 40); height: calc(var(--u) * 19); border: calc(var(--u) * 0.9) solid var(--ink); border-radius: calc(var(--u) * 3); position: relative; background: var(--card-bg); }
.v-battery::after { content: ""; position: absolute; right: calc(var(--u) * -3.2); top: 28%; width: calc(var(--u) * 2.2); height: 44%; background: var(--ink); border-radius: calc(var(--u) * 0.8); }
.v-battery-fill { position: absolute; inset: calc(var(--u) * 1.3); width: 0%; max-width: calc(100% - var(--u) * 2.6); background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: calc(var(--u) * 1.7); }

.v-orbit { position: relative; width: calc(var(--u) * 30); height: calc(var(--u) * 30); }
.v-orbit-core { position: absolute; left: 50%; top: 50%; width: calc(var(--u) * 7); height: calc(var(--u) * 7); margin: calc(var(--u) * -3.5); border-radius: 50%; background: var(--accent); box-shadow: 0 0 calc(var(--u) * 6) var(--accent); }
.v-orbit-ring { position: absolute; inset: 0; border: calc(var(--u) * 0.25) dashed var(--card-border); border-radius: 50%; }
.v-orbit-sat { position: absolute; left: 50%; top: 0; width: calc(var(--u) * 3.4); height: calc(var(--u) * 3.4); margin-left: calc(var(--u) * -1.7); margin-top: calc(var(--u) * -1.7); border-radius: 50%; background: var(--accent2); }
.v-orbit-spin { position: absolute; inset: 0; }

.v-growth { display: flex; align-items: flex-end; gap: calc(var(--u) * 2.4); height: calc(var(--u) * 26); }
.v-growth-bar { width: calc(var(--u) * 7); background: linear-gradient(180deg, var(--accent2), var(--accent)); border-radius: calc(var(--u) * 1) calc(var(--u) * 1) 0 0; transform-origin: bottom; }

.v-pulse { position: relative; width: calc(var(--u) * 26); height: calc(var(--u) * 26); }
.v-pulse-core { position: absolute; inset: 34%; border-radius: 50%; background: var(--accent); }
.v-pulse-ring { position: absolute; inset: 0; border: calc(var(--u) * 0.5) solid var(--accent); border-radius: 50%; opacity: 0; }

.v-network { width: calc(var(--u) * 44); height: calc(var(--u) * 28); }
.v-network line { stroke: var(--accent2); stroke-width: 2; }
.v-network circle { fill: var(--accent); }

.stat-value {
  font-family: var(--font-head); font-size: calc(var(--u) * 18); font-weight: 900;
  color: var(--accent); line-height: 1; letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.stat-label { font-family: var(--font-body); font-size: calc(var(--u) * 3.6); color: var(--ink); max-width: 75%; font-weight: 600; }

.steps-title { font-family: var(--font-head); font-size: calc(var(--u) * 5.6); font-weight: 800; color: var(--ink); }
.steps-list { display: grid; gap: calc(var(--u) * 2.2); width: min(78%, calc(var(--u) * 90)); }
.step-card {
  display: flex; align-items: center; gap: calc(var(--u) * 2.6);
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: var(--radius); padding: calc(var(--u) * 2.4) calc(var(--u) * 3.4);
  box-shadow: 0 calc(var(--u) * 1.2) calc(var(--u) * 3.6) rgba(0,0,0,0.12);
}
.step-num {
  flex: none; width: calc(var(--u) * 5.4); height: calc(var(--u) * 5.4); border-radius: 50%;
  display: grid; place-items: center; background: var(--accent); color: #fff;
  font-family: var(--font-head); font-weight: 800; font-size: calc(var(--u) * 2.8);
}
.step-text { font-family: var(--font-body); font-size: calc(var(--u) * 3.2); font-weight: 600; color: var(--ink); text-align: left; }

.comp-title { font-family: var(--font-head); font-size: calc(var(--u) * 5); font-weight: 800; color: var(--ink); max-width: 84%; }
.comp-rows { display: grid; gap: calc(var(--u) * 3); width: min(76%, calc(var(--u) * 96)); }
.comp-row { display: grid; gap: calc(var(--u) * 1.2); text-align: left; }
.comp-label { font-family: var(--font-body); font-size: calc(var(--u) * 3); font-weight: 600; color: var(--muted); }
.comp-track { height: calc(var(--u) * 4.6); background: var(--card-bg); border: 1px solid var(--card-border); border-radius: calc(var(--u) * 2.3); overflow: hidden; }
.comp-fill { height: 100%; width: 0%; border-radius: inherit; }
.comp-fill.left { background: var(--muted); }
.comp-fill.right { background: linear-gradient(90deg, var(--accent), var(--accent2)); }

.quote-mark { font-family: var(--font-head); font-size: calc(var(--u) * 14); color: var(--accent); line-height: 0.4; }
.quote-text { font-family: var(--font-head); font-size: calc(var(--u) * 6); font-weight: 700; color: var(--ink); line-height: 1.3; max-width: 80%; }
.quote-author { font-family: var(--font-body); font-size: calc(var(--u) * 3); color: var(--muted); }

.cta-title { font-family: var(--font-head); font-size: calc(var(--u) * 10); font-weight: 900; color: var(--ink); letter-spacing: -0.02em; }
.cta-subtitle { font-family: var(--font-body); font-size: calc(var(--u) * 4); color: var(--muted); }
.cta-bar { width: calc(var(--u) * 24); height: calc(var(--u) * 1.2); border-radius: calc(var(--u) * 0.6); background: linear-gradient(90deg, var(--accent), var(--accent2)); transform-origin: left; }

.caption-clip { display: block; pointer-events: none; }
.caption-text {
  position: absolute; left: 50%; bottom: calc(var(--u) * 5); transform: translateX(-50%);
  max-width: 84%; padding: calc(var(--u) * 1.2) calc(var(--u) * 2.4);
  background: rgba(0,0,0,0.55); border-radius: calc(var(--u) * 1);
  font-family: var(--font-body); font-size: calc(var(--u) * 2.8); font-weight: 600;
  color: #fff; text-align: center; line-height: 1.35;
}
`;

function sel(id: string): string {
  // Les ids sont générés par le planner (scene-N) — on garde une garde simple.
  return `#${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

/** Enveloppe standard d'un clip HyperFrames. */
function clip(scene: Scene, inner: string): string {
  return `<div id="${escapeHtml(scene.id)}" class="clip" data-start="${scene.start}" data-duration="${scene.duration}" data-track-index="1">
  <div class="scene-inner">${inner}</div>
</div>`;
}

/** Entrée/sortie standard : rise-in au début, fade-out avant la fin. */
function enterExit(id: string, start: number, end: number): string {
  const s = sel(id);
  return `tl.fromTo("${s} .scene-inner", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${start});
tl.to("${s} .scene-inner", { opacity: 0, y: -28, duration: 0.35, ease: "power2.in" }, ${Math.max(start, end - 0.38)});`;
}

function renderHook(scene: Extract<Scene, { type: "hook" }>): SceneRender {
  let title = escapeHtml(scene.title);
  if (scene.accentWord) {
    const word = escapeHtml(scene.accentWord);
    // n'accentue que la première occurrence
    title = title.replace(word, `<span class="accent">${word}</span>`);
  }
  const kicker = scene.kicker ? `<div class="kicker">${escapeHtml(scene.kicker)}</div>` : "";
  const html = clip(scene, `${kicker}<h1 class="hook-title">${title}</h1>`);
  const s = sel(scene.id);
  const end = scene.start + scene.duration;
  const timeline = `${enterExit(scene.id, scene.start, end)}
tl.fromTo("${s} .hook-title", { scale: 0.94 }, { scale: 1, duration: ${Math.max(0.6, scene.duration - 0.4)}, ease: "power1.out" }, ${scene.start});`;
  return { html, timeline };
}

function metaphorVisualHtml(visual: string): string {
  switch (visual) {
    case "battery":
      return `<div class="v-battery"><div class="v-battery-fill"></div></div>`;
    case "orbit":
      return `<div class="v-orbit"><div class="v-orbit-ring"></div><div class="v-orbit-spin"><div class="v-orbit-sat"></div></div><div class="v-orbit-spin s2"><div class="v-orbit-sat" style="background: var(--accent)"></div></div><div class="v-orbit-core"></div></div>`;
    case "growth":
      return `<div class="v-growth"><div class="v-growth-bar" style="height: 22%"></div><div class="v-growth-bar" style="height: 42%"></div><div class="v-growth-bar" style="height: 66%"></div><div class="v-growth-bar" style="height: 100%"></div></div>`;
    case "pulse":
      return `<div class="v-pulse"><div class="v-pulse-ring r1"></div><div class="v-pulse-ring r2"></div><div class="v-pulse-core"></div></div>`;
    case "network":
      return `<svg class="v-network" viewBox="0 0 440 280" aria-hidden="true">
  <line x1="70" y1="70" x2="220" y2="140" /><line x1="220" y1="140" x2="370" y2="60" />
  <line x1="220" y1="140" x2="120" y2="230" /><line x1="220" y1="140" x2="330" y2="220" />
  <line x1="70" y1="70" x2="120" y2="230" /><line x1="370" y1="60" x2="330" y2="220" />
  <circle cx="70" cy="70" r="14" /><circle cx="370" cy="60" r="14" />
  <circle cx="220" cy="140" r="20" /><circle cx="120" cy="230" r="14" /><circle cx="330" cy="220" r="14" />
</svg>`;
    default:
      return "";
  }
}

function renderMetaphor(scene: Extract<Scene, { type: "metaphor" }>): SceneRender {
  const html = clip(
    scene,
    `<div class="visual-stage">${metaphorVisualHtml(scene.visual)}</div>
<div class="metaphor-label">${escapeHtml(scene.label)}</div>
<div class="metaphor-caption">${escapeHtml(scene.caption)}</div>`,
  );
  const s = sel(scene.id);
  const t0 = scene.start;
  const end = t0 + scene.duration;
  const animDur = Math.max(1, scene.duration - 1.2);
  let visualTl = "";
  switch (scene.visual) {
    case "battery":
      visualTl = `tl.to("${s} .v-battery-fill", { width: "94%", duration: ${animDur}, ease: "power1.inOut" }, ${t0 + 0.5});`;
      break;
    case "orbit":
      visualTl = `tl.fromTo("${s} .v-orbit-spin", { rotation: 0 }, { rotation: 300, duration: ${animDur + 0.8}, ease: "none", transformOrigin: "50% 50%" }, ${t0});
tl.fromTo("${s} .v-orbit-spin.s2", { rotation: 180 }, { rotation: -160, duration: ${animDur + 0.8}, ease: "none", transformOrigin: "50% 50%" }, ${t0});`;
      break;
    case "growth":
      visualTl = `tl.fromTo("${s} .v-growth-bar", { scaleY: 0 }, { scaleY: 1, duration: 0.8, stagger: 0.22, ease: "power3.out" }, ${t0 + 0.4});`;
      break;
    case "pulse":
      visualTl = `tl.fromTo("${s} .v-pulse-ring.r1", { scale: 0.4, opacity: 0.9 }, { scale: 1.15, opacity: 0, duration: 1.4, ease: "power1.out", repeat: ${Math.max(0, Math.floor(animDur / 1.4) - 1)} }, ${t0 + 0.4});
tl.fromTo("${s} .v-pulse-ring.r2", { scale: 0.4, opacity: 0.9 }, { scale: 1.15, opacity: 0, duration: 1.4, ease: "power1.out", repeat: ${Math.max(0, Math.floor(animDur / 1.4) - 1)} }, ${t0 + 1.1});
tl.fromTo("${s} .v-pulse-core", { scale: 0.92 }, { scale: 1.06, duration: 0.7, yoyo: true, repeat: ${Math.max(1, Math.floor(animDur / 0.7))}, ease: "sine.inOut" }, ${t0 + 0.4});`;
      break;
    case "network":
      visualTl = `tl.fromTo("${s} .v-network circle", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.5, stagger: 0.16, ease: "back.out(2)" }, ${t0 + 0.3});
tl.fromTo("${s} .v-network line", { opacity: 0 }, { opacity: 0.7, duration: 0.4, stagger: 0.12 }, ${t0 + 0.7});`;
      break;
  }
  return { html, timeline: `${enterExit(scene.id, t0, end)}\n${visualTl}` };
}

function renderStat(scene: Extract<Scene, { type: "stat" }>): SceneRender {
  const prefix = escapeHtml(scene.prefix ?? "");
  const suffix = escapeHtml(scene.suffix ?? "");
  const html = clip(
    scene,
    `<div class="stat-value"><span class="stat-prefix">${prefix}</span><span class="stat-num">0</span><span class="stat-suffix">${suffix}</span></div>
<div class="stat-label">${escapeHtml(scene.label)}</div>`,
  );
  const s = sel(scene.id);
  const end = scene.start + scene.duration;
  const decimals = Number.isInteger(scene.value) ? 0 : 1;
  const countDur = Math.max(0.8, Math.min(2, scene.duration - 1));
  const timeline = `${enterExit(scene.id, scene.start, end)}
(function(){
  var target = { v: 0 };
  tl.to(target, { v: ${scene.value}, duration: ${countDur}, ease: "power1.out", onUpdate: function(){
    var el = document.querySelector("${s} .stat-num");
    if (el) el.textContent = target.v.toFixed(${decimals}).replace(".", ",");
  } }, ${scene.start + 0.4});
})();`;
  return { html, timeline };
}

function renderSteps(scene: Extract<Scene, { type: "steps" }>): SceneRender {
  const items = scene.items
    .map(
      (item, i) =>
        `<div class="step-card"><div class="step-num">${i + 1}</div><div class="step-text">${escapeHtml(item)}</div></div>`,
    )
    .join("\n");
  const html = clip(scene, `<div class="steps-title">${escapeHtml(scene.title)}</div><div class="steps-list">${items}</div>`);
  const s = sel(scene.id);
  const end = scene.start + scene.duration;
  const stagger = Math.min(0.35, (scene.duration - 1.4) / Math.max(1, scene.items.length));
  const timeline = `${enterExit(scene.id, scene.start, end)}
tl.fromTo("${s} .step-card", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.55, stagger: ${Math.max(0.15, stagger)}, ease: "power3.out" }, ${scene.start + 0.5});`;
  return { html, timeline };
}

function renderComparison(scene: Extract<Scene, { type: "comparison" }>): SceneRender {
  const clampPct = (v: number) => Math.max(4, Math.min(100, Math.round(v)));
  const html = clip(
    scene,
    `<div class="comp-title">${escapeHtml(scene.title)}</div>
<div class="comp-rows">
  <div class="comp-row"><div class="comp-label">${escapeHtml(scene.leftLabel)}</div><div class="comp-track"><div class="comp-fill left"></div></div></div>
  <div class="comp-row"><div class="comp-label">${escapeHtml(scene.rightLabel)}</div><div class="comp-track"><div class="comp-fill right"></div></div></div>
</div>`,
  );
  const s = sel(scene.id);
  const end = scene.start + scene.duration;
  const timeline = `${enterExit(scene.id, scene.start, end)}
tl.to("${s} .comp-fill.left", { width: "${clampPct(scene.leftValue)}%", duration: 1, ease: "power2.out" }, ${scene.start + 0.5});
tl.to("${s} .comp-fill.right", { width: "${clampPct(scene.rightValue)}%", duration: 1.2, ease: "power2.out" }, ${scene.start + 0.7});`;
  return { html, timeline };
}

function renderQuote(scene: Extract<Scene, { type: "quote" }>): SceneRender {
  const author = scene.author ? `<div class="quote-author">— ${escapeHtml(scene.author)}</div>` : "";
  const html = clip(scene, `<div class="quote-mark">“</div><div class="quote-text">${escapeHtml(scene.text)}</div>${author}`);
  const s = sel(scene.id);
  const end = scene.start + scene.duration;
  const timeline = `${enterExit(scene.id, scene.start, end)}
tl.fromTo("${s} .quote-text", { scale: 0.96 }, { scale: 1, duration: ${Math.max(0.8, scene.duration - 0.6)}, ease: "power1.out" }, ${scene.start});`;
  return { html, timeline };
}

function renderCta(scene: Extract<Scene, { type: "cta" }>): SceneRender {
  const subtitle = scene.subtitle ? `<div class="cta-subtitle">${escapeHtml(scene.subtitle)}</div>` : "";
  const html = clip(scene, `<div class="cta-title">${escapeHtml(scene.title)}</div><div class="cta-bar"></div>${subtitle}`);
  const s = sel(scene.id);
  const end = scene.start + scene.duration;
  const timeline = `${enterExit(scene.id, scene.start, end)}
tl.fromTo("${s} .cta-bar", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.out" }, ${scene.start + 0.45});`;
  return { html, timeline };
}

export function renderScene(scene: Scene): SceneRender {
  switch (scene.type) {
    case "hook":
      return renderHook(scene);
    case "metaphor":
      return renderMetaphor(scene);
    case "stat":
      return renderStat(scene);
    case "steps":
      return renderSteps(scene);
    case "comparison":
      return renderComparison(scene);
    case "quote":
      return renderQuote(scene);
    case "cta":
      return renderCta(scene);
  }
}
