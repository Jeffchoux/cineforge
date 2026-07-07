/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * Même seed = même séquence, sur tous les runtimes.
 */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  /** Nombre dans [0, 1) */
  next(): number;
  /** Entier dans [0, maxExclusive) */
  int(maxExclusive: number): number;
  /** Élément du tableau (tableau non vide requis) */
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error("rng.pick: tableau vide");
      return items[Math.floor(next() * items.length)];
    },
  };
}
