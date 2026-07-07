const FEATURES = [
  {
    title: 'Déterministe & testable',
    text: 'Même brief + même graine = même vidéo, pixel pour pixel. Idéal pour la CI et les itérations contrôlées.',
    icon: '⚙️',
  },
  {
    title: '5 thèmes design',
    text: 'Midnight, Paper, Neon, Broadcast, Pastel — palettes, typographies et rayons cohérents, prêts à diffuser.',
    icon: '🎨',
  },
  {
    title: '7 types de scènes',
    text: 'Hook, métaphore animée, statistique, étapes, comparaison, citation, CTA — l’arc narratif complet.',
    icon: '🎬',
  },
  {
    title: 'Preview instantanée',
    text: 'La vidéo est une page web : le player la lit directement dans le navigateur, avec timeline et scrubbing.',
    icon: '⚡',
  },
  {
    title: 'Interop HyperFrames',
    text: 'Compositions conformes au contrat data-* de HyperFrames — rendables aussi avec npx hyperframes render.',
    icon: '🔗',
  },
  {
    title: 'Offline-first',
    text: 'Le mode heuristique fonctionne sans clé API ni compte. L’IA est un amplificateur, pas une dépendance.',
    icon: '🔒',
  },
] as const;

export function Features() {
  return (
    <section className="border-t border-edge">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Un studio complet, pas un jouet
        </h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-edge bg-card p-6 transition hover:border-accent/50"
            >
              <span aria-hidden="true" className="text-2xl">
                {feature.icon}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
