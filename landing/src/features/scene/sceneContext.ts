"use client";

import { createContext, useContext } from "react";
import type { PagesManifest } from "./textures";

/**
 * What every part of the scene needs to know about loading and quality, without it
 * being threaded through FloatingEdition and Edition as props.
 */
export interface SceneQuality {
  /** "high" — everything; "mid" — a lighter scene for an ordinary laptop. */
  tier: "high" | "mid";
  /** Device-pixel-ratio range for the canvas. */
  dpr: [number, number];
  /** Page-texture size read at. */
  full: "l" | "m";
  /** 1 renders the kraft's fine detail and bump; 0 keeps only its colour. */
  detail: number;
}

/* 1.5, not 2: the procedural kraft and the room lighting run per pixel, and at 2x on a
   1440x900 panel that is five million pixels a frame — enough to drop frames on the
   integrated graphics most laptops have. 1.5 halves it; the 3x page textures stay sharp. */
export const HIGH_QUALITY: SceneQuality = { tier: "high", dpr: [1, 1.5], full: "l", detail: 1 };
export const MID_QUALITY: SceneQuality = { tier: "mid", dpr: [1, 1.25], full: "m", detail: 0 };

export interface SceneCtx {
  /** The first frame is on screen (the shut folder and its label). */
  ready: boolean;
  manifest: PagesManifest | null;
  quality: SceneQuality;
  /** Something the scene cannot recover from — give way to the plain document. */
  fail: (reason: string) => void;
}

export const SceneContext = createContext<SceneCtx>({
  ready: false,
  manifest: null,
  quality: HIGH_QUALITY,
  fail: () => {},
});

export const useScene = () => useContext(SceneContext);
