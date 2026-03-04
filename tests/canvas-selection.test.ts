import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma } from "./setup";
import type { GridConfig } from "../src/utils/types";

async function loadCode() {
  vi.resetModules();
  await import("../src/code");
}

const defaultConfig: GridConfig = {
  columns: 4,
  baseSize: 48,
  gap: 16,
  scaleFactor: 0.5,
  exportAsComponent: false,
};

describe("extractCanvasSelection", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFigma.ui.onmessage = null;
    mockFigma.currentPage.selection = [];
    mockFigma.currentPage.children = [];
  });

  it("sends selection-detected with empty array when nothing selected", async () => {
    mockFigma.currentPage.selection = [];
    await loadCode();
    expect(mockFigma.ui.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "selection-detected", logos: [], hasExistingGrid: false })
    );
  });

  it("extracts domain from frame named like a domain", async () => {
    mockFigma.currentPage.selection = [{
      type: "FRAME",
      name: "stripe.com",
      width: 200,
      height: 100,
      fills: [],
      children: [],
    }];
    await loadCode();
    const call = mockFigma.ui.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "selection-detected"
    );
    expect(call![0].logos).toHaveLength(1);
    expect(call![0].logos[0].domain).toBe("stripe.com");
    expect(call![0].logos[0].width).toBe(200);
    expect(call![0].logos[0].height).toBe(100);
  });

  it("extracts imageHash from first IMAGE fill on a frame", async () => {
    mockFigma.currentPage.selection = [{
      type: "FRAME",
      name: "acme.io",
      width: 64,
      height: 64,
      fills: [{ type: "IMAGE", imageHash: "abc123" }],
      children: [],
    }];
    await loadCode();
    const call = mockFigma.ui.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "selection-detected"
    );
    expect(call![0].logos[0].imageHash).toBe("abc123");
  });

  it("marks VectorNode as isSvg with nodeId", async () => {
    mockFigma.currentPage.selection = [{
      type: "VECTOR",
      name: "logo.svg",
      id: "node-99",
      width: 100,
      height: 50,
      fills: [],
    }];
    await loadCode();
    const call = mockFigma.ui.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "selection-detected"
    );
    expect(call![0].logos[0].isSvg).toBe(true);
    expect(call![0].logos[0].nodeId).toBe("node-99");
  });

  it("walks children of a Logo Soup frame to extract all logos", async () => {
    mockFigma.currentPage.selection = [{
      type: "FRAME",
      name: "Logo Soup",
      width: 400,
      height: 200,
      fills: [],
      children: [
        { type: "FRAME", name: "stripe.com", id: "n1", width: 120, height: 60, fills: [] },
        { type: "FRAME", name: "github.com", id: "n2", width: 90,  height: 60, fills: [] },
      ],
    }];
    await loadCode();
    const call = mockFigma.ui.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "selection-detected"
    );
    expect(call![0].logos).toHaveLength(2);
    expect(call![0].logos.map((l: { domain: string }) => l.domain)).toEqual(["stripe.com", "github.com"]);
  });

  it("falls back to 'unknown' for nodes whose name is not a domain", async () => {
    mockFigma.currentPage.selection = [{
      type: "FRAME",
      name: "Rectangle 1",
      width: 100,
      height: 100,
      fills: [],
      children: [],
    }];
    await loadCode();
    const call = mockFigma.ui.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "selection-detected"
    );
    expect(call![0].logos[0].domain).toBe("unknown");
  });

  it("sets hasExistingGrid true when Logo Soup frame exists on page", async () => {
    mockFigma.currentPage.children = [{ name: "Logo Soup", type: "FRAME" }];
    await loadCode();
    const call = mockFigma.ui.postMessage.mock.calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "selection-detected"
    );
    expect(call![0].hasExistingGrid).toBe(true);
  });
});

describe("canvas logo generation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFigma.ui.onmessage = null;
    mockFigma.currentPage.selection = [];
    mockFigma.currentPage.children = [];
    await loadCode();
  });

  it("uses imageHash directly without calling createImageAsync", async () => {
    const logo = {
      domain: "stripe.com",
      width: 200,
      height: 100,
      imageHash: "existing-hash-abc",
    };
    await mockFigma.ui.onmessage!({
      type: "generate-grid",
      config: defaultConfig,
      logos: [],
      canvasLogos: [logo],
    });

    expect(mockFigma.createImageAsync).not.toHaveBeenCalled();

    const rect = mockFigma.createRectangle.mock.results[0]?.value;
    expect(rect?.fills).toEqual([
      { type: "IMAGE", imageHash: "existing-hash-abc", scaleMode: "FIT" },
    ]);
  });

  it("clones SVG node by nodeId and resizes it", async () => {
    const clonedNode = { name: "", resize: vi.fn(), x: 0, y: 0, fills: [] };
    const svgNode = { clone: vi.fn(() => clonedNode), width: 100, height: 50, type: "VECTOR" };
    mockFigma.getNodeById = vi.fn(() => svgNode);

    const logo = { domain: "logo.svg", width: 100, height: 50, isSvg: true, nodeId: "node-99" };
    await mockFigma.ui.onmessage!({
      type: "generate-grid",
      config: defaultConfig,
      logos: [],
      canvasLogos: [logo],
    });

    expect(mockFigma.getNodeById).toHaveBeenCalledWith("node-99");
    expect(svgNode.clone).toHaveBeenCalled();
    expect(clonedNode.resize).toHaveBeenCalled();
  });

  it("appends canvas logos to an existing Logo Soup frame when appendToExisting is true", async () => {
    const existingFrame = {
      name: "Logo Soup",
      type: "FRAME",
      children: [] as unknown[],
      appendChild: vi.fn(function(this: { children: unknown[] }, c: unknown) { this.children.push(c); }),
      resize: vi.fn(),
    };
    mockFigma.currentPage.children = [existingFrame];

    const logo = { domain: "acme.com", width: 100, height: 100, imageHash: "hash-xyz" };
    await mockFigma.ui.onmessage!({
      type: "generate-grid",
      config: defaultConfig,
      logos: [],
      canvasLogos: [logo],
      appendToExisting: true,
    });

    // Should not create a new frame named "Logo Soup"
    const newLogoSoupFrames = mockFigma.createFrame.mock.results.filter(
      (r: { value: { name: string } }) => r.value.name === "Logo Soup"
    );
    expect(newLogoSoupFrames).toHaveLength(0);
    expect(existingFrame.appendChild).toHaveBeenCalled();
  });
});
