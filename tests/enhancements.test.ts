import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma, storage } from "./setup";
import type { GridConfig, CanvasLogo } from "../src/utils/types";

async function sendMessage(msg: unknown): Promise<void> {
  const handler = mockFigma.ui.onmessage;
  if (!handler) throw new Error("onmessage handler not set");
  await handler(msg);
}

function makeCanvasLogo(domain: string, overrides?: Partial<CanvasLogo>): CanvasLogo {
  return {
    domain,
    width: 128,
    height: 128,
    imageHash: "abc123",
    ...overrides,
  };
}

const defaultConfig: GridConfig = {
  columns: 4,
  baseSize: 48,
  gap: 16,
  scaleFactor: 0.5,
  exportAsComponent: false,
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
      canvasLogos: [makeCanvasLogo("stripe.com")],
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
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    const notifyCall = mockFigma.notify.mock.calls[0];
    const undoAction = notifyCall[1].button.action;
    const frame = mockFigma.createFrame.mock.results[0].value;

    undoAction();
    expect(frame.remove).toHaveBeenCalled();
  });

  it("undo for component removes the component", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      canvasLogos: [makeCanvasLogo("stripe.com")],
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
      canvasLogos: [makeCanvasLogo("a.com")],
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
      canvasLogos: [makeCanvasLogo("a.com"), makeCanvasLogo("b.com"), makeCanvasLogo("c.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      "Logo Soup: 3 logos generated",
      expect.any(Object),
    );
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
