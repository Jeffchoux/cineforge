"use client";

import type { AspectRatio, Language, ThemeId, Vibe } from "@/lib/engine";
import { BRIEF_LIMITS, THEMES } from "@/lib/engine";
import { VIBE_LABELS } from "./helpers";

export interface BriefFormState {
  topic: string;
  pointsText: string;
  durationSec: number;
  vibe: Vibe;
  aspect: AspectRatio;
  themeId: ThemeId | "auto";
  language: Language;
}

interface BriefFormProps {
  value: BriefFormState;
  error: string | null;
  hasStoryboard: boolean;
  onChange: (next: BriefFormState) => void;
  onGenerate: () => void;
  onVariation: () => void;
}

const VIBES: Vibe[] = ["cinematic", "minimal", "energetic", "techy", "warm"];
const ASPECTS: { id: AspectRatio; label: string }[] = [
  { id: "16:9", label: "16:9 · Paysage" },
  { id: "9:16", label: "9:16 · Vertical" },
  { id: "1:1", label: "1:1 · Carré" },
];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

export function BriefForm({ value, error, hasStoryboard, onChange, onGenerate, onVariation }: BriefFormProps) {
  const set = <K extends keyof BriefFormState>(key: K, v: BriefFormState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
      aria-label="Brief de la vidéo"
    >
      <div>
        <label htmlFor="cf-topic" className="mb-1.5 block text-sm font-medium text-slate-300">
          Sujet de la vidéo <span className="text-rose-400">*</span>
        </label>
        <textarea
          id="cf-topic"
          value={value.topic}
          onChange={(e) => set("topic", e.target.value.slice(0, BRIEF_LIMITS.topicMax))}
          placeholder="Ex. : les bienfaits du thé gyokuro"
          rows={2}
          className={inputClass}
          required
        />
        <p className="mt-1 text-right text-xs text-slate-500">
          {value.topic.length}/{BRIEF_LIMITS.topicMax}
        </p>
      </div>

      <div>
        <label htmlFor="cf-points" className="mb-1.5 block text-sm font-medium text-slate-300">
          Points clés <span className="text-slate-500">(optionnel, 1 par ligne, max {BRIEF_LIMITS.pointsMax})</span>
        </label>
        <textarea
          id="cf-points"
          value={value.pointsText}
          onChange={(e) => set("pointsText", e.target.value)}
          placeholder={"3x plus de L-théanine\nOmbre vs plein soleil\nChoisir, chauffer à 60°, infuser 2 min"}
          rows={4}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="cf-duration" className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-300">
          <span>Durée</span>
          <span className="font-semibold text-indigo-300">{value.durationSec} s</span>
        </label>
        <input
          id="cf-duration"
          type="range"
          min={BRIEF_LIMITS.durationMin}
          max={BRIEF_LIMITS.durationMax}
          step={1}
          value={value.durationSec}
          onChange={(e) => set("durationSec", Number(e.target.value))}
          className="w-full accent-indigo-400"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{BRIEF_LIMITS.durationMin} s</span>
          <span>{BRIEF_LIMITS.durationMax} s</span>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-300">Vibe</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vibe">
          {VIBES.map((vibe) => (
            <button
              key={vibe}
              type="button"
              role="radio"
              aria-checked={value.vibe === vibe}
              onClick={() => set("vibe", vibe)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                value.vibe === vibe
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-slate-200"
              }`}
            >
              {VIBE_LABELS[vibe]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-300">Format</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format">
          {ASPECTS.map((aspect) => (
            <button
              key={aspect.id}
              type="button"
              role="radio"
              aria-checked={value.aspect === aspect.id}
              onClick={() => set("aspect", aspect.id)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                value.aspect === aspect.id
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-slate-200"
              }`}
            >
              {aspect.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-300">Thème</legend>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Thème">
          <button
            type="button"
            role="radio"
            aria-checked={value.themeId === "auto"}
            onClick={() => set("themeId", "auto")}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              value.themeId === "auto"
                ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                : "border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-slate-200"
            }`}
          >
            Auto
          </button>
          {Object.values(THEMES).map((theme) => (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={value.themeId === theme.id}
              title={theme.name}
              aria-label={`Thème ${theme.name}`}
              onClick={() => set("themeId", theme.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition-colors ${
                value.themeId === theme.id
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-slate-200"
              }`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-white/30"
                style={{ background: theme.accent }}
              />
              {theme.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="cf-language" className="mb-1.5 block text-sm font-medium text-slate-300">
          Langue
        </label>
        <select
          id="cf-language"
          value={value.language}
          onChange={(e) => set("language", e.target.value as Language)}
          className={inputClass}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          Générer la vidéo
        </button>
        {hasStoryboard && (
          <button
            type="button"
            onClick={onVariation}
            title="Régénérer avec une nouvelle graine aléatoire"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Variation
          </button>
        )}
      </div>
      <p className="text-center text-xs text-slate-500">Astuce : ⌘/Ctrl + Entrée pour générer</p>
    </form>
  );
}
