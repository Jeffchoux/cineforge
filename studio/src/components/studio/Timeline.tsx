"use client";

import { useCallback, useRef } from "react";
import type { Scene } from "@/lib/engine";
import { SCENE_TYPE_META } from "./helpers";

interface TimelineProps {
  scenes: Scene[];
  duration: number;
  time: number;
  onSeek: (t: number) => void;
}

/** Barre de timeline : segments colorés par scène, cliquable et draggable. */
export function Timeline({ scenes, duration, time, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * duration);
    },
    [duration, onSeek],
  );

  const progress = duration > 0 ? Math.max(0, Math.min(1, time / duration)) : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Position de lecture"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration * 10) / 10}
      aria-valuenow={Math.round(time * 10) / 10}
      tabIndex={0}
      className="group relative h-8 w-full cursor-pointer touch-none select-none rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
      onPointerDown={(e) => {
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        seekFromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFromPointer(e.clientX);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.min(duration, time + 1)); }
        if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(Math.max(0, time - 1)); }
      }}
    >
      <div className="absolute inset-x-0 top-1/2 flex h-3 -translate-y-1/2 gap-px overflow-hidden rounded-md">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            title={SCENE_TYPE_META[scene.type].label}
            className={`${SCENE_TYPE_META[scene.type].segment} opacity-50 transition-opacity group-hover:opacity-70`}
            style={{ width: `${duration > 0 ? (scene.duration / duration) * 100 : 0}%` }}
          />
        ))}
      </div>
      {/* Tête de lecture */}
      <div
        className="pointer-events-none absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
        style={{ left: `${progress * 100}%` }}
        aria-hidden
      />
    </div>
  );
}
