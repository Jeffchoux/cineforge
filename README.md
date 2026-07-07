# CineForge Studio

> **Décrivez. Générez. Diffusez.** Un studio vidéo IA open-source : une phrase devient une vidéo professionnelle — rendue depuis du HTML animé, sans timeline, sans crédits, sans boîte noire.

**Démo en ligne : [cineforge-fr.vercel.app](https://cineforge-fr.vercel.app)** · [Studio](https://cineforge-fr.vercel.app/studio)

## Qu'est-ce que c'est ?

CineForge transforme un brief (`sujet + durée + vibe`) en **storyboard JSON éditable**, puis en **composition HTML animée** (GSAP, seek-safe), prévisualisable instantanément dans le navigateur et exportable en **MP4 réel** via capture frame par frame (Playwright + FFmpeg).

Les compositions générées respectent le contrat [HeyGen HyperFrames](https://github.com/heygen-com/hyperframes) (`data-start` / `data-duration` / `data-track-index`, timeline GSAP en pause sur `window.__timelines`) : elles sont interopérables avec tout l'écosystème HyperFrames (`npx hyperframes render`, preview studio, Lambda…).

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `studio/` | L'application Next.js : landing page + studio (composer, éditeur de storyboard, preview player, export) + moteur + renderer + tests |
| `studio/src/lib/engine/` | Le moteur CineForge : planner (brief → storyboard), compiler (storyboard → HTML), thèmes, templates de scènes |
| `studio/scripts/render.ts` | Rendu MP4 local (Playwright + FFmpeg) |
| `examples/demo/` | Projet HyperFrames de référence (rendu validé avec le CLI officiel) |
| `VISION.md` | Vision produit, analyse concurrentielle, critères de succès |

## Démarrage rapide

```bash
cd studio
npm install
npm run dev          # → http://localhost:3000 (landing) et /studio
```

### Générer une vidéo MP4 en local

```bash
# Prérequis : ffmpeg (brew install ffmpeg) — Chromium est installé par Playwright
npx playwright install chromium

npm run render -- --topic "Les bienfaits du sommeil" --duration 20 \
  --vibe cinematic --aspect 16:9 --lang fr
# → renders/<slug>.mp4 (1080p, 30 fps, h264)
```

Ou depuis le studio : générez, éditez le storyboard, puis **Télécharger HTML** / **Exporter MP4**.

### Tests

```bash
npm run test        # unitaires (vitest) : déterminisme, XSS, timing, thèmes
npm run test:e2e    # end-to-end (playwright) : landing + studio
npm run typecheck
```

## Principes

1. **Pas de boîte noire** — le storyboard est un JSON lisible ; chaque scène s'édite et se recompile en direct.
2. **Déterministe** — même brief + même seed = même vidéo, au pixel près. Testable en CI.
3. **Offline-first** — le planificateur heuristique fonctionne sans aucune API key.
4. **La vidéo est une page web** — la preview est native, l'export est une capture.

## Types de scènes

`hook` · `metaphor` (battery, orbit, growth, pulse, network) · `stat` (count-up) · `steps` · `comparison` · `quote` · `cta`

## Sous-titres

La narration de chaque scène peut s'afficher en sous-titres (piste HyperFrames dédiée, `data-track-index="2"`) : toggle « Sous-titres » dans le studio, ou `--captions` en CLI. Le champ `narration` du storyboard alimente aussi les futurs modes voix off (TTS).

## Mode IA (optionnel)

Avec `ANTHROPIC_API_KEY` dans l'environnement serveur, `/api/generate` fait écrire le script et les métaphores par Claude (structured outputs). Sans clé, le studio fonctionne intégralement en mode heuristique local — aucune dépendance réseau.

## Thèmes

`midnight` · `paper` · `neon` · `broadcast` · `pastel` — chacun définit palette, typographies et rayons ; la vibe du brief choisit le thème par défaut.

## Licence

Apache-2.0 — même esprit que HyperFrames : aucun frais par rendu, usage commercial libre.
