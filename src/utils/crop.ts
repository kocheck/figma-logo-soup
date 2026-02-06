import type { ContentBounds } from "./types";

/**
 * Detect the actual content boundaries of an image by scanning for
 * non-transparent pixels. Returns the bounding box of visible content.
 *
 * Alpha threshold: pixels with alpha > threshold are considered content.
 */
export function detectContentBounds(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  alphaThreshold: number = 10,
): ContentBounds {
  const { data, width, height } = imageData;

  let top = height;
  let bottom = 0;
  let left = width;
  let right = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      if (alpha > alphaThreshold) {
        hasContent = true;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (!hasContent) {
    // Fully transparent image — return full bounds
    return { top: 0, right: width - 1, bottom: height - 1, left: 0, width, height };
  }

  return {
    top,
    right,
    bottom,
    left,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

/**
 * Calculate the cropped aspect ratio from content bounds.
 */
export function getCroppedAspectRatio(bounds: ContentBounds): number {
  if (bounds.height === 0) return 1;
  return bounds.width / bounds.height;
}
