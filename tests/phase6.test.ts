import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma, storage } from "./setup";
import type { LogoAnalysis, GridConfig, AlignBy } from "../src/utils/types";
import { calculateNudge } from "../src/utils/visual-center";

// Helper to trigger the onmessage handler
async function sendMessage(msg: unknown): Promise<void> {
  const handler = mockFigma.ui.onmessage;
  if (!handler) throw new Error("onmessage handler not set");
  await handler(msg);
}

function makeLogo(
  domain: string,
  overrides?: Partial<LogoAnalysis>,
): LogoAnalysis {
  return {
    domain,
    url: `https://img.logo.dev/${domain}?token=pk_test&size=128&format=png&theme=light`,
    naturalWidth: 128,
    naturalHeight: 128,
    aspectRatio: 1,
    density: 0.5,
    contentBounds: {
      top: 0,
      right: 127,
      bottom: 127,
      left: 0,
      width: 128,
      height: 128,
    },
    visualCenter: { x: 64, y: 64, offsetX: 0, offsetY: 0 },
    normalizedWidth: 48,
    normalizedHeight: 48,
    ...overrides,
  };
}

const defaultConfig: GridConfig = {
  columns: 4,
  baseSize: 48,
  gap: 16,
  theme: "light",
  greyscale: false,
  format: "png",
  scaleFactor: 0.5,
  densityAware: true,
  densityFactor: 0.5,
  exportAsComponent: false,
  alignBy: "bounds",
};

// ========================================
// Phase 6a: Export as Figma Component
// ========================================
describe("Phase 6a: Export as Figma Component", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("creates a regular frame when exportAsComponent is false", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: false },
      logos: [makeLogo("stripe.com")],
    });

    expect(mockFigma.createFrame).toHaveBeenCalled();
    expect(mockFigma.createComponent).not.toHaveBeenCalled();
  });

  it("creates a component when exportAsComponent is true", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      logos: [makeLogo("stripe.com")],
    });

    expect(mockFigma.createComponent).toHaveBeenCalled();
    const component = mockFigma.createComponent.mock.results[0].value;
    expect(component.name).toBe("Logo Soup");
  });

  it("component has auto-layout wrap settings", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      logos: [makeLogo("stripe.com")],
    });

    const component = mockFigma.createComponent.mock.results[0].value;
    expect(component.layoutMode).toBe("HORIZONTAL");
    expect(component.layoutWrap).toBe("WRAP");
  });

  it("removes the intermediate frame after converting to component", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      logos: [makeLogo("stripe.com")],
    });

    // The parent frame (results[0]) should have been removed
    const parentFrame = mockFigma.createFrame.mock.results[0].value;
    expect(parentFrame.remove).toHaveBeenCalled();
  });

  it("moves children from frame to component", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      logos: [makeLogo("stripe.com")],
    });

    const component = mockFigma.createComponent.mock.results[0].value;
    expect(component.appendChild).toHaveBeenCalled();
  });

  it("notify message includes (Component) suffix", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      logos: [makeLogo("a.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      "Logo Soup: 1 logo generated (Component)",
      expect.objectContaining({ timeout: 10000 }),
    );
  });
});

// ========================================
// Phase 6c: Visual Center Nudging
// ========================================
describe("Phase 6c: calculateNudge", () => {
  const centeredVC = { x: 64, y: 64, offsetX: 0, offsetY: 0 };
  const offsetVC = { x: 80, y: 40, offsetX: 16, offsetY: -24 };

  it("returns zero nudge for alignBy=bounds", () => {
    const result = calculateNudge(offsetVC, 128, 128, 48, 48, "bounds");
    expect(result.nudgeX).toBe(0);
    expect(result.nudgeY).toBe(0);
  });

  it("returns zero nudge for centered visual center", () => {
    const result = calculateNudge(centeredVC, 128, 128, 48, 48, "visual-center-xy");
    expect(result.nudgeX).toBeCloseTo(0);
    expect(result.nudgeY).toBeCloseTo(0);
  });

  it("nudges X only for visual-center-x", () => {
    const result = calculateNudge(offsetVC, 128, 128, 48, 48, "visual-center-x");
    expect(result.nudgeX).not.toBe(0);
    expect(result.nudgeY).toBe(0);
  });

  it("nudges Y only for visual-center-y", () => {
    const result = calculateNudge(offsetVC, 128, 128, 48, 48, "visual-center-y");
    expect(result.nudgeX).toBe(0);
    expect(result.nudgeY).not.toBe(0);
  });

  it("nudges both axes for visual-center-xy", () => {
    const result = calculateNudge(offsetVC, 128, 128, 48, 48, "visual-center-xy");
    expect(result.nudgeX).not.toBe(0);
    expect(result.nudgeY).not.toBe(0);
  });

  it("nudge direction opposes the visual center offset", () => {
    // offsetX=16 (visual center is right of geometric center)
    // nudge should be negative (shift image left to compensate)
    const result = calculateNudge(offsetVC, 128, 128, 48, 48, "visual-center-xy");
    expect(result.nudgeX).toBeLessThan(0);
    // offsetY=-24 (visual center is above geometric center)
    // nudge should be positive (shift image down to compensate)
    expect(result.nudgeY).toBeGreaterThan(0);
  });

  it("scales nudge proportionally to rendered size", () => {
    // At 1:1 scale (rendered = natural), nudge = -offset
    const result1x = calculateNudge(offsetVC, 128, 128, 128, 128, "visual-center-xy");
    expect(result1x.nudgeX).toBeCloseTo(-16);
    expect(result1x.nudgeY).toBeCloseTo(24);

    // At 0.5x scale, nudge should be half
    const resultHalf = calculateNudge(offsetVC, 128, 128, 64, 64, "visual-center-xy");
    expect(resultHalf.nudgeX).toBeCloseTo(-8);
    expect(resultHalf.nudgeY).toBeCloseTo(12);
  });

  it("handles zero natural dimensions gracefully", () => {
    const result = calculateNudge(offsetVC, 0, 0, 48, 48, "visual-center-xy");
    // Falls back to scale=1
    expect(result.nudgeX).toBeCloseTo(-16);
    expect(result.nudgeY).toBeCloseTo(24);
  });
});

