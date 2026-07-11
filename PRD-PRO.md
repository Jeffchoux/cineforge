# PRD — CineForge Pro (monétisation)

> Statut : proposition — à valider par Jeff avant transmission à F5.
> Base : `VISION.md` §5 (piste monétisation) + `SCORECARD.md` (limites assumées).

## 1. Contexte

CineForge Studio (moteur + studio Next.js + render local) est fonctionnel de bout en
bout et validé à 96,5/100 par un panel de juges indépendants (`SCORECARD.md`). Le
mode gratuit/local (brief → storyboard → preview → export MP4 via Playwright+FFmpeg
sur la machine de l'utilisateur) reste la porte d'entrée et ne doit pas régresser.

Ce PRD couvre le prochain palier : un plan **Pro** payant qui lève les limites
assumées du mode gratuit (rendu local uniquement, pas de voix off, pas de brand kit)
sans dégrader l'expérience gratuite.

## 2. Objectifs

1. Un utilisateur peut passer Pro (paiement Stripe) et débloquer immédiatement les
   fonctionnalités premium, sans redéploiement manuel.
2. Le rendu MP4 peut se faire depuis le navigateur, sans installation locale
   (Playwright/FFmpeg côté serveur ou sandbox), pour les utilisateurs Pro.
3. La narration existante (`Scene.narration`) peut être synthétisée en voix off
   (TTS) et injectée dans l'export, en option Pro.
4. Le mode gratuit reste intact : composer, éditer, prévisualiser, exporter HTML,
   render MP4 local via CLI — zéro régression, zéro fonctionnalité gratuite
   requise en paiement.

## 3. Hors scope (V1)

- Brand kits extraits d'URL, templates exclusifs (V2 — mentionnés dans `VISION.md`
  §5 mais pas de valeur avant que rendu cloud + Stripe existent).
- Collaboration multi-utilisateurs / comptes d'équipe.
- Facturation à l'usage fine (V1 = abonnement forfaitaire simple, pas de metering
  par seconde de rendu).
- Durcissement du rate-limit sur KV partagé — **prérequis technique**, à faire
  avant l'exposition publique du rendu cloud (voir §6 dépendances), mais ne fait
  pas partie de la valeur produit Pro elle-même.

## 4. Scope V1 — trois capacités

### 4.1 Comptes & abonnement (Stripe)
- Un utilisateur peut créer un compte, se connecter, et souscrire à un plan Pro
  (mensuel, prix à définir par Jeff).
- Le statut d'abonnement (actif / expiré / annulé) doit être fiable en quasi
  temps réel via webhooks Stripe — pas de polling manuel.
- Les fonctionnalités Pro (rendu cloud, TTS) sont gatées côté serveur (pas
  seulement côté UI) sur la base de ce statut.
- Gestion de compte minimale : voir son plan, annuler, mettre à jour le moyen
  de paiement (Stripe Customer Portal suffit, pas besoin de UI custom).

### 4.2 Rendu cloud
- Depuis le studio web, un utilisateur Pro déclenche un rendu MP4 sans quitter
  le navigateur ni installer quoi que ce soit localement.
- Le rendu est asynchrone : déclenchement → job en file → statut consultable
  (en attente / en cours / terminé / échec) → lien de téléchargement à la fin.
- Le pipeline de rendu doit produire un résultat identique (déterminisme) au
  rendu local existant pour le même storyboard+seed — c'est un principe
  fondateur du projet (`VISION.md` §3.3), pas négociable.
- Gestion des échecs : timeout, erreur de rendu → message clair à l'utilisateur,
  pas de job fantôme.

### 4.3 Voix off (TTS)
- Un utilisateur Pro peut activer "voix off" sur un storyboard : chaque
  `Scene.narration` est synthétisée et injectée en piste audio synchronisée sur
  les `data-start`/`data-duration` de la scène correspondante.
- Le choix de la voix (langue FR/EN a minima, cohérent avec `Brief.language`)
  est configurable.
- L'audio généré fait partie de l'export MP4 (rendu cloud) — pas de UI de
  lecture séparée à construire en V1 au-delà de la preview existante.

## 5. Critères de succès

Repris dans l'esprit de `VISION.md` §4 (grille pondérée, vérifiée par exécution,
pas par déclaration) :

| Critère | Attendu |
|---|---|
| Bout en bout | Un paiement Stripe réel (mode test) débloque le rendu cloud, vérifié par un job qui produit un MP4 téléchargeable |
| Déterminisme | Rendu cloud et rendu local produisent un MP4 identique (frame hash ou ffprobe) pour le même storyboard+seed |
| Sécurité | Aucun secret Stripe/TTS en clair ; webhooks Stripe vérifiés par signature ; gating serveur, jamais uniquement client |
| Non-régression | Suite de tests existante (54 unitaires + 16 E2E + CI render-smoke) reste verte ; aucune fonctionnalité gratuite retirée ou dégradée |
| Tests nouveaux | Webhooks Stripe (mockés), gating d'accès Pro/gratuit, pipeline TTS, job de rendu cloud (statuts + échecs) |
| Documentation | README mis à jour (mode Pro, variables d'env additionnelles) ; pas de doc supplémentaire hors README/PRD |

## 6. Dépendances & risques

- **Stack actuelle n'a ni base de données ni auth** (`studio/package.json` :
  aucune dépendance DB/auth/Stripe à ce jour). F5 doit choisir et introduire ces
  briques — latitude d'implémentation laissée intentionnellement (Next.js +
  Supabase est le défaut du studio Jeff, mais pas imposé si un existant
  contredit ce choix ailleurs dans le repo).
- **Rendu cloud** = le risque technique principal : Playwright+FFmpeg en
  serverless est lourd (cold start, durée d'exécution, coût). Évaluer Vercel
  Sandbox ou un worker dédié avant de s'engager sur une architecture.
- **Rate-limit en mémoire d'instance** (limite assumée documentée dans
  `SCORECARD.md`) devient un vrai problème de sécurité/coût dès que le rendu
  cloud est exposé publiquement — à migrer vers un store partagé (KV/Upstash)
  **avant** le lancement public du rendu cloud, pas après.
- **TTS** : choix du fournisseur non arbitré (coût, qualité voix FR). À évaluer
  par F5 selon budget — hors scope de ce PRD de fixer le vendor.

## 7. Questions ouvertes pour Jeff (à trancher avant lancement)

- Prix et palier(s) du plan Pro ?
- Fournisseur TTS préféré, ou liberté à F5 ?
- Rendu cloud : quota inclus dans l'abonnement, ou facturation à l'usage V2 ?
- Auth : email/password suffit, ou OAuth (Google) attendu dès V1 ?
