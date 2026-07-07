import type { Language, MetaphorVisual } from "./types";

/**
 * Bibliothèque de formules FR/EN pour le mode heuristique (sans IA).
 * `{topic}` est remplacé par le sujet du brief.
 */

export interface CopyDeck {
  hooks: string[];
  kickers: string[];
  metaphorCaptions: Record<MetaphorVisual, string>;
  metaphorLabels: Record<MetaphorVisual, string>;
  quotes: string[];
  ctas: { title: string; subtitle: string }[];
  narrationHook: string[];
  narrationCta: string[];
  stepsTitle: string[];
  genericSteps: string[][];
}

export const COPY: Record<Language, CopyDeck> = {
  fr: {
    hooks: [
      "Ce que personne ne vous dit sur {topic}",
      "{topic} : tout le monde se trompe",
      "Et si {topic} changeait tout ?",
      "La vérité sur {topic}",
      "{topic}, expliqué en quelques secondes",
    ],
    kickers: ["DÉCRYPTAGE", "L'ESSENTIEL", "EN CLAIR", "FOCUS"],
    metaphorCaptions: {
      battery: "Chaque effort recharge la batterie. Jour après jour.",
      orbit: "Tout gravite autour d'un seul principe.",
      growth: "Petit au départ. Immense à l'arrivée.",
      pulse: "Un rythme régulier bat tous les sprints.",
      network: "Chaque connexion multiplie la valeur du reste.",
    },
    metaphorLabels: {
      battery: "Rechargez",
      orbit: "Le centre de gravité",
      growth: "L'effet cumulé",
      pulse: "La régularité",
      network: "L'effet réseau",
    },
    quotes: [
      "La simplicité est la sophistication suprême.",
      "Ce qui se mesure s'améliore.",
      "Le meilleur moment pour commencer, c'était hier. Le deuxième meilleur, c'est maintenant.",
      "On ne subit pas l'avenir, on le fait.",
    ],
    ctas: [
      { title: "À vous de jouer.", subtitle: "Commencez aujourd'hui." },
      { title: "Retenez l'essentiel.", subtitle: "Le reste suivra." },
      { title: "Passez à l'action.", subtitle: "Une étape à la fois." },
    ],
    narrationHook: [
      "Parlons de {topic}.",
      "Voici ce qu'il faut vraiment comprendre sur {topic}.",
    ],
    narrationCta: ["Maintenant, c'est à vous.", "Vous savez ce qu'il vous reste à faire."],
    stepsTitle: ["3 étapes clés", "La méthode", "Comment s'y prendre"],
    genericSteps: [
      ["Comprendre les bases", "Pratiquer chaque jour", "Mesurer ses progrès"],
      ["Observer", "Décider", "Agir"],
      ["Simplifier", "Automatiser", "Amplifier"],
    ],
  },
  en: {
    hooks: [
      "What nobody tells you about {topic}",
      "{topic}: everyone gets it wrong",
      "What if {topic} changed everything?",
      "The truth about {topic}",
      "{topic}, explained in seconds",
    ],
    kickers: ["DEEP DIVE", "THE ESSENTIALS", "IN FOCUS", "EXPLAINED"],
    metaphorCaptions: {
      battery: "Every effort recharges the battery. Day after day.",
      orbit: "Everything orbits around one core principle.",
      growth: "Small at first. Massive at the end.",
      pulse: "A steady rhythm beats every sprint.",
      network: "Each connection multiplies the value of the rest.",
    },
    metaphorLabels: {
      battery: "Recharge",
      orbit: "The center of gravity",
      growth: "Compound effect",
      pulse: "Consistency",
      network: "Network effect",
    },
    quotes: [
      "Simplicity is the ultimate sophistication.",
      "What gets measured gets improved.",
      "The best time to start was yesterday. The second best is now.",
      "The future is not something we endure, it is something we make.",
    ],
    ctas: [
      { title: "Your move.", subtitle: "Start today." },
      { title: "Remember the essentials.", subtitle: "The rest will follow." },
      { title: "Take action.", subtitle: "One step at a time." },
    ],
    narrationHook: [
      "Let's talk about {topic}.",
      "Here is what you really need to understand about {topic}.",
    ],
    narrationCta: ["Now it's your turn.", "You know what to do."],
    stepsTitle: ["3 key steps", "The method", "How to do it"],
    genericSteps: [
      ["Understand the basics", "Practice daily", "Measure progress"],
      ["Observe", "Decide", "Act"],
      ["Simplify", "Automate", "Amplify"],
    ],
  },
};

export function fillTopic(template: string, topic: string): string {
  return template.replace(/\{topic\}/g, topic);
}
