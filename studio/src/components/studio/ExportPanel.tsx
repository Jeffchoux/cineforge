"use client";

import { useState } from "react";
import type { Storyboard } from "@/lib/engine";
import { downloadBlob, slugify } from "./helpers";

interface ExportPanelProps {
  storyboard: Storyboard;
  html: string;
}

export function ExportPanel({ storyboard, html }: ExportPanelProps) {
  const [showMp4Panel, setShowMp4Panel] = useState(false);
  const [copied, setCopied] = useState<"json" | "cmd" | null>(null);

  const slug = slugify(storyboard.title);
  const json = JSON.stringify(storyboard, null, 2);
  const renderCommand = `npm run render -- --storyboard ${slug}.json`;

  const copy = async (text: string, tag: "json" | "cmd") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Presse-papiers indisponible (permissions) — on ignore silencieusement.
    }
  };

  const buttonClass =
    "rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => downloadBlob(html, `${slug}.html`, "text/html;charset=utf-8")}
        >
          ⬇ Télécharger HTML
        </button>
        <button type="button" className={buttonClass} onClick={() => copy(json, "json")}>
          {copied === "json" ? "✓ Copié" : "⧉ Copier le storyboard JSON"}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => downloadBlob(json, `${slug}.json`, "application/json")}
        >
          ⬇ Storyboard .json
        </button>
        <button
          type="button"
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          onClick={() => setShowMp4Panel(true)}
        >
          🎬 Exporter en MP4
        </button>
      </div>

      {showMp4Panel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export MP4"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setShowMp4Panel(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowMp4Panel(false);
          }}
        >
          <div
            ref={(el) => el?.focus()}
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f1e] p-6 shadow-2xl outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Export MP4 (rendu local)</h3>
            <p className="mt-2 text-sm text-slate-400">
              Le rendu vidéo se fait sur votre machine via Playwright + FFmpeg — gratuit, sans limite, sans
              cloud.
            </p>
            <ol className="mt-4 flex flex-col gap-3 text-sm text-slate-300">
              <li>
                <span className="font-semibold text-indigo-300">1.</span> Téléchargez le storyboard :
                <button
                  type="button"
                  className="ml-2 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10"
                  onClick={() => downloadBlob(json, `${slug}.json`, "application/json")}
                >
                  ⬇ {slug}.json
                </button>
              </li>
              <li>
                <span className="font-semibold text-indigo-300">2.</span> Depuis le dossier{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">studio/</code>, lancez :
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 overflow-x-auto rounded-lg bg-black/60 px-3 py-2 text-xs text-emerald-300">
                    {renderCommand}
                  </code>
                  <button
                    type="button"
                    className="rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-xs hover:bg-white/10"
                    onClick={() => copy(renderCommand, "cmd")}
                  >
                    {copied === "cmd" ? "✓" : "⧉"}
                  </button>
                </div>
              </li>
              <li>
                <span className="font-semibold text-indigo-300">3.</span> Le MP4 apparaît dans{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">renders/</code>.
              </li>
            </ol>
            <button
              type="button"
              className="mt-5 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
              onClick={() => setShowMp4Panel(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
