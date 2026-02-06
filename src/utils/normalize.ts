import type { NormalizeOptions } from "./types";

/**
 * PINF formula: normalizedWidth = baseSize × (aspectRatio ^ scaleFactor)
 *
 * - scaleFactor=0 → all logos same width (baseSize)
 * - scaleFactor=1 → all logos same height (baseSize)
 * - scaleFactor=0.5 → balanced between width and height normalization
 */
export function calculateNormalizedWidth(
  aspectRatio: number,
  options: NormalizeOptions,
): number {
  if (aspectRatio <= 0) return options.baseSize;
  return options.baseSize * Math.pow(aspectRatio, options.scaleFactor);
}

export function calculateNormalizedHeight(
  aspectRatio: number,
  options: NormalizeOptions,
): number {
  if (aspectRatio <= 0) return options.baseSize;
  const width = calculateNormalizedWidth(aspectRatio, options);
  return width / aspectRatio;
}

/**
 * Adjusts a logo's size based on its pixel density relative to the mean.
 * Dense/solid logos scale down, light/thin logos scale up.
 *
 * densityRatio = meanDensity / density
 * adjustment = densityRatio ^ (densityFactor * 0.5)
 */
export function applyDensityCompensation(
  size: number,
  density: number,
  meanDensity: number,
  densityFactor: number,
): number {
  if (densityFactor === 0 || meanDensity === 0 || density === 0) return size;
  const densityRatio = meanDensity / density;
  const adjustment = Math.pow(densityRatio, densityFactor * 0.5);
  return size * adjustment;
}

/**
 * Calculate the mean density across a set of logos.
 */
export function calculateMeanDensity(densities: number[]): number {
  if (densities.length === 0) return 0;
  const sum = densities.reduce((acc, d) => acc + d, 0);
  return sum / densities.length;
}
