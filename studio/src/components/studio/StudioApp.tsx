"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Brief, Scene, Storyboard } from "@/lib/engine";
import { BRIEF_LIMITS, compileStoryboard, planStoryboard } from "@/lib/engine";
import { BriefForm, type BriefFormState } from "./BriefForm";
import { PreviewPlayer } from "./PreviewPlayer";
import { SceneCard } from "./SceneCard";
import { ExportPanel } from "./ExportPanel";
import { retimeScenes } from "./helpers";

const DEFAULT_FORM: BriefFormState = {
  topic: "",
  pointsText: "",
  durationSec: 25,
  vibe: "cinematic",
  aspect: "16:9",
  themeId: "auto",
  language: "fr",
  useAi: false,
};

export function StudioApp() {
  const [form, setForm] = useState<BriefFormState>(DEFAULT_FORM);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [captions, setCaptions] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const buildBrief = useCallback(
    (seed?: number): Brief => ({
      topic: form.topic,
      points: form.pointsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, BRIEF_LIMITS.pointsMax),
      durationSec: form.durationSec,
      vibe: form.vibe,
      aspect: form.aspect,
      language: form.language,
      themeId: form.themeId === "auto" ? undefined : form.themeId,
      seed,
    }),
    [form],
  );

  const generate = useCallback(
    async (seed?: number) => {
      let next: Storyboard;
      try {
        // Le planner local valide le brief et sert de base (et de repli).
        next = planStoryboard(buildBrief(seed));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Génération impossible.");
        return;
      }
      setError(null);
      setAiStatus(null);

      if (form.useAi) {
        setGenerating(true);
        setAiStatus("L'IA écrit le storyboard…");
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ brief: buildBrief(seed) }),
          });
          if (res.ok) {
            const data = (await res.json()) as { storyboard?: Storyboard };
            if (data.storyboard?.scenes?.length) {
              next = data.storyboard;
              setAiStatus("Storyboard écrit par l'IA ✓");
            } else {
              setAiStatus("Réponse IA vide — génération locale utilisée.");
            }
          } else if (res.status === 501) {
            setAiStatus("Mode IA non configuré sur ce serveur — génération locale utilisée.");
          } else if (res.status === 429) {
            setAiStatus("Trop de requêtes IA — génération locale utilisée.");
          } else {
            setAiStatus("IA indisponible — génération locale utilisée.");
          }
        } catch {
          setAiStatus("IA injoignable — génération locale utilisée.");
        } finally {
          setGenerating(false);
        }
      }

      setStoryboard(next);
      setActiveSceneId(null);
    },
    [buildBrief, form.useAi],
  );

  const variation = useCallback(() => {
    void generate(Math.floor(Math.random() * 2 ** 31));
  }, [generate]);

  // Recompile la preview avec un debounce à chaque édition du storyboard.
  useEffect(() => {
    if (!storyboard) return;
    const timer = window.setTimeout(() => setHtml(compileStoryboard(storyboard, { captions })), 300);
    return () => window.clearTimeout(timer);
  }, [storyboard, captions]);

  // Raccourci ⌘/Ctrl + Entrée → générer.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void generate();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generate]);

  const updateScene = useCallback((next: Scene) => {
    setStoryboard((prev) => {
      if (!prev) return prev;
      return retimeScenes({
        ...prev,
        scenes: prev.scenes.map((scene) => (scene.id === next.id ? next : scene)),
      });
    });
  }, []);

  const totalLabel = useMemo(
    () => (storyboard ? `${storyboard.durationSec.toFixed(1).replace(".", ",")} s` : ""),
    [storyboard],
  );

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070f]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-sky-400 text-sm">▶</span>
            CineForge <span className="font-normal text-slate-400">Studio</span>
          </Link>
          {storyboard && (
            <span className="hidden text-sm text-slate-400 sm:block">
              {storyboard.scenes.length} scènes · {totalLabel} · {storyboard.aspect}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <h1 className="sr-only">CineForge Studio — créez votre vidéo depuis un brief</h1>
        {/* Brief — après la preview en mobile, à gauche en desktop */}
        <section
          aria-label="Composer"
          className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:sticky lg:top-20"
        >
          <h2 className="mb-4 text-base font-semibold text-white">1 · Décrivez votre vidéo</h2>
          <BriefForm
            value={form}
            error={error}
            hasStoryboard={storyboard !== null}
            aiStatus={aiStatus}
            generating={generating}
            onChange={setForm}
            onGenerate={() => void generate()}
            onVariation={variation}
          />
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          {storyboard && html ? (
            <>
              <section aria-label="Prévisualisation" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-white">2 · Prévisualisez</h2>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={captions}
                      onChange={(e) => setCaptions(e.target.checked)}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    Sous-titres (narration)
                  </label>
                </div>
                <PreviewPlayer
                  html={html}
                  width={storyboard.width}
                  height={storyboard.height}
                  duration={storyboard.durationSec}
                  scenes={storyboard.scenes}
                />
              </section>

              <section aria-label="Storyboard" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">3 · Éditez le storyboard</h2>
                  <span className="text-xs text-slate-500">Chaque scène est un fichier ouvert — pas de boîte noire.</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2" role="list" aria-label="Scènes du storyboard">
                  {storyboard.scenes.map((scene, index) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      index={index}
                      isActive={activeSceneId === scene.id}
                      onChange={updateScene}
                      onSelect={() => setActiveSceneId(scene.id)}
                    />
                  ))}
                </div>
              </section>

              <section aria-label="Exporter" className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="mb-4 text-base font-semibold text-white">4 · Exportez</h2>
                <ExportPanel storyboard={storyboard} html={html} />
              </section>
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  const steps = [
    { num: "1", title: "Décrivez", text: "Un sujet, une durée, une vibe. C'est tout ce qu'il faut." },
    { num: "2", title: "Prévisualisez", text: "La vidéo se joue instantanément dans votre navigateur." },
    { num: "3", title: "Éditez & exportez", text: "Chaque scène est éditable, puis MP4 en local — gratuit, sans limite." },
  ];
  return (
    <section
      aria-label="Commencer"
      className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8"
    >
      <div className="max-w-md text-center">
        <div aria-hidden className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-sky-400/30 text-3xl">
          🎬
        </div>
        <h2 className="text-xl font-bold text-white">Votre première vidéo en 30 secondes</h2>
        <p className="mt-2 text-sm text-slate-400">
          Décrivez votre vidéo dans le panneau « Composer », puis appuyez sur <strong>Générer</strong>.
        </p>
        <div className="mt-8 grid gap-4 text-left">
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-300">
                {step.num}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-200">{step.title}</p>
                <p className="text-sm text-slate-500">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
