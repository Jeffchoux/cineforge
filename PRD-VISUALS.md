# PRD — Vraies images dans les vidéos CineForge (stock footage hybride)

> Statut : proposition — à valider par Jeff avant transmission à F5.
> Origine : retour direct de Jeff après démo — « c'est nul, c'est que du texte, en 2026
> les gens veulent des vrais humains et des vraies histoires, pas des vidéos de texte
> façon 1980 ». Recherche marché faite le 11/07/2026 (voir §5) avant de proposer une
> solution.

## 1. Constat

CineForge génère aujourd'hui des vidéos 100 % motion design : texte animé, formes
géométriques (`MetaphorVisual` : battery, orbit, growth, pulse, network), barres de
comparaison, compteurs. Aucune image, aucun humain, aucune scène du monde réel. C'est
un choix de conception initial cohérent avec le contrat HyperFrames (la vidéo est une
page web), mais ce n'est pas ce que le marché regarde en 2026 — confirmé par le retour
utilisateur direct.

## 2. Contrainte non négociable

**Zéro coût par génération.** Jeff refuse catégoriquement un modèle économique où
produire une vidéo a un coût variable (API payante à la génération). La solution doit
rester gratuite à l'usage, à tout volume.

Cette contrainte élimine d'office toute IA vidéo générative propriétaire (Veo, Runway,
Pika, Kling, Luma) : aucune n'a de tier gratuit exploitable par API en 2026 — voir §5.

## 3. Décision : hybride stock footage réel

Chaque scène du storyboard qui le permet (metaphor, stat, steps, quote, hook) affiche
en fond une **vraie vidéo de banque gratuite** (humains, lieux, objets réels),
sélectionnée par mots-clés dérivés du sujet/de la scène, derrière ou autour du texte
animé existant — qui reste au premier plan pour la lisibilité et la structure
narrative.

Le texte animé n'est pas supprimé : c'est ce qui rend le storyboard éditable et
déterministe (principe fondateur du projet). Ce qui change, c'est le fond — passer
d'un fond CSS/gradient à une vraie séquence vidéo.

### Pourquoi cette option et pas les autres (voir §5 pour le détail)

| Option | Rejetée ou retenue | Raison |
|---|---|---|
| Modèle propriétaire (Veo/Runway/Pika/Kling) | ❌ Rejetée | Aucun tier gratuit API — $0,15 à $0,60/seconde |
| Modèle open-source auto-hébergé (Wan 2.2) | ❌ Rejetée pour V1 | Vraiment libre (Apache 2.0) mais demande un GPU dédié — aucun runtime gratuit (HF ZeroGPU, Colab) n'a un quota suffisant pour un usage produit (3,5 min de calcul GPU/jour en gratuit ≈ à peine 1 vidéo courte) |
| Stock footage réel (Pexels/Pixabay) | ✅ Retenue | Gratuit, illimité (Pexels lève la limite avec attribution), vrais humains/scènes, usage commercial libre, exploitable immédiatement par API |

## 4. Scope V1

### 4.1 Sélection automatique du footage par scène — cœur de la V1

**Extraction des mots-clés.** Pour chaque scène compatible, une fonction
`extractKeywords(scene, brief)` construit une requête de recherche à partir des
champs texte déjà présents dans le storyboard — aucun nouveau champ n'est requis
côté planner :

| Type de scène | Champs source |
|---|---|
| `hook` | `title` (sans le kicker), `Brief.topic` |
| `metaphor` | `label`, `caption` |
| `stat` | `label` |
| `steps` | `title` |
| `quote` | `text` |
| `comparison`, `cta` | pas de footage en V1 (voir §4.2) |

