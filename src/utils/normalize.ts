import type { NormalizeOptions } from "./types";

export function calculateNormalizedWidth(
  aspectRatio: number,
  opts: NormalizeOptions,
): number {
  if (aspectRatio <= 0) return opts.baseSize;
  return opts.baseSize * Math.pow(aspectRatio, opts.scaleFactor);
}

export function calculateNormalizedHeight(
  aspectRatio: number,
  opts: NormalizeOptions,
): number {
  if (aspectRatio <= 0) return opts.baseSize;
  const w = calculateNormalizedWidth(aspectRatio, opts);
  return w / aspectRatio;
}
