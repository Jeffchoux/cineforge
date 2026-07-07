const STEPS = [
  {
    num: '01',
    title: 'Décrivez votre vidéo',
    text: 'Un sujet, une durée, une ambiance. Ajoutez vos points clés si vous voulez guider le récit — sinon le moteur construit l’arc narratif tout seul.',
  },
  {
    num: '02',
    title: 'Éditez le storyboard',
    text: 'Chaque scène est une carte : hook, statistique, métaphore visuelle, étapes, citation, CTA. Modifiez le texte, la durée ou le thème, la preview se met à jour instantanément.',
  },
  {
    num: '03',
    title: 'Exportez',
    text: 'Téléchargez la composition HTML autonome ou rendez un vrai MP4 en local — frame par frame, en qualité déterministe, compatible HyperFrames.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="comment" className="scroll-mt-20 border-t border-edge">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Comment ça marche
        </h2>
        <p className="mt-3 max-w-lg text-mist">
          Trois étapes, aucun logiciel de montage. La vidéo est une page web —
          vous la décrivez, le moteur l&apos;écrit.
        </p>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li
              key={step.num}
              className="group relative rounded-2xl border border-edge bg-card p-6 transition hover:border-accent/50 sm:p-8"
            >
              <span className="font-display text-sm font-bold text-accent">{step.num}</span>
              <h3 className="mt-3 font-display text-xl font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
