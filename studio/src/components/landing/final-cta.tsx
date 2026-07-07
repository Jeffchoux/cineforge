import Link from 'next/link';

export function FinalCta() {
  return (
    <section className="border-t border-edge">
      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          Votre prochaine vidéo tient{' '}
          <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
            en une phrase
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-md text-mist">
          Gratuit, open source, sur votre machine. Décrivez, le moteur compose.
        </p>
        <Link
          href="/studio"
          className="mt-8 inline-block rounded-full bg-accent px-8 py-4 font-semibold text-night shadow-lg shadow-accent/25 transition hover:bg-accent-2"
        >
          Ouvrir le Studio
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-edge">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-mist sm:flex-row sm:px-6">
        <p>
          <span className="font-display font-bold text-ink">
            Cine<span className="text-accent">Forge</span>
          </span>{' '}
          — studio vidéo open source
        </p>
        <p>
          Propulsé par le contrat de composition{' '}
          <a
            href="https://github.com/heygen-com/hyperframes"
            className="underline decoration-edge underline-offset-4 transition hover:text-accent"
            rel="noopener noreferrer"
            target="_blank"
          >
            HyperFrames
          </a>{' '}
          · Apache-2.0 friendly
        </p>
      </div>
    </footer>
  );
}
