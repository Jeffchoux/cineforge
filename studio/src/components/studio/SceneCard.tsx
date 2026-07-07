"use client";

import type { MetaphorVisual, Scene } from "@/lib/engine";
import { METAPHOR_VISUAL_LABELS, SCENE_TYPE_META, formatTime, round2 } from "./helpers";

interface SceneCardProps {
  scene: Scene;
  index: number;
  isActive: boolean;
  onChange: (next: Scene) => void;
  onSelect: () => void;
}

const fieldClass =
  "w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/40";
const labelClass = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500";

export function SceneCard({ scene, index, isActive, onChange, onSelect }: SceneCardProps) {
  const meta = SCENE_TYPE_META[scene.type];

  const patch = (partial: Partial<Scene>) => onChange({ ...scene, ...partial } as Scene);

  return (
    <article
      onClick={onSelect}
      className={`flex w-72 flex-none cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors sm:w-80 ${
        isActive ? "border-indigo-400/60 bg-indigo-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
      aria-label={`Scène ${index + 1} : ${meta.label}`}
    >
      <header className="flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
          {index + 1} · {meta.label}
        </span>
        <span className="text-xs tabular-nums text-slate-500">
          {formatTime(scene.start)} → {formatTime(scene.start + scene.duration)}
        </span>
      </header>

      <SceneFields scene={scene} onPatch={patch} />

      <div>
        <label htmlFor={`dur-${scene.id}`} className={labelClass}>
          Durée : {scene.duration.toFixed(1).replace(".", ",")} s
        </label>
        <input
          id={`dur-${scene.id}`}
          type="range"
          min={1}
          max={20}
          step={0.5}
          value={scene.duration}
          onChange={(e) => patch({ duration: round2(Number(e.target.value)) })}
          onClick={(e) => e.stopPropagation()}
          className="w-full accent-indigo-400"
        />
      </div>
    </article>
  );
}

function SceneFields({ scene, onPatch }: { scene: Scene; onPatch: (p: Partial<Scene>) => void }) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  switch (scene.type) {
    case "hook":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div>
            <label htmlFor={`t-${scene.id}`} className={labelClass}>Titre</label>
            <textarea id={`t-${scene.id}`} rows={2} value={scene.title} onChange={(e) => onPatch({ title: e.target.value })} className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`a-${scene.id}`} className={labelClass}>Mot accentué</label>
              <input id={`a-${scene.id}`} value={scene.accentWord ?? ""} onChange={(e) => onPatch({ accentWord: e.target.value || undefined })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`k-${scene.id}`} className={labelClass}>Kicker</label>
              <input id={`k-${scene.id}`} value={scene.kicker ?? ""} onChange={(e) => onPatch({ kicker: e.target.value || undefined })} className={fieldClass} />
            </div>
          </div>
        </div>
      );
    case "metaphor":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div>
            <label htmlFor={`v-${scene.id}`} className={labelClass}>Visuel</label>
            <select
              id={`v-${scene.id}`}
              value={scene.visual}
              onChange={(e) => onPatch({ visual: e.target.value as MetaphorVisual })}
              className={fieldClass}
            >
              {Object.entries(METAPHOR_VISUAL_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`l-${scene.id}`} className={labelClass}>Label</label>
            <input id={`l-${scene.id}`} value={scene.label} onChange={(e) => onPatch({ label: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`c-${scene.id}`} className={labelClass}>Légende</label>
            <textarea id={`c-${scene.id}`} rows={2} value={scene.caption} onChange={(e) => onPatch({ caption: e.target.value })} className={fieldClass} />
          </div>
        </div>
      );
    case "stat":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`v-${scene.id}`} className={labelClass}>Valeur</label>
              <input
                id={`v-${scene.id}`}
                type="number"
                value={scene.value}
                onChange={(e) => onPatch({ value: Number(e.target.value) || 0 })}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`s-${scene.id}`} className={labelClass}>Suffixe</label>
              <input id={`s-${scene.id}`} value={scene.suffix ?? ""} onChange={(e) => onPatch({ suffix: e.target.value || undefined })} placeholder="%, ×, h…" className={fieldClass} />
            </div>
          </div>
          <div>
            <label htmlFor={`l-${scene.id}`} className={labelClass}>Label</label>
            <textarea id={`l-${scene.id}`} rows={2} value={scene.label} onChange={(e) => onPatch({ label: e.target.value })} className={fieldClass} />
          </div>
        </div>
      );
    case "steps":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div>
            <label htmlFor={`t-${scene.id}`} className={labelClass}>Titre</label>
            <input id={`t-${scene.id}`} value={scene.title} onChange={(e) => onPatch({ title: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`i-${scene.id}`} className={labelClass}>Étapes (1 par ligne, max 4)</label>
            <textarea
              id={`i-${scene.id}`}
              rows={3}
              value={scene.items.join("\n")}
              onChange={(e) =>
                onPatch({ items: e.target.value.split("\n").map((s) => s.trimStart()).filter(Boolean).slice(0, 4) })
              }
              className={fieldClass}
            />
          </div>
        </div>
      );
    case "comparison":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div>
            <label htmlFor={`t-${scene.id}`} className={labelClass}>Titre</label>
            <textarea id={`t-${scene.id}`} rows={2} value={scene.title} onChange={(e) => onPatch({ title: e.target.value })} className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`ll-${scene.id}`} className={labelClass}>Label gauche</label>
              <input id={`ll-${scene.id}`} value={scene.leftLabel} onChange={(e) => onPatch({ leftLabel: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`lv-${scene.id}`} className={labelClass}>Valeur (0–100)</label>
              <input id={`lv-${scene.id}`} type="number" min={0} max={100} value={scene.leftValue} onChange={(e) => onPatch({ leftValue: Number(e.target.value) || 0 })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`rl-${scene.id}`} className={labelClass}>Label droit</label>
              <input id={`rl-${scene.id}`} value={scene.rightLabel} onChange={(e) => onPatch({ rightLabel: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={`rv-${scene.id}`} className={labelClass}>Valeur (0–100)</label>
              <input id={`rv-${scene.id}`} type="number" min={0} max={100} value={scene.rightValue} onChange={(e) => onPatch({ rightValue: Number(e.target.value) || 0 })} className={fieldClass} />
            </div>
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div>
            <label htmlFor={`q-${scene.id}`} className={labelClass}>Citation</label>
            <textarea id={`q-${scene.id}`} rows={3} value={scene.text} onChange={(e) => onPatch({ text: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`a-${scene.id}`} className={labelClass}>Auteur</label>
            <input id={`a-${scene.id}`} value={scene.author ?? ""} onChange={(e) => onPatch({ author: e.target.value || undefined })} className={fieldClass} />
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="flex flex-col gap-2" onClick={stop}>
          <div>
            <label htmlFor={`t-${scene.id}`} className={labelClass}>Titre</label>
            <input id={`t-${scene.id}`} value={scene.title} onChange={(e) => onPatch({ title: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`s-${scene.id}`} className={labelClass}>Sous-titre</label>
            <input id={`s-${scene.id}`} value={scene.subtitle ?? ""} onChange={(e) => onPatch({ subtitle: e.target.value || undefined })} className={fieldClass} />
          </div>
        </div>
      );
  }
}
