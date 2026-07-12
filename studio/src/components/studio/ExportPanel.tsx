"use client";

import { useRef, useState } from "react";
import type { Storyboard } from "@/lib/engine";
import { downloadBlob, renderCommandFor, slugify } from "./helpers";

interface ExportPanelProps {
  storyboard: Storyboard;
  html: string;
}

type Phase = "idle" | "starting" | "rendering" | "done" | "error";

export function ExportPanel({ storyboard, html }: ExportPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [showLocal, setShowLocal] = useState(false);
  const [copied, setCopied] = useState<"json" | "cmd" | null>(null);
  const cancelRef = useRef(false);

  const slug = slugify(storyboard.title);
  const json = JSON.stringify(storyboard, null, 2);
  const renderCommand = renderCommandFor(slug);

  const copy = async (text: string, tag: "json" | "cmd") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Presse-papiers indisponible (permissions) — on ignore silencieusement.
    }
  };

  const triggerDownload = (id: string) => {
    const a = document.createElement("a");
    a.href = `/api/render/download?id=${id}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const createVideo = async () => {
    cancelRef.current = false;
    setPhase("starting");
    setProgress(0);
    setMessage("");
    setJobId(null);

    let id: string;
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboard }),
      });
      if (res.status === 501) {
        // Rendu cloud non configuré → on propose l'export local, honnêtement.
        setPhase("idle");
        setShowLocal(true);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setPhase("error");
        setMessage(
          res.status === 429
            ? "Trop de rendus lancés — réessayez dans un moment."
            : "Le rendu n'a pas pu démarrer.",
        );
        return;
      }
      id = data.id;
      setJobId(id);
    } catch {
      setPhase("error");
      setMessage("Service de rendu injoignable.");
      return;
    }

    setPhase("rendering");
    // Polling jusqu'à done/error.
    for (;;) {
      if (cancelRef.current) return;
      await new Promise((r) => setTimeout(r, 1500));
      let s: { status?: string; progress?: number; error?: string };
      try {
        const r = await fetch(`/api/render/status?id=${id}`);
        s = (await r.json()) as typeof s;
      } catch {
        continue; // hoquet réseau : on retente
      }
      if (typeof s.progress === "number") setProgress(s.progress);
      if (s.status === "done") {
        setPhase("done");
        triggerDownload(id);
        return;
      }
      if (s.status === "error") {
        setPhase("error");
        setMessage(s.error?.split("\n")[0] ?? "Le rendu a échoué.");
        return;
      }
    }
  };

  const buttonClass =
    "rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-300";
  const busy = phase === "starting" || phase === "rendering";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
          onClick={createVideo}
        >
          {phase === "starting" && "Préparation…"}
          {phase === "rendering" && `Rendu ${progress}%…`}
          {phase === "done" && "✓ Vidéo prête"}
          {(phase === "idle" || phase === "error") && "🎬 Créer ma vidéo (MP4)"}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() => downloadBlob(html, `${slug}.html`, "text/html;charset=utf-8")}
        >
          ⬇ HTML
        </button>
        <button type="button" className={buttonClass} onClick={() => copy(json, "json")}>
          {copied === "json" ? "✓ Copié" : "⧉ Storyboard JSON"}
        </button>
        <button type="button" className="text-xs text-slate-400 underline hover:text-slate-200" onClick={() => setShowLocal(true)}>
          Rendu local (avancé)
        </button>
      </div>

      {phase === "rendering" && (
        <div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression du rendu vidéo"
            className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-sky-400 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">Votre vidéo se rend sur nos serveurs — restez sur la page.</p>
        </div>
      )}

      {phase === "done" && jobId && (
        <p className="text-sm text-emerald-300">
          Votre MP4 s&apos;est téléchargé.{" "}
          <button type="button" className="underline hover:text-emerald-200" onClick={() => triggerDownload(jobId)}>
            Retélécharger
          </button>
        </p>
      )}

      {phase === "error" && (
        <p className="text-sm text-rose-300" role="alert">
          {message}{" "}
          <button type="button" className="underline hover:text-rose-200" onClick={createVideo}>
            Réessayer
          </button>{" "}
          ·{" "}
          <button type="button" className="underline hover:text-rose-200" onClick={() => setShowLocal(true)}>
            Export local
          </button>
        </p>
      )}

      {showLocal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rendu MP4 local"
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setShowLocal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowLocal(false);
          }}
        >
          <div
            ref={(el) => el?.focus()}
            tabIndex={-1}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0f1e] p-6 shadow-2xl outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Rendu MP4 en local</h3>
            <p className="mt-2 text-sm text-slate-400">
              Vous préférez rendre sur votre machine (gratuit, illimité, hors ligne) ? Playwright + FFmpeg, en 3
              étapes.
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
              onClick={() => setShowLocal(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
