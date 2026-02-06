/**
 * Calculate the visual density of an image from its pixel data.
 * Density = ratio of filled (non-transparent) pixels to total pixels,
 * weighted by opacity.
 *
 * Returns a value between 0 (fully transparent) and 1 (fully opaque).
 */
export function calculateDensity(imageData: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): number {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  if (totalPixels === 0) return 0;

  let weightedFilled = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]; // Alpha channel
    if (alpha > 0) {
      // Weight by opacity: fully opaque = 1.0, half transparent = 0.5
      weightedFilled += alpha / 255;
    }
  }

  return weightedFilled / totalPixels;
}
