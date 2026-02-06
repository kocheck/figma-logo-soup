import { describe, it, expect } from "vitest";
import { calculateDensity } from "../src/utils/density";

function makeImageData(
  width: number,
  height: number,
  fillFn: (x: number, y: number) => [number, number, number, number],
): { data: Uint8ClampedArray; width: number; height: number } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = fillFn(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return { data, width, height };
}

describe("calculateDensity", () => {
  it("returns 0 for fully transparent image", () => {
    const img = makeImageData(10, 10, () => [0, 0, 0, 0]);
    expect(calculateDensity(img)).toBe(0);
  });

  it("returns 1 for fully opaque image", () => {
    const img = makeImageData(10, 10, () => [255, 0, 0, 255]);
    expect(calculateDensity(img)).toBe(1);
  });

  it("returns ~0.5 for half-transparent image (by pixel count)", () => {
    const img = makeImageData(10, 10, (_x, y) =>
      y < 5 ? [255, 0, 0, 255] : [0, 0, 0, 0],
    );
    expect(calculateDensity(img)).toBeCloseTo(0.5);
  });

  it("weights by opacity (50% opacity = 50% density for fully filled)", () => {
    const img = makeImageData(10, 10, () => [255, 0, 0, 128]);
    // Each pixel contributes 128/255 ≈ 0.502
    expect(calculateDensity(img)).toBeCloseTo(128 / 255, 2);
  });

  it("returns 0 for zero-dimension image", () => {
    const img = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
    expect(calculateDensity(img)).toBe(0);
  });

  it("handles varied opacity correctly", () => {
    // 4 pixels: fully opaque, half, quarter, transparent
    const img = makeImageData(2, 2, (x, y) => {
      const alphas = [255, 128, 64, 0];
      return [255, 255, 255, alphas[y * 2 + x]];
    });
    const expected = (255 + 128 + 64 + 0) / 255 / 4;
    expect(calculateDensity(img)).toBeCloseTo(expected, 3);
  });

  it("handles 1x1 pixel image", () => {
    const img = makeImageData(1, 1, () => [100, 100, 100, 200]);
    expect(calculateDensity(img)).toBeCloseTo(200 / 255);
  });
});
