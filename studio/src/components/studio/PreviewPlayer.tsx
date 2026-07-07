"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/engine";
import { Timeline } from "./Timeline";
import { formatTime } from "./helpers";

interface PreviewPlayerProps {
  html: string;
  width: number;
  height: number;
  duration: number;
  scenes: Scene[];
}

const MAX_STAGE_HEIGHT = 540;

export function PreviewPlayer({ html, width, height, duration, scenes }: PreviewPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const postSeek = useCallback((t: number) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "cf:seek", t }, "*");
  }, []);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, duration));
      timeRef.current = clamped;
      setTime(clamped);
      postSeek(clamped);
    },
    [duration, postSeek],
  );

  // Écoute le cf:ready de l'iframe — on vérifie la source du message.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === "cf:ready") {
        setReady(true);
        // Après un rechargement (recompilation), on restaure la position.
        postSeek(Math.min(timeRef.current, duration));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [duration, postSeek]);

  // Boucle de lecture pilotée par le parent (le document iframe reste passif).
  useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const next = timeRef.current + dt;
      if (next >= duration) {
        seek(duration);
        setPlaying(false);
        return;
      }
      seek(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration, seek]);

  // Nouvelle compilation → l'iframe recharge, on attend son cf:ready.
  // (ajustement d'état pendant le rendu, pattern recommandé par React)
  const [lastHtml, setLastHtml] = useState(html);
  if (html !== lastHtml) {
    setLastHtml(html);
    setReady(false);
  }

  // Si la durée raccourcit (édition), on recale la position.
  useEffect(() => {
    if (timeRef.current > duration) seek(duration);
  }, [duration, seek]);

  // Mesure du conteneur pour la mise à l'échelle.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = containerWidth > 0 ? Math.min(containerWidth / width, MAX_STAGE_HEIGHT / height) : 0;
  const stageW = width * scale;
  const stageH = height * scale;

  const currentSceneIndex = scenes.findIndex((s) => time >= s.start && time < s.start + s.duration);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      if (timeRef.current >= duration - 0.05) seek(0);
      setPlaying(true);
    }
  };

  const goToScene = (offset: number) => {
    const index = currentSceneIndex === -1 ? scenes.length - 1 : currentSceneIndex;
    const target = scenes[Math.max(0, Math.min(scenes.length - 1, index + offset))];
    if (target) seek(target.start + 0.01);
  };

  return (
    <div
      className="flex flex-col gap-3 focus:outline-none"
      tabIndex={0}
      role="region"
      aria-label="Prévisualisation de la vidéo"
      onKeyDown={(e) => {
        if (e.key === " " && e.target === e.currentTarget) {
          e.preventDefault();
          togglePlay();
        }
      }}
    >
      <div ref={wrapperRef} className="flex w-full justify-center">
        <div
          className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-indigo-500/10"
          style={{ width: stageW || "100%", height: stageH || 220 }}
        >
          {scale > 0 && (
            <iframe
              ref={iframeRef}
              title="Prévisualisation CineForge"
              sandbox="allow-scripts"
              srcDoc={html}
              width={width}
              height={height}
              className="border-0"
              style={{
                width,
                height,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            />
          )}
          {!ready && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm text-slate-400">
              Chargement de la scène…
            </div>
          )}
        </div>
      </div>

      <Timeline scenes={scenes} duration={duration} time={time} onSeek={(t) => { setPlaying(false); seek(t); }} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToScene(-1)}
            aria-label="Scène précédente"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            ⏮ Scène
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Lecture"}
            className="rounded-lg bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {playing ? "⏸ Pause" : time >= duration - 0.05 ? "⟲ Rejouer" : "▶ Lecture"}
          </button>
          <button
            type="button"
            onClick={() => goToScene(1)}
            aria-label="Scène suivante"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            Scène ⏭
          </button>
        </div>
        <div className="text-sm tabular-nums text-slate-400" aria-live="off">
          {formatTime(time)} <span className="text-slate-600">/</span> {formatTime(duration)}
          {currentSceneIndex >= 0 && (
            <span className="ml-2 text-slate-500">· scène {currentSceneIndex + 1}/{scenes.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}
