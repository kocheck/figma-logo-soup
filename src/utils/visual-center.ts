import type { VisualCenter, AlignBy } from "./types";

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

/**
 * Calculate the x/y nudge to apply to a logo node so its visual center
 * aligns with the geometric center of its container.
 *
 * The nudge is the negative of the visual center offset, scaled to the
 * rendered size of the logo.
 *
 * @param visualCenter - visual center analysis from the original image
 * @param naturalWidth - original image width (analysis resolution)
 * @param naturalHeight - original image height (analysis resolution)
 * @param renderedWidth - actual rendered width in Figma
 * @param renderedHeight - actual rendered height in Figma
 * @param alignBy - which axes to nudge
 */
export function calculateNudge(
  visualCenter: VisualCenter,
  naturalWidth: number,
  naturalHeight: number,
  renderedWidth: number,
  renderedHeight: number,
  alignBy: AlignBy,
): { nudgeX: number; nudgeY: number } {
  if (alignBy === "bounds") {
    return { nudgeX: 0, nudgeY: 0 };
  }

  const scaleX = naturalWidth > 0 ? renderedWidth / naturalWidth : 1;
  const scaleY = naturalHeight > 0 ? renderedHeight / naturalHeight : 1;

  // Nudge is the negative of the offset (we shift the image opposite to
  // where the visual center has drifted)
  const rawNudgeX = -visualCenter.offsetX * scaleX;
  const rawNudgeY = -visualCenter.offsetY * scaleY;

  const nudgeX =
    alignBy === "visual-center-x" || alignBy === "visual-center-xy"
      ? rawNudgeX
      : 0;
  const nudgeY =
    alignBy === "visual-center-y" || alignBy === "visual-center-xy"
      ? rawNudgeY
      : 0;

  return { nudgeX, nudgeY };
}
