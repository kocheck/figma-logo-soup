import { describe, it, expect } from "vitest";
import {
  calculateNormalizedWidth,
  calculateNormalizedHeight,
  applyDensityCompensation,
  calculateMeanDensity,
} from "../src/utils/normalize";
import type { NormalizeOptions } from "../src/utils/types";

const defaults: NormalizeOptions = {
  baseSize: 48,
  scaleFactor: 0.5,
  densityAware: true,
  densityFactor: 0.5,
};

describe("calculateNormalizedWidth", () => {
  it("returns baseSize for square logos (aspect ratio 1:1)", () => {
    expect(calculateNormalizedWidth(1, defaults)).toBe(48);
  });

  it("with scaleFactor=0, all logos get same width regardless of aspect ratio", () => {
    const opts = { ...defaults, scaleFactor: 0 };
    expect(calculateNormalizedWidth(2, opts)).toBe(48);
    expect(calculateNormalizedWidth(0.5, opts)).toBe(48);
    expect(calculateNormalizedWidth(10, opts)).toBe(48);
  });

  it("with scaleFactor=1, width scales linearly with aspect ratio", () => {
    const opts = { ...defaults, scaleFactor: 1 };
    expect(calculateNormalizedWidth(2, opts)).toBe(96); // 48 * 2
    expect(calculateNormalizedWidth(0.5, opts)).toBe(24); // 48 * 0.5
  });

  it("wide logos get wider at scaleFactor=0.5", () => {
    const wide = calculateNormalizedWidth(4, defaults);
    const square = calculateNormalizedWidth(1, defaults);
    expect(wide).toBeGreaterThan(square);
  });

  it("tall logos get narrower at scaleFactor=0.5", () => {
    const tall = calculateNormalizedWidth(0.25, defaults);
    const square = calculateNormalizedWidth(1, defaults);
    expect(tall).toBeLessThan(square);
  });

  it("handles extreme aspect ratios", () => {
    const veryWide = calculateNormalizedWidth(100, defaults);
    expect(veryWide).toBeGreaterThan(0);
    expect(Number.isFinite(veryWide)).toBe(true);

    const veryTall = calculateNormalizedWidth(0.01, defaults);
    expect(veryTall).toBeGreaterThan(0);
    expect(Number.isFinite(veryTall)).toBe(true);
  });

  it("handles zero/negative aspect ratio gracefully", () => {
    expect(calculateNormalizedWidth(0, defaults)).toBe(48);
    expect(calculateNormalizedWidth(-1, defaults)).toBe(48);
  });

  it("respects custom baseSize", () => {
    const opts = { ...defaults, baseSize: 100 };
    expect(calculateNormalizedWidth(1, opts)).toBe(100);
  });
});

describe("calculateNormalizedHeight", () => {
  it("returns baseSize for square logos", () => {
    expect(calculateNormalizedHeight(1, defaults)).toBe(48);
  });

  it("with scaleFactor=1, all logos get same height (baseSize)", () => {
    const opts = { ...defaults, scaleFactor: 1 };
    // width = 48 * ar, height = width / ar = 48
    expect(calculateNormalizedHeight(2, opts)).toBe(48);
    expect(calculateNormalizedHeight(0.5, opts)).toBe(48);
  });

  it("wide logos are shorter than square ones at scaleFactor=0.5", () => {
    const wideHeight = calculateNormalizedHeight(4, defaults);
    const squareHeight = calculateNormalizedHeight(1, defaults);
    expect(wideHeight).toBeLessThan(squareHeight);
  });

  it("handles zero aspect ratio gracefully", () => {
    expect(calculateNormalizedHeight(0, defaults)).toBe(48);
  });
});

describe("applyDensityCompensation", () => {
  it("returns original size when densityFactor is 0", () => {
    expect(applyDensityCompensation(100, 0.8, 0.5, 0)).toBe(100);
  });

  it("returns original size when meanDensity is 0", () => {
    expect(applyDensityCompensation(100, 0.8, 0, 0.5)).toBe(100);
  });

  it("returns original size when density is 0", () => {
    expect(applyDensityCompensation(100, 0, 0.5, 0.5)).toBe(100);
  });

  it("scales down dense logos (density > mean)", () => {
    const adjusted = applyDensityCompensation(100, 0.8, 0.4, 0.5);
    expect(adjusted).toBeLessThan(100);
  });

  it("scales up light logos (density < mean)", () => {
    const adjusted = applyDensityCompensation(100, 0.2, 0.4, 0.5);
    expect(adjusted).toBeGreaterThan(100);
  });

  it("no adjustment when density equals mean", () => {
    const adjusted = applyDensityCompensation(100, 0.5, 0.5, 0.5);
    expect(adjusted).toBeCloseTo(100);
  });

  it("higher densityFactor produces stronger adjustment", () => {
    const mild = applyDensityCompensation(100, 0.8, 0.4, 0.2);
    const strong = applyDensityCompensation(100, 0.8, 0.4, 1.0);
    // Both scale down, but strong adjustment should be more extreme
    expect(Math.abs(100 - strong)).toBeGreaterThan(Math.abs(100 - mild));
  });
});

describe("calculateMeanDensity", () => {
  it("returns 0 for empty array", () => {
    expect(calculateMeanDensity([])).toBe(0);
  });

  it("returns the single value for one-element array", () => {
    expect(calculateMeanDensity([0.5])).toBe(0.5);
  });

  it("calculates average correctly", () => {
    expect(calculateMeanDensity([0.2, 0.4, 0.6])).toBeCloseTo(0.4);
  });
});
