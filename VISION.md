# CineForge Studio — Vision Produit

> **Décrivez. Générez. Diffusez.** Le studio vidéo IA qui transforme une phrase en vidéo professionnelle — sans timeline, sans crédits, sans boîte noire.

## 1. Contexte & opportunité (juillet 2026)

L'article de Sabrina Ramonov (4 juil. 2026) a popularisé **HeyGen HyperFrames** : un moteur open-source (Apache 2.0) qui rend des vidéos à partir de HTML — une composition est une page web avec des attributs `data-*` de timing, capturée frame par frame par Chrome headless puis encodée par FFmpeg. Déterministe, gratuit, piloté par agents IA.

**Le gap identifié** : HyperFrames est un outil pour développeurs pilotés par CLI/agent. Il n'existe pas de **studio visuel** qui rende ce pouvoir accessible : composer un brief, voir le storyboard, prévisualiser avec une timeline, éditer scène par scène, exporter — le tout dans le navigateur.

Concurrents analysés : Rendervid (JSON + MCP, pas d'UI), OpenMontage (CLI agentique), Remotion (React, licence commerciale), MotionForge (React). **Aucun ne propose un studio web no-code au-dessus d'un moteur HTML ouvert.**

## 2. Le produit

**CineForge Studio** = 3 couches :

### Couche 1 — Engine (`@cineforge/engine`, TypeScript pur)
- **Brief → Storyboard** : un planificateur transforme `{ sujet, durée, vibe, format }` en storyboard JSON typé (scènes : hook, metaphor, stat, comparison, steps, quote, cta…).
- **Storyboard → Composition** : chaque scène est rendue en HTML/CSS/GSAP *seek-safe*, compatible avec le contrat HyperFrames (`data-start`, `data-duration`, `data-track-index`).
- **Thèmes** : systèmes de design complets (palette, typo, motion) — `midnight`, `paper`, `neon`, `broadcast`, `pastel`.
- **Déterministe** : même brief + même seed = même vidéo. Testable en CI.
- **Mode IA optionnel** : si `ANTHROPIC_API_KEY` présent, Claude écrit le script et choisit les métaphores visuelles ; sinon le planificateur heuristique fonctionne 100 % offline.

### Couche 2 — Studio (Next.js, déployé sur Vercel)
- **Composer** : formulaire brief (source + durée + vibe + format 16:9/9:16/1:1).
- **Storyboard editor** : chaque scène est une carte éditable (texte, mood, durée) — la philosophie « pas de boîte noire » de HyperFrames, portée en visuel.
- **Preview player** : lecture temps réel de la composition dans un iframe sandboxé, timeline scrubbing, contrôle scène par scène (GSAP timeline seekable).
- **Export** : téléchargement de la composition HTML autonome + rendu MP4.
- **Landing page** : marketing, mobile-first 375→1920px.

### Couche 3 — Render (local)
- Export MP4 via capture frame par frame (Playwright + FFmpeg), script `cineforge render`.
- Compatible `npx hyperframes render` pour interop avec l'écosystème HeyGen.

## 3. Différenciateurs

1. **No-code au-dessus d'un moteur ouvert** — le storyboard reste un fichier JSON lisible et éditable (pas de boîte noire).
2. **Preview instantanée dans le navigateur** — la vidéo EST une page web, donc la preview est native, sans rendu préalable.
3. **Offline-first** — génération heuristique déterministe sans API key ; l'IA est un amplificateur, pas une dépendance.
4. **Français natif** — bibliothèque de scripts/vibes FR + EN.
5. **Interop HyperFrames** — exporte des compositions conformes au contrat `data-*`, réutilisables dans tout l'écosystème.

## 4. Critères de succès (score /100)

| Critère | Poids |
|---|---|
| Fonctionnel de bout en bout (brief → MP4 réel vérifié) | 25 |
| Qualité visuelle des vidéos générées + du studio (mobile-first) | 20 |
| Qualité code (types, architecture, lisibilité) | 15 |
| Tests (unitaires + E2E) verts | 15 |
| Sécurité OWASP (sandbox iframe, validation input, zéro secret) | 10 |
| Déploiement (GitHub + Vercel live) | 10 |
| Documentation | 5 |

**Objectif : ≥ 95/100, validé par un panel d'agents indépendants.**

## 5. Monétisation (piste future)

Freemium : studio gratuit local/open-source ; Pro (Stripe) = rendu cloud, voix off TTS premium, brand kits extraits d'URL, templates exclusifs.
