# CineForge Studio — application

L'application Next.js de [CineForge](../README.md) : landing page, studio de création, moteur de génération et renderer MP4.

## Architecture

```
src/lib/engine/        Le moteur (TypeScript pur, zéro dépendance runtime)
  types.ts             Brief, Scene (union discriminée), Storyboard, thèmes
  planner.ts           Brief → Storyboard (heuristique déterministe seedée)
  compiler.ts          Storyboard → composition HTML (contrat HyperFrames)
  scenes.ts            Templates des 7 types de scènes (HTML + timelines GSAP)
  themes.ts            5 systèmes de design complets
  ai.ts                Fusion des storyboards écrits par Claude (mode IA)
  sanitize-storyboard.ts  Validation de frontière pour JSON non fiables
src/app/
  page.tsx             Landing
  studio/              Le studio (client) : brief → storyboard → preview → export
  api/generate/        Mode IA (Claude, structured outputs, repli 501)
src/components/studio/ BriefForm, SceneCard, PreviewPlayer, Timeline, ExportPanel
scripts/render.ts      Rendu MP4 : Playwright (frame par frame) + FFmpeg
tests/                 unit/ (Vitest) et e2e/ (Playwright, desktop + mobile)
```

## Commandes

```bash
npm run dev          # http://localhost:3000
npm run build        # build de production
npm run typecheck    # tsc --noEmit
npm test             # tests unitaires (Vitest)
npm run test:e2e     # tests E2E (Playwright)

# Rendu MP4 local (prérequis : ffmpeg + npx playwright install chromium)
npm run render -- --topic "Mon sujet" --duration 20 --vibe cinematic \
  --aspect 16:9 --lang fr [--captions] [--seed 42]
npm run render -- --storyboard mon-storyboard.json --out renders/ma-video.mp4
```

## Mode IA

`POST /api/generate` avec `{ "brief": {...} }` fait écrire le storyboard par Claude
(`claude-opus-4-8`, structured outputs). Nécessite `ANTHROPIC_API_KEY` côté serveur ;
sans clé la route répond 501 et le studio bascule automatiquement sur le planificateur
heuristique local. Limites : body 50 KB, 10 requêtes/min/IP.

## Contrat de composition

Les compositions générées sont conformes à [HyperFrames](https://github.com/heygen-com/hyperframes) :
clips avec `data-start`/`data-duration`/`data-track-index`, timeline GSAP en pause
enregistrée sur `window.__timelines["main"]`, seek-safe. Elles peuvent donc aussi être
rendues par `npx hyperframes render`.
