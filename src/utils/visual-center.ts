import type { VisualCenter } from "./types";

/**
 * Calculate the visual center of mass for an image.
 *
 * For each content pixel:
 *   weight = sqrt(colorDistance) * (alpha / 255)
 * where colorDistance = sqrt(r² + g² + b²) / sqrt(3 * 255²)
 *
 * The weighted average of all pixel positions gives the visual center.
 * The offset is the difference between visual and geometric center.
 */
export function calculateVisualCenter(imageData: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}): VisualCenter {
  const { data, width, height } = imageData;

  if (width === 0 || height === 0) {
    return { x: 0, y: 0, offsetX: 0, offsetY: 0 };
  }

  const geometricCenterX = width / 2;
  const geometricCenterY = height / 2;
  const maxColorDistance = Math.sqrt(3 * 255 * 255);

  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];

      if (alpha === 0) continue;

      const colorDistance =
        Math.sqrt(r * r + g * g + b * b) / maxColorDistance;
      const weight = Math.sqrt(colorDistance) * (alpha / 255);

      weightedX += x * weight;
      weightedY += y * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) {
    return {
      x: geometricCenterX,
      y: geometricCenterY,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const visualX = weightedX / totalWeight;
  const visualY = weightedY / totalWeight;

  return {
    x: visualX,
    y: visualY,
    offsetX: visualX - geometricCenterX,
    offsetY: visualY - geometricCenterY,
  };
}
