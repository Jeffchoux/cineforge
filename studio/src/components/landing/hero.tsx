import Link from 'next/link';

/**
 * Faux player animé en pur CSS : trois « scènes » se relaient en boucle
 * (hook → stat → CTA) au-dessus d'une timeline de chips, comme dans le Studio.
 */
function FakePlayer() {
  return (
    <div className="cf-float w-full max-w-xl" aria-hidden="true">
      <div className="overflow-hidden rounded-2xl border border-edge bg-night-2/80 shadow-2xl shadow-accent/10">
        {/* Stage 16:9 */}
        <div className="relative aspect-video bg-[radial-gradient(ellipse_at_30%_20%,#131a3d_0%,#05070f_75%)]">
          {/* Scène 1 — hook */}
          <div className="cf-scene cf-scene-1 absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-accent sm:text-xs">
              Décryptage
            </span>
            <span className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">
              Le sommeil est votre <span className="text-accent">super-pouvoir</span>
            </span>
          </div>
          {/* Scène 2 — stat */}
          <div className="cf-scene cf-scene-2 absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
            <span className="font-display text-5xl font-extrabold text-accent sm:text-6xl">×3</span>
            <span className="max-w-xs text-sm font-medium text-ink/90 sm:text-base">
              de concentration après une vraie nuit de repos
            </span>
            <div className="mt-2 h-2.5 w-40 overflow-hidden rounded-full border border-edge bg-card sm:w-52">
              <div className="cf-fill h-full rounded-full bg-gradient-to-r from-accent to-accent-2" />
            </div>
          </div>
          {/* Scène 3 — CTA */}
          <div className="cf-scene cf-scene-3 absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="font-display text-3xl font-extrabold sm:text-4xl">
              8 heures. Chaque nuit.
            </span>
            <div className="h-1.5 w-24 rounded-full bg-gradient-to-r from-accent to-accent-2" />
          </div>
        </div>
        {/* Barre de contrôle */}
        <div className="border-t border-edge px-4 py-3">
          <div className="h-1 overflow-hidden rounded-full bg-card">
            <div className="cf-progress h-full w-full bg-gradient-to-r from-accent to-accent-2" />
          </div>
          <div className="mt-3 flex gap-2">
            <span className="cf-chip cf-chip-1 rounded-md border px-2.5 py-1 text-[10px] font-medium text-mist sm:text-xs">
              1 · Hook
            </span>
            <span className="cf-chip cf-chip-2 rounded-md border px-2.5 py-1 text-[10px] font-medium text-mist sm:text-xs">
              2 · Stat
            </span>
            <span className="cf-chip cf-chip-3 rounded-md border px-2.5 py-1 text-[10px] font-medium text-mist sm:text-xs">
              3 · CTA
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:gap-16 lg:pb-28">
        <div className="flex flex-col items-start gap-6">
          <p className="rounded-full border border-edge bg-card px-3 py-1 text-xs font-medium text-mist">
            Open source · Rendu local · Zéro crédit
          </p>
          <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Décrivez.
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              Générez.
            </span>
            <br />
            Diffusez.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-mist sm:text-lg">
            Une phrase devient une vidéo professionnelle : CineForge la compose en HTML animé,
            vous l&apos;éditez scène par scène, puis vous l&apos;exportez en MP4.
            Sans timeline. Sans crédits. Sans boîte noire.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/studio"
              className="rounded-full bg-accent px-6 py-3 font-semibold text-night shadow-lg shadow-accent/25 transition hover:bg-accent-2"
            >
              Créer ma première vidéo
            </Link>
            <a
              href="#comment"
              className="rounded-full border border-edge px-6 py-3 font-medium text-ink transition hover:border-accent hover:text-accent"
            >
              Comment ça marche
            </a>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <FakePlayer />
        </div>
      </div>
    </section>
  );
}
