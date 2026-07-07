import { THEMES } from '@/lib/engine/themes';

const THEME_DESCRIPTIONS: Record<string, string> = {
  midnight: 'Cinématique, profond, indigo électrique.',
  paper: 'Minimal, lumineux, éditorial.',
  neon: 'Énergique, nocturne, fuchsia × cyan.',
  broadcast: 'Journal télévisé, ambre sur acier.',
  pastel: 'Chaleureux, doux, violet poudré.',
};

export function ThemeGallery() {
  const themes = Object.values(THEMES);
  return (
    <section id="themes" className="scroll-mt-20 border-t border-edge">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Cinq thèmes, une direction artistique
        </h2>
        <p className="mt-3 max-w-lg text-mist">
          Chaque thème est un système complet — fond, encre, accents, typographies —
          appliqué à toutes les scènes de la vidéo.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {themes.map((theme) => (
            <figure
              key={theme.id}
              className="overflow-hidden rounded-2xl border border-edge bg-card transition hover:border-accent/50"
            >
              <div
                className="flex h-28 items-center justify-center"
                style={{ background: theme.bg }}
                aria-hidden="true"
              >
                <span
                  className="font-display text-lg font-extrabold"
                  style={{ color: theme.ink }}
                >
                  Aa<span style={{ color: theme.accent }}>.</span>
                </span>
              </div>
              <figcaption className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold">{theme.name}</span>
                  <span className="flex gap-1" aria-hidden="true">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: theme.accent }}
                    />
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: theme.accent2 }}
                    />
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-mist">
                  {THEME_DESCRIPTIONS[theme.id]}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
