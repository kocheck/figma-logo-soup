import { describe, it, expect } from "vitest";
import {
  calculateGridLayout,
  calculateGridBounds,
} from "../src/utils/grid-layout";

describe("calculateGridLayout", () => {
  it("returns empty array for no items", () => {
    expect(calculateGridLayout([], { columns: 3, gap: 16 })).toEqual([]);
  });

  it("positions single item at origin", () => {
    const result = calculateGridLayout(
      [{ width: 50, height: 50 }],
      { columns: 3, gap: 16 },
    );
    expect(result).toEqual([{ x: 0, y: 0, width: 50, height: 50 }]);
  });

  it("lays out a perfect 2x2 grid", () => {
    const items = [
      { width: 50, height: 50 },
      { width: 50, height: 50 },
      { width: 50, height: 50 },
      { width: 50, height: 50 },
    ];
    const result = calculateGridLayout(items, { columns: 2, gap: 10 });

    // Row 1
    expect(result[0]).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    expect(result[1]).toEqual({ x: 60, y: 0, width: 50, height: 50 });
    // Row 2
    expect(result[2]).toEqual({ x: 0, y: 60, width: 50, height: 50 });
    expect(result[3]).toEqual({ x: 60, y: 60, width: 50, height: 50 });
  });

  it("handles remainder row (not full)", () => {
    const items = [
      { width: 40, height: 40 },
      { width: 40, height: 40 },
      { width: 40, height: 40 },
    ];
    const result = calculateGridLayout(items, { columns: 2, gap: 10 });
    expect(result).toHaveLength(3);
    // Third item starts a new row
    expect(result[2].x).toBe(0);
    expect(result[2].y).toBe(50); // 40 + 10 gap
  });

  it("centers items vertically within row when heights differ", () => {
    const items = [
      { width: 50, height: 30 },
      { width: 50, height: 50 }, // tallest
    ];
    const result = calculateGridLayout(items, { columns: 2, gap: 10 });
    // Row height = 50, first item height = 30, offset = (50-30)/2 = 10
    expect(result[0].y).toBe(10);
    expect(result[1].y).toBe(0);
  });

  it("handles zero gap", () => {
    const items = [
      { width: 40, height: 40 },
      { width: 40, height: 40 },
    ];
    const result = calculateGridLayout(items, { columns: 2, gap: 0 });
    expect(result[0].x).toBe(0);
    expect(result[1].x).toBe(40);
  });

  it("handles varying widths", () => {
    const items = [
      { width: 30, height: 40 },
      { width: 70, height: 40 },
      { width: 50, height: 40 },
    ];
    const result = calculateGridLayout(items, { columns: 2, gap: 10 });
    // Row 1: item0 at x=0, item1 at x=30+10=40
    expect(result[0].x).toBe(0);
    expect(result[1].x).toBe(40);
    // Row 2: item2 at x=0
    expect(result[2].x).toBe(0);
  });

  it("handles columns=0 gracefully", () => {
    const items = [{ width: 50, height: 50 }];
    const result = calculateGridLayout(items, { columns: 0, gap: 10 });
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
  });

  it("handles single column layout", () => {
    const items = [
      { width: 50, height: 30 },
      { width: 60, height: 40 },
      { width: 40, height: 50 },
    ];
    const result = calculateGridLayout(items, { columns: 1, gap: 10 });
    expect(result[0].y).toBe(0);
    expect(result[1].y).toBe(40); // 30 + 10
    expect(result[2].y).toBe(90); // 40 + 40 + 10
  });
});

describe("calculateGridBounds", () => {
  it("returns zero for empty grid", () => {
    expect(calculateGridBounds([])).toEqual({ width: 0, height: 0 });
  });

  it("returns correct bounds for single item", () => {
    expect(
      calculateGridBounds([{ x: 0, y: 0, width: 50, height: 50 }]),
    ).toEqual({ width: 50, height: 50 });
  });

  it("returns correct bounds for multi-item grid", () => {
    const items = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 60, y: 0, width: 50, height: 50 },
      { x: 0, y: 60, width: 50, height: 50 },
      { x: 60, y: 60, width: 50, height: 50 },
    ];
    expect(calculateGridBounds(items)).toEqual({ width: 110, height: 110 });
  });

  it("accounts for vertical centering offsets", () => {
    const items = [
      { x: 0, y: 10, width: 50, height: 30 }, // centered
      { x: 60, y: 0, width: 50, height: 50 },
    ];
    expect(calculateGridBounds(items)).toEqual({ width: 110, height: 50 });
  });
});
