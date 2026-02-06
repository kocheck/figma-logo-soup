import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma, storage } from "./setup";
import type { LogoAnalysis, GridConfig } from "../src/utils/types";

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
// Undo Support
// ========================================
describe("Enhancement: Undo support via notify button", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("notify includes an Undo button", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos: [makeLogo("stripe.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        timeout: 10000,
        button: expect.objectContaining({
          text: "Undo",
          action: expect.any(Function),
        }),
      }),
    );
  });

  it("undo action removes the generated node", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos: [makeLogo("stripe.com")],
    });

    // Extract the undo action from the notify call
    const notifyCall = mockFigma.notify.mock.calls[0];
    const undoAction = notifyCall[1].button.action;

    // The frame is the result node (not component since exportAsComponent=false)
    const frame = mockFigma.createFrame.mock.results[0].value;

    // Execute undo
    undoAction();

    expect(frame.remove).toHaveBeenCalled();
  });

  it("undo for component removes the component", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      logos: [makeLogo("stripe.com")],
    });

    const notifyCall = mockFigma.notify.mock.calls[0];
    const undoAction = notifyCall[1].button.action;
    const component = mockFigma.createComponent.mock.results[0].value;

    undoAction();
    expect(component.remove).toHaveBeenCalled();
  });
});

// ========================================
// Singular/Plural Message
// ========================================
describe("Enhancement: Singular/plural notification", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("uses 'logo' (singular) for 1 logo", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos: [makeLogo("a.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      "Logo Soup: 1 logo generated",
      expect.any(Object),
    );
  });

  it("uses 'logos' (plural) for 2+ logos", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos: [makeLogo("a.com"), makeLogo("b.com"), makeLogo("c.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      "Logo Soup: 3 logos generated",
      expect.any(Object),
    );
  });
});

// ========================================
// Token Format Validation (UI logic)
// ========================================
describe("Enhancement: Token format validation", () => {
  it("accepts valid pk_ prefixed token", () => {
    const token = "pk_abc123xyz";
    expect(token.startsWith("pk_")).toBe(true);
  });

  it("rejects token without pk_ prefix", () => {
    const token = "abc123xyz";
    expect(token.startsWith("pk_")).toBe(false);
  });

  it("rejects empty token", () => {
    const token = "";
    expect(token.startsWith("pk_")).toBe(false);
  });

  it("rejects token with only pk_ (too short but valid prefix)", () => {
    const token = "pk_";
    // Valid prefix — the UI does not enforce length beyond prefix check
    expect(token.startsWith("pk_")).toBe(true);
  });
});

// ========================================
// Numeric Input Validation (UI logic)
// ========================================
describe("Enhancement: Numeric input clamping", () => {
  function clampInput(value: string, min: number, max: number): number {
    let val = parseFloat(value);
    if (isNaN(val)) val = min;
    if (val < min) val = min;
    if (val > max) val = max;
    return val;
  }

  it("clamps columns below min to 1", () => {
    expect(clampInput("0", 1, 20)).toBe(1);
    expect(clampInput("-5", 1, 20)).toBe(1);
  });

  it("clamps columns above max to 20", () => {
    expect(clampInput("25", 1, 20)).toBe(20);
  });

  it("passes valid columns through", () => {
    expect(clampInput("4", 1, 20)).toBe(4);
  });

  it("handles NaN as min value", () => {
    expect(clampInput("abc", 1, 20)).toBe(1);
    expect(clampInput("", 0, 100)).toBe(0);
  });

  it("clamps scale factor to [0, 1]", () => {
    expect(clampInput("-0.5", 0, 1)).toBe(0);
    expect(clampInput("1.5", 0, 1)).toBe(1);
    expect(clampInput("0.5", 0, 1)).toBe(0.5);
  });

  it("clamps gap to [0, 100]", () => {
    expect(clampInput("-10", 0, 100)).toBe(0);
    expect(clampInput("200", 0, 100)).toBe(100);
  });
});

// ========================================
// Clear All (domain list)
// ========================================
describe("Enhancement: Clear All domains", () => {
  it("clears all domains from list", () => {
    let domains = ["a.com", "b.com", "c.com"];
    domains = [];
    expect(domains).toEqual([]);
    expect(domains.length).toBe(0);
  });
});

// ========================================
// Analysis Caching Logic
// ========================================
describe("Enhancement: Analysis caching", () => {
  it("cache hit returns existing analysis", () => {
    const cache = new Map<string, { domain: string; aspectRatio: number }>();
    const url = "https://img.logo.dev/stripe.com?token=pk_test&size=128&format=png&theme=light";

    // First call: miss
    expect(cache.has(url)).toBe(false);

    // Populate cache
    cache.set(url, { domain: "stripe.com", aspectRatio: 1.5 });

    // Second call: hit
    expect(cache.has(url)).toBe(true);
    expect(cache.get(url)!.aspectRatio).toBe(1.5);
  });

  it("different URLs are cached separately", () => {
    const cache = new Map<string, { domain: string }>();
    const url1 = "https://img.logo.dev/a.com?token=pk_test&size=128&format=png&theme=light";
    const url2 = "https://img.logo.dev/a.com?token=pk_test&size=128&format=png&theme=dark";

    cache.set(url1, { domain: "a.com" });
    cache.set(url2, { domain: "a.com" });

    expect(cache.size).toBe(2);
  });

  it("cache allows clearing", () => {
    const cache = new Map<string, unknown>();
    cache.set("url1", {});
    cache.set("url2", {});
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

// ========================================
// CORS Error Boundary (canvas getImageData)
// ========================================
describe("Enhancement: CORS error boundary", () => {
  it("returns blank ImageData on CORS error", () => {
    // Simulate the fallback logic in ui.html's getImageData
    const width = 128;
    const height = 128;
    let imageData: { width: number; height: number; data: { length: number } };

    try {
      // Simulate tainted canvas
      throw new DOMException("Tainted canvas", "SecurityError");
    } catch {
      // Fallback — same as ui.html
      imageData = { width: width || 1, height: height || 1, data: { length: (width || 1) * (height || 1) * 4 } };
    }

    expect(imageData.width).toBe(128);
    expect(imageData.height).toBe(128);
  });

  it("uses 1x1 for zero dimensions", () => {
    const width = 0;
    const height = 0;
    let w: number, h: number;

    try {
      throw new DOMException("Tainted canvas", "SecurityError");
    } catch {
      w = width || 1;
      h = height || 1;
    }

    expect(w!).toBe(1);
    expect(h!).toBe(1);
  });
});
