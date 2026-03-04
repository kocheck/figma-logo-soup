// Figma API mock setup for Vitest
// Provides mock globals for figma.*, used by plugin sandbox tests

import { vi } from "vitest";

const storage = new Map<string, unknown>();

const mockFigma = {
  showUI: vi.fn(),
  closePlugin: vi.fn(),
  notify: vi.fn(),
  currentPage: {
    appendChild: vi.fn(),
    selection: [] as unknown[],
    children: [] as unknown[],
  },
  viewport: {
    scrollAndZoomIntoView: vi.fn(),
    center: { x: 0, y: 0 },
  },
  createFrame: vi.fn(() => ({
    name: "",
    resize: vi.fn(),
    layoutMode: "NONE",
    layoutWrap: "NO_WRAP",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    itemSpacing: 0,
    counterAxisSpacing: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    fills: [],
    clipsContent: false,
    x: 0,
    y: 0,
    children: [] as unknown[],
    appendChild: vi.fn(function (this: { children: unknown[] }, child: unknown) {
      this.children.push(child);
    }),
    remove: vi.fn(),
  })),
  createComponent: vi.fn(() => ({
    name: "",
    resize: vi.fn(),
    layoutMode: "NONE",
    layoutWrap: "NO_WRAP",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    itemSpacing: 0,
    counterAxisSpacing: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    fills: [],
    x: 0,
    y: 0,
    children: [] as unknown[],
    appendChild: vi.fn(function (this: { children: unknown[] }, child: unknown) {
      this.children.push(child);
    }),
    remove: vi.fn(),
  })),
  createRectangle: vi.fn(() => ({
    name: "",
    resize: vi.fn(),
    fills: [],
    x: 0,
    y: 0,
  })),
  createText: vi.fn(() => ({
    name: "",
    characters: "",
    fontSize: 12,
    resize: vi.fn(),
    x: 0,
    y: 0,
    fills: [],
  })),
  createImageAsync: vi.fn(async () => ({
    hash: "mock-image-hash-" + Math.random().toString(36).slice(2),
  })),
  loadFontAsync: vi.fn(async () => undefined),
  getNodeById: vi.fn((_id: string) => null as unknown),
  clientStorage: {
    getAsync: vi.fn(async (key: string) => storage.get(key) ?? undefined),
    setAsync: vi.fn(async (key: string, value: unknown) => {
      storage.set(key, value);
    }),
  },
  ui: {
    postMessage: vi.fn(),
    onmessage: null as ((msg: unknown) => void) | null,
    on: vi.fn(),
  },
};

// @ts-expect-error -- mock global
globalThis.figma = mockFigma;
// @ts-expect-error -- mock global
globalThis.__html__ = "<div>mock ui</div>";

export { mockFigma, storage };
