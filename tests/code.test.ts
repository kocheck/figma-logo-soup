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

describe("Plugin initialization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("calls showUI on load", () => {
    expect(mockFigma.showUI).toHaveBeenCalled();
  });

  it("sends selection-detected on load", () => {
    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "selection-detected" }),
    );
  });
});

describe("generate-grid with canvas logos", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("sends error when canvasLogos is empty", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [],
    });

    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "No logos to generate" }),
    );
  });

  it("creates a frame for canvas logos", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    expect(mockFigma.createFrame).toHaveBeenCalled();
  });

  it("sends complete message after success", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
    );
  });

  it("notify includes logo count", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com"), makeCanvasLogo("github.com")],
    });

    expect(mockFigma.notify).toHaveBeenCalledWith(
      "Logo Soup: 2 logos generated",
      expect.any(Object),
    );
  });

  it("creates a rectangle with imageHash fill for canvas logos", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com", { imageHash: "hash_abc" })],
    });

    const rect = mockFigma.createRectangle.mock.results[0]?.value;
    expect(rect).toBeDefined();
    expect(rect.fills).toEqual([
      { type: "IMAGE", imageHash: "hash_abc", scaleMode: "FIT" },
    ]);
  });

  it("clones SVG node when isSvg and nodeId are set", async () => {
    const fakeNode = {
      clone: vi.fn(() => ({
        resize: vi.fn(),
        id: "clone-1",
        name: "cloned",
      })),
    };
    mockFigma.getNodeById.mockReturnValueOnce(fakeNode);

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com", { imageHash: undefined, isSvg: true, nodeId: "orig-1" })],
    });

    expect(mockFigma.getNodeById).toHaveBeenCalledWith("orig-1");
    expect(fakeNode.clone).toHaveBeenCalled();
  });

  it("creates grey placeholder when no imageHash and not SVG", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("no-image.com", { imageHash: undefined, isSvg: false })],
    });

    const frame = mockFigma.createFrame.mock.results.find(
      (r: { value: { name: string } }) => r.value.name?.includes("no image"),
    );
    expect(frame).toBeDefined();
  });

  it("appends to existing frame when appendToExisting is true", async () => {
    const existingFrame = {
      name: "Logo Soup",
      children: [],
      appendChild: vi.fn(),
      layoutMode: "",
      layoutWrap: "",
    };
    mockFigma.currentPage.children = [existingFrame as unknown as SceneNode];

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com")],
      appendToExisting: true,
    });

    expect(existingFrame.appendChild).toHaveBeenCalled();
    mockFigma.currentPage.children = [];
  });
});

describe("Canvas selection detection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
  });

  it("sends logos from current selection on load", async () => {
    mockFigma.currentPage.selection = [
      { name: "stripe.com", width: 120, height: 60, type: "FRAME", fills: [], id: "node-1" },
    ] as unknown as SceneNode[];

    await import("../src/code");

    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "selection-detected",
        logos: expect.arrayContaining([
          expect.objectContaining({ domain: "stripe.com" }),
        ]),
      }),
    );
    mockFigma.currentPage.selection = [];
  });

  it("sends empty logos when nothing selected", async () => {
    mockFigma.currentPage.selection = [];
    await import("../src/code");

    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "selection-detected",
        logos: [],
      }),
    );
  });
});
