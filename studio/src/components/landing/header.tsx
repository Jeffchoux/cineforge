import Link from 'next/link';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-edge bg-night/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight"
          aria-label="CineForge — accueil"
        >
          Cine<span className="text-accent">Forge</span>
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-2 sm:gap-6">
          <a
            href="#comment"
            className="hidden text-sm text-mist transition-colors hover:text-ink sm:block"
          >
            Comment ça marche
          </a>
          <a
            href="#themes"
            className="hidden text-sm text-mist transition-colors hover:text-ink sm:block"
          >
            Thèmes
          </a>
          <Link
            href="/studio"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-night transition hover:bg-accent-2 sm:px-5"
          >
            Ouvrir le Studio
          </Link>
        </nav>
      </div>
    </header>
  );
}