describe("Phase 6c: Visual Center Nudging in Plugin", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("does not nudge when alignBy=bounds", async () => {
    const logo = makeLogo("test.com", {
      visualCenter: { x: 80, y: 40, offsetX: 16, offsetY: -24 },
    });

    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, alignBy: "bounds" },
      logos: [logo],
    });

    // The image rectangle should stay at default position
    const rectCalls = mockFigma.createRectangle.mock.results;
    expect(rectCalls.length).toBeGreaterThan(0);
    const rect = rectCalls[0].value;
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
  });

  it("applies nudge when alignBy=visual-center-y", async () => {
    const logo = makeLogo("test.com", {
      visualCenter: { x: 64, y: 40, offsetX: 0, offsetY: -24 },
    });

    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, alignBy: "visual-center-y" },
      logos: [logo],
    });

    const rect = mockFigma.createRectangle.mock.results[0].value;
    // nudgeY should be positive (compensating for visual center being above geometric)
    expect(rect.x).toBe(0); // X not nudged
    expect(rect.y).not.toBe(0); // Y should be nudged
  });
});

// ========================================
// Phase 6b: Drag-to-Reorder (serialization logic)
// ========================================
describe("Phase 6b: Domain List Reordering", () => {
  it("reorder moves item from one index to another", () => {
    // Simulate the reorder logic used in the UI
    function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
      const result = [...list];
      const [moved] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, moved);
      return result;
    }

    const domains = ["a.com", "b.com", "c.com", "d.com"];

    // Move first to last
    expect(reorderList(domains, 0, 3)).toEqual(["b.com", "c.com", "d.com", "a.com"]);

    // Move last to first
    expect(reorderList(domains, 3, 0)).toEqual(["d.com", "a.com", "b.com", "c.com"]);

    // Move middle item down
    expect(reorderList(domains, 1, 2)).toEqual(["a.com", "c.com", "b.com", "d.com"]);

    // Same position (no-op)
    expect(reorderList(domains, 2, 2)).toEqual(["a.com", "b.com", "c.com", "d.com"]);
  });

  it("remove item from list", () => {
    function removeFromList<T>(list: T[], index: number): T[] {
      return list.filter((_, i) => i !== index);
    }

    const domains = ["a.com", "b.com", "c.com"];
    expect(removeFromList(domains, 0)).toEqual(["b.com", "c.com"]);
    expect(removeFromList(domains, 1)).toEqual(["a.com", "c.com"]);
    expect(removeFromList(domains, 2)).toEqual(["a.com", "b.com"]);
  });

  it("add domain to list (deduplication)", () => {
    function addToList(list: string[], domain: string): string[] {
      if (list.includes(domain)) return list;
      return [...list, domain];
    }

    const domains = ["a.com", "b.com"];
    expect(addToList(domains, "c.com")).toEqual(["a.com", "b.com", "c.com"]);
    expect(addToList(domains, "a.com")).toEqual(["a.com", "b.com"]); // no duplicate
  });

  it("serializes domain list to textarea format", () => {
    const domains = ["stripe.com", "github.com", "figma.com"];
    const serialized = domains.join("\n");
    expect(serialized).toBe("stripe.com\ngithub.com\nfigma.com");
  });
});
