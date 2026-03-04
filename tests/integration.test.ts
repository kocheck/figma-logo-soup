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

describe("Integration: Canvas-only generate flow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("full flow: generate creates frame, adds children, completes", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [
        makeCanvasLogo("stripe.com"),
        makeCanvasLogo("github.com"),
        makeCanvasLogo("figma.com"),
      ],
    });

    const frame = mockFigma.createFrame.mock.results[0].value;
    expect(frame.name).toBe("Logo Soup");
    expect(frame.layoutMode).toBe("HORIZONTAL");
    expect(frame.layoutWrap).toBe("WRAP");
    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
    );
  });

  it("frame is added to currentPage and selected", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("stripe.com")],
    });

    expect(mockFigma.currentPage.appendChild).toHaveBeenCalled();
    expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalled();
  });

  it("empty canvasLogos sends error, no frame created", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [],
    });

    expect(mockFigma.createFrame).not.toHaveBeenCalled();
    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });

  it("mixed canvas logos: imageHash, SVG clone, no-image placeholder", async () => {
    const fakeNode = { clone: vi.fn(() => ({ resize: vi.fn() })) };
    mockFigma.getNodeById.mockReturnValueOnce(fakeNode);

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [
        makeCanvasLogo("img.com", { imageHash: "hash_abc" }),
        makeCanvasLogo("vec.com", { imageHash: undefined, isSvg: true, nodeId: "svg-1" }),
        makeCanvasLogo("none.com", { imageHash: undefined, isSvg: false }),
      ],
    });

    expect(mockFigma.createRectangle).toHaveBeenCalled();
    expect(fakeNode.clone).toHaveBeenCalled();
    const placeholder = mockFigma.createFrame.mock.results.find(
      (r: { value: { name: string } }) => r.value.name?.includes("no image"),
    );
    expect(placeholder).toBeDefined();
    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "complete" }),
    );
  });
});

describe("Integration: Selection detection on plugin open", () => {
  it("detects selected logos and sends them to UI", async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();

    mockFigma.currentPage.selection = [
      { name: "stripe.com", width: 200, height: 100, type: "FRAME", fills: [], id: "node-1" },
      { name: "github.com", width: 100, height: 100, type: "FRAME", fills: [], id: "node-2" },
    ] as unknown as SceneNode[];

    await import("../src/code");

    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "selection-detected",
        logos: expect.arrayContaining([
          expect.objectContaining({ domain: "stripe.com", width: 200, height: 100 }),
          expect.objectContaining({ domain: "github.com", width: 100, height: 100 }),
        ]),
      }),
    );

    mockFigma.currentPage.selection = [];
  });

  it("hasExistingGrid is true when Logo Soup frame exists on page", async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();

    mockFigma.currentPage.children = [
      { name: "Logo Soup" } as SceneNode,
    ];

    await import("../src/code");

    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "selection-detected",
        hasExistingGrid: true,
      }),
    );

    mockFigma.currentPage.children = [];
  });
});

describe("Integration: Append to existing grid", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("appends logos to existing Logo Soup frame", async () => {
    const existingFrame = {
      name: "Logo Soup",
      children: [],
      appendChild: vi.fn(),
      layoutMode: "HORIZONTAL",
      layoutWrap: "WRAP",
    };
    mockFigma.currentPage.children = [existingFrame as unknown as SceneNode];

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("new-logo.com")],
      appendToExisting: true,
    });

    expect(existingFrame.appendChild).toHaveBeenCalled();
    mockFigma.currentPage.children = [];
  });

  it("creates new frame when appendToExisting is false", async () => {
    const existingFrame = { name: "Logo Soup", children: [], appendChild: vi.fn() };
    mockFigma.currentPage.children = [existingFrame as unknown as SceneNode];

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      canvasLogos: [makeCanvasLogo("new-logo.com")],
      appendToExisting: false,
    });

    expect(mockFigma.createFrame).toHaveBeenCalled();
    mockFigma.currentPage.children = [];
  });
});