Traitement du texte : normalisation (minuscule, accents conservés — Pexels indexe le
français), retrait des mots vides (déterminants, pronoms), garde des 2-4 mots les
plus significatifs. `Brief.topic` est toujours ajouté en repli de la requête pour
ancrer la pertinence même si le texte de scène est abstrait (ex. une `metaphor`
"orbit"/"réseau" doit quand même chercher sur le sujet réel, pas sur la métaphore
visuelle qui n'a pas de sens filmable).

**Appel API.** La requête interroge l'API Pexels Videos (clé gratuite, 200 req/h,
20 000 req/mois par défaut) avec :
- `orientation` dérivée de l'`AspectRatio` du storyboard (`landscape` pour 16:9,
  `portrait` pour 9:16, `square` pour 1:1) — **point critique validé par le
  prototype** : un clip filmé dans le mauvais sens de cadre casse visuellement la
  composition (constaté sur le prototype `prototype-visuals.html`, corrigé en
  choisissant un clip nativement paysage plutôt qu'en forçant un recadrage CSS
  d'un portrait).
- `size` raisonnable (éviter les 4K inutiles pour une preview navigateur — HD
  suffit, garder l'UHD seulement pour le rendu export final si pertinent).

**Choix du résultat.** Parmi les résultats retournés, sélection déterministe (pas
aléatoire à chaque appel) via le RNG seedé du storyboard déjà utilisé ailleurs dans
le planner (`createRng`, `hashString` — cohérent avec `rng.ts`) : même seed + même
requête = même clip choisi.

**Repli.** Si aucun résultat pertinent, quota dépassé, ou API indisponible : la
scène retombe sur le fond actuel (gradient/thème/backdrop) — jamais d'échec
bloquant, jamais de scène vide. C'est un principe déjà appliqué ailleurs dans le
moteur (ex. mode IA avec repli heuristique local dans `ai.ts`) — même philosophie
à réutiliser ici.

### 4.2 Intégration dans la composition
- Le clip vidéo est intégré comme calque de fond dans la scène HTML compilée,
  respectant le contrat HyperFrames (`data-start`/`data-duration` de la scène pour
  le calage, lecture en boucle ou trim si le clip est plus long que la scène).
- Le texte/les animations existants restent au premier plan, avec un traitement
  (overlay sombre, dégradé) qui garantit la lisibilité par-dessus une vidéo réelle —
  point de vigilance design, pas juste technique.
- Déterminisme : pour un même storyboard, le même clip est resélectionné à chaque
  compilation (id du clip mémorisé dans le storyboard JSON, pas une requête relancée
  à chaque render) — cohérent avec le principe « même brief + même seed = même
  vidéo ».

### 4.3 Cache et robustesse
- Les clips sélectionnés doivent être mis en cache (au moins le temps d'une session,
  idéalement persistant) pour ne pas ré-interroger Pexels à chaque preview/render et
  rester sous la limite de requêtes/heure.
- Respect des CGU Pexels : attribution si nécessaire pour lever la limite, pas de
  hotlink permanent en dehors de ce que permettent leurs conditions.

### 4.4 Audio — hors scope V1, noté pour la suite

Constaté sur le prototype (`prototype-visuals.html`) : les clips Pexels sont muets
(pas de parole, pas de musique exploitable) et le moteur CineForge ne gère
actuellement aucun son. Deux ajouts identifiés pour un prochain cycle, non traités
ici :
- **Musique de fond libre de droits** (impact immédiat, plus simple).
- **Voix off (TTS)** à partir de `Scene.narration`, déjà prévue dans `PRD-PRO.md`
  §4.3.

Priorité entre les deux non tranchée — à décider au moment venu, une fois la
sélection vidéo (objet de ce PRD) livrée.

## 5. Recherche marché (11/07/2026) — état réel des IA vidéo génératives gratuites

Recherche web menée avant de proposer une solution, pour ne pas halluciner l'état du
marché.

| Option | Vraiment gratuit ? | Réalisme | Contrainte | Verdict |
|---|---|---|---|---|
| Google Veo 3 (API/Vertex) | Non — pas de tier gratuit API, $0,15–0,60/sec | Excellent | — | Exclu |
| Runway / Pika / Kling / Luma | Non — crédits d'essai UI seulement | Bon-excellent | UI web, pas d'API gratuite automatisable | Exclu |
| Wan 2.2 (open-source, Apache 2.0) | Oui, licence vraiment libre | Correct-bon | 8–13 Go VRAM requis | Pas de runtime gratuit suffisant |
| Hugging Face Spaces + ZeroGPU (pour héberger Wan 2.2) | Gratuit mais 3,5 min de calcul GPU/jour en compte gratuit | Idem Wan 2.2 | Une génération vidéo consomme déjà plusieurs minutes — quota insuffisant pour un produit multi-utilisateurs | Prototype/démo seulement, pas prod |
| Pexels API / Pixabay API (stock existant) | Oui, gratuit et illimité (Pexels avec attribution) | Vrais humains/scènes, non générés sur mesure | Aucune | **Retenu** |

**Piège identifié** : les runtimes GPU « gratuits » (ZeroGPU, Colab, Kaggle) semblent
illimités sur le papier mais ont un quota journalier bien trop faible pour la charge
réelle d'une génération vidéo — inutilisables comme moteur de production, seulement
pour tester une fois.

## 6. Hors scope V1

- Génération vidéo par IA sur mesure (Wan 2.2 ou autre) — à réévaluer en V2 si un
  budget GPU dédié devient acceptable, ou si l'écosystème gratuit progresse.
- Montage de plusieurs clips par scène (V1 = un clip par scène, pas de montage interne).
- Upload de médias personnels par l'utilisateur (piste V2, proche des « brand kits »
  déjà notés hors-scope dans `PRD-PRO.md`).

## 7. Critères de succès

| Critère | Attendu |
|---|---|
| Réalisme | Une vidéo générée à partir d'un brief quelconque affiche de vraies scènes/humains pertinents en fond, pas uniquement du texte/formes |
| Gratuit | Aucune clé API payante requise ; fonctionne avec le seul tier gratuit Pexels |
| Robustesse | Absence de résultat Pexels ou panne API ne bloque jamais la génération (repli sur fond existant) |
| Déterminisme | Même storyboard = même clip vidéo à chaque recompilation |
| Non-régression | Le mode 100 % offline (sans clé API du tout) continue de fonctionner en repli total sur les fonds actuels |
| Tests | Sélection de mots-clés, appel API mocké, repli sur échec, respect du cache/rate-limit — couverts par tests unitaires |

## 8. Questions ouvertes pour Jeff

- Le style « fond vidéo réel + texte animé au premier plan » convient-il, ou faut-il
  explorer un format où le texte est minimal et la vidéo occupe tout l'écran (plus
  proche d'un reel/short classique) ?
- Faut-il une clé Pexels dédiée au projet dès maintenant (gratuite, à créer sur
  pexels.com/api), ou F5 la crée au moment de l'implémentation ?
