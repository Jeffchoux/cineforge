const STORYBOARD_SNIPPET = `{
  "type": "stat",
  "start": 3,
  "duration": 5.5,
  "value": 3,
  "suffix": "×",
  "label": "plus de L-théanine que le sencha",
  "narration": "Le gyokuro contient trois fois plus…"
}`;

export function NoBlackBox() {
  return (
    <section className="border-t border-edge">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Pas de boîte noire
          </h2>
          <p className="mt-4 leading-relaxed text-mist">
            Le storyboard est un JSON lisible : chaque scène expose son type, son timing,
            son texte. Une scène vous déplaît ? Modifiez <em>cette</em> scène — pas besoin
            de tout regénérer, ni de faire confiance à la magie.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-mist">
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-accent">✓</span>
              La composition exportée est du HTML standard, ouvrable dans un navigateur.
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-accent">✓</span>
              Les animations sont des timelines GSAP seek-safe, inspectables.
            </li>
            <li className="flex gap-3">
              <span aria-hidden="true" className="text-accent">✓</span>
              Le rendu MP4 est reproductible : mêmes frames à chaque exécution.
            </li>
          </ul>
        </div>
        <div className="overflow-hidden rounded-2xl border border-edge bg-night-2/80 shadow-xl">
          <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" aria-hidden="true" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" aria-hidden="true" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" aria-hidden="true" />
            <span className="ml-2 text-xs text-mist">storyboard.json — scène 2</span>
          </div>
          <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-accent-2 sm:text-sm">
            <code>{STORYBOARD_SNIPPET}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
