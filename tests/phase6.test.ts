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
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    expect(mockFigma.createFrame).toHaveBeenCalled();
    expect(mockFigma.createComponent).not.toHaveBeenCalled();
  });

  it("creates a component when exportAsComponent is true", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    expect(mockFigma.createComponent).toHaveBeenCalled();
    const component = mockFigma.createComponent.mock.results[0].value;
    expect(component.name).toBe("Logo Soup");
  });

  it("component has auto-layout wrap settings", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    const component = mockFigma.createComponent.mock.results[0].value;
    expect(component.layoutMode).toBe("HORIZONTAL");
    expect(component.layoutWrap).toBe("WRAP");
  });

  it("removes the intermediate frame after converting to component", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    const parentFrame = mockFigma.createFrame.mock.results[0].value;
    expect(parentFrame.remove).toHaveBeenCalled();
  });

  it("moves children from frame to component", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    const component = mockFigma.createComponent.mock.results[0].value;
    expect(component.appendChild).toHaveBeenCalled();
  });

  it("notify message includes (Component) suffix", async () => {
    await sendMessage({
      type: "generate-grid",
      config: { ...defaultConfig, exportAsComponent: true },
      canvasLogos: [makeCanvasLogo("a.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      "Logo Soup: 1 logo generated (Component)",
      expect.objectContaining({ timeout: 10000 }),
    );
  });
});

// ========================================
// Phase 6b: Drag-to-Reorder (serialization logic)
// ========================================
describe("Phase 6b: Domain List Reordering", () => {
  it("reorder moves item from one index to another", () => {
    function reorderList<T>(list: T[], fromIndex: number, toIndex: number): T[] {
      const result = [...list];
      const [moved] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, moved);
      return result;
    }

    const domains = ["a.com", "b.com", "c.com", "d.com"];

    expect(reorderList(domains, 0, 3)).toEqual(["b.com", "c.com", "d.com", "a.com"]);
    expect(reorderList(domains, 3, 0)).toEqual(["d.com", "a.com", "b.com", "c.com"]);
    expect(reorderList(domains, 1, 2)).toEqual(["a.com", "c.com", "b.com", "d.com"]);
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
    expect(addToList(domains, "a.com")).toEqual(["a.com", "b.com"]);
  });

  it("serializes domain list to textarea format", () => {
    const domains = ["stripe.com", "github.com", "figma.com"];
    const serialized = domains.join("\n");
    expect(serialized).toBe("stripe.com\ngithub.com\nfigma.com");
  });
});
