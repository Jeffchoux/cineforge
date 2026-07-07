# Scorecard — panel de juges indépendants

Trois agents juges indépendants (lentilles : produit/fonctionnel, technique/code, design/UX) ont évalué le projet selon la grille de `VISION.md` §4, en vérifiant chaque affirmation par exécution (tests, ffprobe sur les MP4, frames extraites, CI GitHub, prod en ligne). Trois itérations complètes : chaque rapport a déclenché une vague de correctifs, re-vérifiée par le même juge.

| Juge | Passe 1 | Passe 2 | **Finale** |
|---|---|---|---|
| Fonctionnel & produit | 87 | 94 | **98** |
| Technique & code | 86 | 94 | **96,5** |
| Design & UX | 87 | 91 | **95** |
| **Moyenne** | 86,7 | 93 | **96,5 / 100** ✅ (objectif ≥ 95) |

## Ce qui a été corrigé entre les passes

- **Mode IA câblé dans le studio** (toggle + repli heuristique) — il n'était qu'un endpoint orphelin.
- **Validation de frontière** `sanitizeStoryboard` (injection JS via JSON hostile fermée, testée) + défense en profondeur côté client.
- **Direction artistique ×2** : auto-fit anti-troncature, décor seedé par thème (constellation, grilles, formes), layouts split 16:9, transitions typées seek-safe, éléments fantômes.
- **Tests** : 34 → 54 unitaires (handler API avec SDK mocké, fusion IA, frontières) ; 8 → 16 E2E (édition live, sous-titres, exports, toggle IA mocké, scrubbing clavier) ; job CI `render-smoke` qui rend un vrai MP4 et le vérifie par ffprobe à chaque push.
- **Sécurité** : whitelists strictes du brief, CSP + headers, limites API (50 KB, 10 req/min/IP), clamps des valeurs IA.
- **UX** : poster de preview, modal accessible (Escape/focus), ordre mobile, aria-labels dynamiques, plus de statistiques inventées.
- **Déploiement** : domaine propre `cineforge-fr.vercel.app` (sans noindex), CI 3 jobs verte.

## Limites assumées (documentées, non corrigées par choix)

- Export MP4 local par conception (gratuit/illimité/sans cloud) — le rendu cloud est la piste Pro (`VISION.md` §5).
- `script-src 'unsafe-inline'` : inhérent au design srcDoc (l'iframe reste sandboxée sans `allow-same-origin`).
- Rate limit en mémoire d'instance : best-effort, à passer sur un KV partagé si le mode IA est exposé à grande échelle.
