import { describe, it, expect } from "vitest";
import { calculateVisualCenter } from "../src/utils/visual-center";

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

describe("calculateVisualCenter", () => {
  it("returns geometric center for empty image", () => {
    const img = makeImageData(10, 10, () => [0, 0, 0, 0]);
    const center = calculateVisualCenter(img);
    expect(center.x).toBe(5);
    expect(center.y).toBe(5);
    expect(center.offsetX).toBe(0);
    expect(center.offsetY).toBe(0);
  });

  it("returns zero for zero-dimension image", () => {
    const img = { data: new Uint8ClampedArray(0), width: 0, height: 0 };
    const center = calculateVisualCenter(img);
    expect(center.x).toBe(0);
    expect(center.y).toBe(0);
  });

  it("symmetric logo has visual center near geometric center", () => {
    // Uniform white pixels — symmetric
    const img = makeImageData(20, 20, () => [255, 255, 255, 255]);
    const center = calculateVisualCenter(img);
    // Visual center should be near geometric center (9.5, 9.5)
    expect(center.x).toBeCloseTo(9.5, 0);
    expect(center.y).toBeCloseTo(9.5, 0);
    expect(Math.abs(center.offsetX)).toBeLessThan(1);
    expect(Math.abs(center.offsetY)).toBeLessThan(1);
  });

  it("asymmetric logo has offset visual center", () => {
    // Content only in right half
    const img = makeImageData(20, 20, (x) =>
      x >= 10 ? [255, 255, 255, 255] : [0, 0, 0, 0],
    );
    const center = calculateVisualCenter(img);
    // Visual center should be shifted right
    expect(center.x).toBeGreaterThan(10);
    expect(center.offsetX).toBeGreaterThan(0);
  });

  it("content in top half shifts visual center up", () => {
    const img = makeImageData(20, 20, (_x, y) =>
      y < 10 ? [255, 255, 255, 255] : [0, 0, 0, 0],
    );
    const center = calculateVisualCenter(img);
    expect(center.y).toBeLessThan(10);
    expect(center.offsetY).toBeLessThan(0);
  });

  it("single pixel content has visual center at that pixel", () => {
    const img = makeImageData(10, 10, (x, y) =>
      x === 7 && y === 3 ? [255, 255, 255, 255] : [0, 0, 0, 0],
    );
    const center = calculateVisualCenter(img);
    expect(center.x).toBe(7);
    expect(center.y).toBe(3);
  });

  it("brighter pixels have more weight", () => {
    // Two pixels: one bright at (2,5), one dim at (8,5)
    const img = makeImageData(10, 10, (x, y) => {
      if (x === 2 && y === 5) return [255, 255, 255, 255];
      if (x === 8 && y === 5) return [10, 10, 10, 255];
      return [0, 0, 0, 0];
    });
    const center = calculateVisualCenter(img);
    // Center should be closer to the brighter pixel at x=2
    expect(center.x).toBeLessThan(5);
  });
});
