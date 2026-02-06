import { describe, it, expect } from "vitest";
import { detectContentBounds, getCroppedAspectRatio } from "../src/utils/crop";

function makeImageData(
  width: number,
  height: number,
  fillFn: (x: number, y: number) => number, // returns alpha
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = fillFn(x, y);
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }
  return { data, width, height };
}

describe("detectContentBounds", () => {
  it("returns full bounds for all-transparent image", () => {
    const img = makeImageData(20, 20, () => 0);
    const bounds = detectContentBounds(img);
    expect(bounds).toEqual({
      top: 0,
      right: 19,
      bottom: 19,
      left: 0,
      width: 20,
      height: 20,
    });
  });

  it("returns full bounds for fully opaque image (no padding)", () => {
    const img = makeImageData(10, 10, () => 255);
    const bounds = detectContentBounds(img);
    expect(bounds).toEqual({
      top: 0,
      right: 9,
      bottom: 9,
      left: 0,
      width: 10,
      height: 10,
    });
  });

  it("detects content with heavy padding", () => {
    // 20x20 image with content only in center 6x6 (7-12 on each axis)
    const img = makeImageData(20, 20, (x, y) =>
      x >= 7 && x <= 12 && y >= 7 && y <= 12 ? 255 : 0,
    );
    const bounds = detectContentBounds(img);
    expect(bounds.top).toBe(7);
    expect(bounds.left).toBe(7);
    expect(bounds.bottom).toBe(12);
    expect(bounds.right).toBe(12);
    expect(bounds.width).toBe(6);
    expect(bounds.height).toBe(6);
  });

  it("detects single pixel content", () => {
    const img = makeImageData(10, 10, (x, y) =>
      x === 5 && y === 3 ? 255 : 0,
    );
    const bounds = detectContentBounds(img);
    expect(bounds.top).toBe(3);
    expect(bounds.left).toBe(5);
    expect(bounds.bottom).toBe(3);
    expect(bounds.right).toBe(5);
    expect(bounds.width).toBe(1);
    expect(bounds.height).toBe(1);
  });

  it("respects alpha threshold", () => {
    // Pixel with alpha=5 should be below default threshold=10
    const img = makeImageData(10, 10, (x, y) =>
      x === 5 && y === 5 ? 5 : 0,
    );
    const bounds = detectContentBounds(img, 10);
    // All below threshold → returns full bounds (treated as transparent)
    expect(bounds.width).toBe(10);
    expect(bounds.height).toBe(10);
  });

  it("handles asymmetric padding", () => {
    // Content in top-left corner
    const img = makeImageData(20, 20, (x, y) =>
      x < 5 && y < 3 ? 255 : 0,
    );
    const bounds = detectContentBounds(img);
    expect(bounds.top).toBe(0);
    expect(bounds.left).toBe(0);
    expect(bounds.bottom).toBe(2);
    expect(bounds.right).toBe(4);
    expect(bounds.width).toBe(5);
    expect(bounds.height).toBe(3);
  });
});

describe("getCroppedAspectRatio", () => {
  it("returns 1 for square content", () => {
    expect(getCroppedAspectRatio({ top: 0, left: 0, bottom: 9, right: 9, width: 10, height: 10 })).toBe(1);
  });

  it("returns 2 for 2:1 content", () => {
    expect(getCroppedAspectRatio({ top: 0, left: 0, bottom: 4, right: 9, width: 10, height: 5 })).toBe(2);
  });

  it("returns 1 for zero height (defensive)", () => {
    expect(getCroppedAspectRatio({ top: 0, left: 0, bottom: 0, right: 9, width: 10, height: 0 })).toBe(1);
  });
});
