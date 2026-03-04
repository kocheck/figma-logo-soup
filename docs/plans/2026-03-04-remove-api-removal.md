# Remove Logo.dev API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete all Logo.dev API fetching, token management, and analysis infrastructure — leaving a canvas-only plugin that works entirely with logos already placed on the Figma canvas.

**Architecture:** Canvas logos are extracted from the user's Figma selection (already implemented), normalized via PINF, and placed in a grid. No network calls, no API tokens, no image analysis pipeline.

**Tech Stack:** TypeScript, esbuild, Vitest, Figma Plugin API

---

### Task 1: Delete dead utility files and their tests

**Files:**
- Delete: `src/utils/url-builder.ts`
- Delete: `src/utils/density.ts`
- Delete: `src/utils/crop.ts`
- Delete: `src/utils/visual-center.ts`
- Delete: `tests/url-builder.test.ts`
- Delete: `tests/density.test.ts`
- Delete: `tests/crop.test.ts`
- Delete: `tests/visual-center.test.ts`

**Step 1: Delete the utility source files**

```bash
rm src/utils/url-builder.ts src/utils/density.ts src/utils/crop.ts src/utils/visual-center.ts
```

**Step 2: Delete their test files**

```bash
rm tests/url-builder.test.ts tests/density.test.ts tests/crop.test.ts tests/visual-center.test.ts
```

**Step 3: Run tests to confirm remaining tests still pass**

Run: `npm test`
Expected: Some tests will now fail in code.ts, phase6.test.ts, etc. because they import from deleted files. That's expected — we'll fix those in upcoming tasks. If you see "Cannot find module" errors for the deleted files, that's the only expected failure at this point. The remaining pure-logic tests (normalize, grid-layout, phase6 reorder section, enhancements clamping) should pass.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete url-builder, density, crop, visual-center utils and tests"
```

---

### Task 2: Simplify normalize.ts and NormalizeOptions

**Files:**
- Modify: `src/utils/normalize.ts`
- Modify: `src/utils/types.ts` (NormalizeOptions only in this task)
- Modify: `tests/normalize.test.ts`

**Context:** `normalize.ts` exports 4 functions. Two stay (`calculateNormalizedWidth`, `calculateNormalizedHeight`). Two are deleted (`applyDensityCompensation`, `calculateMeanDensity`). `NormalizeOptions` in `types.ts` currently has `densityAware: boolean` and `densityFactor: number` — both must be removed since density is gone.

**Step 1: Update NormalizeOptions in types.ts**

Find the `NormalizeOptions` interface (lines 3–8) and replace it:

```typescript
export interface NormalizeOptions {
  baseSize: number;
  scaleFactor: number;
}
```

**Step 2: Simplify normalize.ts**

The file currently exports `calculateNormalizedWidth`, `calculateNormalizedHeight`, `applyDensityCompensation`, `calculateMeanDensity`. Delete the density functions entirely. The two keep functions take `NormalizeOptions` — remove the `densityAware`/`densityFactor` handling from them.

Replace `src/utils/normalize.ts` with:

```typescript
import type { NormalizeOptions } from "./types";

export function calculateNormalizedWidth(
  aspectRatio: number,
  opts: NormalizeOptions,
): number {
  if (aspectRatio <= 0) return opts.baseSize;
  return opts.baseSize * Math.pow(aspectRatio, opts.scaleFactor);
}

export function calculateNormalizedHeight(
  aspectRatio: number,
  opts: NormalizeOptions,
): number {
  if (aspectRatio <= 0) return opts.baseSize;
  const w = calculateNormalizedWidth(aspectRatio, opts);
  return w / aspectRatio;
}
```

**Step 3: Update normalize.test.ts**

Remove the `applyDensityCompensation` and `calculateMeanDensity` imports and their describe blocks. Update `defaults` to remove density fields.

Replace `tests/normalize.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import {
  calculateNormalizedWidth,
  calculateNormalizedHeight,
} from "../src/utils/normalize";
import type { NormalizeOptions } from "../src/utils/types";

const defaults: NormalizeOptions = {
  baseSize: 48,
  scaleFactor: 0.5,
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
```

**Step 4: Run tests**

Run: `npm test -- tests/normalize.test.ts`
Expected: All normalize tests pass.

**Step 5: Commit**

```bash
git add src/utils/normalize.ts src/utils/types.ts tests/normalize.test.ts
git commit -m "chore: remove density functions from normalize.ts, simplify NormalizeOptions"
```

---

### Task 3: Simplify types.ts fully

**Files:**
- Modify: `src/utils/types.ts`

**Context:** Remove `LogoAnalysis`, `ContentBounds`, `VisualCenter`, `AlignBy`. Simplify `GridConfig`. Update `UIMessage` and `PluginMessage`.

**Step 1: Replace types.ts entirely**

```typescript
// Shared types

export interface NormalizeOptions {
  baseSize: number;
  scaleFactor: number;
}

export interface GridConfig {
  columns: number;
  baseSize: number;
  gap: number;
  scaleFactor: number;
  exportAsComponent: boolean;
}

export interface CanvasLogo {
  domain: string;      // extracted from node name, or "unknown"
  width: number;       // node.width (natural dimensions)
  height: number;      // node.height
  imageHash?: string;  // from image fill, if present
  isSvg?: boolean;     // true for VectorNode
  nodeId?: string;     // figma node ID, used for SVG cloning
}

export interface GridItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Message protocol: UI → Plugin
export type UIMessage =
  | { type: "generate-grid"; config: GridConfig; canvasLogos: CanvasLogo[]; appendToExisting?: boolean }

// Message protocol: Plugin → UI
export type PluginMessage =
  | { type: "progress"; current: number; total: number; domain: string }
  | { type: "complete" }
  | { type: "error"; message: string }
  | { type: "selection-detected"; logos: CanvasLogo[]; hasExistingGrid: boolean };
```

**Step 2: Run typecheck to see what breaks**

Run: `npm run typecheck`
Expected: Errors in `src/code.ts` (uses removed types), in test files. That's fine — we'll fix in subsequent tasks.

**Step 3: Commit**

```bash
git add src/utils/types.ts
git commit -m "chore: simplify types.ts — remove LogoAnalysis, ContentBounds, VisualCenter, AlignBy, token messages"
```

---

### Task 4: Simplify code.ts

**Files:**
- Modify: `src/code.ts`

**Context:** Remove token handlers, `createLogoNode`, `createPlaceholderNode`, visual center nudging, density opts from normalize calls. `canvasLogos` in `handleGenerateGrid` becomes required. The notify count should reflect `canvasLogos.length`. Remove `calculateGridLayout` (only used for the old Logo.dev items loop). Remove `figma.loadFontAsync` (only needed for text labels in placeholder nodes).

**Step 1: Replace src/code.ts with the simplified version**

```typescript
import type { UIMessage, PluginMessage, GridConfig, CanvasLogo } from "./utils/types";
import { calculateNormalizedWidth, calculateNormalizedHeight } from "./utils/normalize";

const DOMAIN_REGEX = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

function extractNodeAsCanvasLogo(node: SceneNode): CanvasLogo {
  const isDomain = DOMAIN_REGEX.test(node.name);
  const domain = isDomain ? node.name : "unknown";

  let imageHash: string | undefined;
  if ("fills" in node && Array.isArray(node.fills)) {
    const imageFill = (node.fills as Paint[]).find((f) => f.type === "IMAGE") as ImagePaint | undefined;
    if (imageFill?.imageHash) imageHash = imageFill.imageHash;
  }

  if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") {
    return { domain, width: node.width, height: node.height, isSvg: true, nodeId: node.id };
  }

  return { domain, width: node.width, height: node.height, imageHash };
}

function extractCanvasSelection(): void {
  const selection = figma.currentPage.selection;
  const logos: CanvasLogo[] = [];

  for (const node of selection) {
    if (node.name === "Logo Soup" && "children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        logos.push(extractNodeAsCanvasLogo(child as SceneNode));
      }
    } else {
      logos.push(extractNodeAsCanvasLogo(node));
    }
  }

  const hasExistingGrid = figma.currentPage.children.some(
    (n) => n.name === "Logo Soup"
  );

  sendToUI({ type: "selection-detected", logos, hasExistingGrid });
}

figma.showUI(__html__, { themeColors: true, width: 360, height: 540 });
extractCanvasSelection();

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case "generate-grid":
      await handleGenerateGrid(msg.config, msg.canvasLogos, msg.appendToExisting);
      break;
  }
};

async function handleGenerateGrid(
  config: GridConfig,
  canvasLogos: CanvasLogo[],
  appendToExisting?: boolean,
): Promise<void> {
  if (canvasLogos.length === 0) {
    sendToUI({ type: "error", message: "No logos to generate" });
    return;
  }

  try {
    const opts = { baseSize: config.baseSize, scaleFactor: config.scaleFactor };
    const allNormalizedWidths = [
      ...canvasLogos.map((cl) =>
        calculateNormalizedWidth(cl.width > 0 && cl.height > 0 ? cl.width / cl.height : 1, opts)
      ),
      config.baseSize,
    ];
    const maxItemWidth = Math.max(...allNormalizedWidths);
    const frameWidth = maxItemWidth * config.columns + config.gap * (config.columns + 1);

    let frame: FrameNode;
    const existingFrame = appendToExisting
      ? (figma.currentPage.children.find((n) => n.name === "Logo Soup") as FrameNode | undefined)
      : undefined;

    if (existingFrame) {
      frame = existingFrame;
    } else {
      frame = figma.createFrame();
      frame.name = "Logo Soup";
      frame.layoutMode = "HORIZONTAL";
      frame.layoutWrap = "WRAP";
      frame.primaryAxisSizingMode = "FIXED";
      frame.counterAxisSizingMode = "AUTO";
      frame.itemSpacing = config.gap;
      frame.counterAxisSpacing = config.gap;
      frame.paddingLeft = config.gap;
      frame.paddingRight = config.gap;
      frame.paddingTop = config.gap;
      frame.paddingBottom = config.gap;
      frame.fills = [];
      frame.resize(frameWidth, 100);
    }

    for (const cl of canvasLogos) {
      const aspectRatio = cl.width > 0 && cl.height > 0 ? cl.width / cl.height : 1;
      const nw = calculateNormalizedWidth(aspectRatio, opts);
      const nh = calculateNormalizedHeight(aspectRatio, opts);
      const node = createCanvasLogoNode(cl, nw, nh);
      frame.appendChild(node as Parameters<typeof frame.appendChild>[0]);
    }

    if (!existingFrame) {
      frame.x = Math.round(figma.viewport.center.x - frameWidth / 2);
      frame.y = Math.round(figma.viewport.center.y);
    }

    let resultNode: SceneNode = frame;
    if (config.exportAsComponent) {
      const component = figma.createComponent();
      component.name = "Logo Soup";
      component.layoutMode = "HORIZONTAL";
      component.layoutWrap = "WRAP";
      component.primaryAxisSizingMode = "FIXED";
      component.counterAxisSizingMode = "AUTO";
      component.itemSpacing = config.gap;
      component.counterAxisSpacing = config.gap;
      component.paddingLeft = config.gap;
      component.paddingRight = config.gap;
      component.paddingTop = config.gap;
      component.paddingBottom = config.gap;
      component.fills = [];
      component.resize(frameWidth, 100);

      const children = [...frame.children];
      for (const child of children) {
        component.appendChild(child);
      }

      component.x = frame.x;
      component.y = frame.y;
      frame.remove();
      resultNode = component;
    }

    figma.currentPage.appendChild(resultNode);
    figma.currentPage.selection = [resultNode];
    figma.viewport.scrollAndZoomIntoView([resultNode]);

    sendToUI({ type: "complete" });
    const count = canvasLogos.length;
    const word = count === 1 ? "logo" : "logos";
    const suffix = config.exportAsComponent ? " (Component)" : "";
    const undoTarget = resultNode;
    figma.notify(`Logo Soup: ${count} ${word} generated${suffix}`, {
      timeout: 10000,
      button: {
        text: "Undo",
        action: () => {
          undoTarget.remove();
          figma.notify("Logo Soup removed");
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendToUI({ type: "error", message });
  }
}

function createCanvasLogoNode(
  logo: CanvasLogo,
  normalizedWidth: number,
  normalizedHeight: number,
): SceneNode {
  const w = Math.round(normalizedWidth);
  const h = Math.round(normalizedHeight);

  if (logo.isSvg && logo.nodeId) {
    const original = figma.getNodeById(logo.nodeId);
    if (original && "clone" in original) {
      const cloned = (original as SceneNode & { clone(): SceneNode }).clone();
      if ("resize" in cloned) {
        (cloned as SceneNode & { resize(w: number, h: number): void }).resize(w, h);
      }
      return cloned;
    }
  }

  if (!logo.imageHash) {
    const placeholder = figma.createFrame();
    placeholder.name = `${logo.domain} (no image)`;
    placeholder.resize(w, h);
    placeholder.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.94, b: 0.94 } }];
    return placeholder;
  }

  const container = figma.createFrame();
  container.name = logo.domain;
  container.resize(w, h);
  container.fills = [];
  container.clipsContent = true;

  const rect = figma.createRectangle();
  rect.name = `${logo.domain}-image`;
  rect.resize(w, h);
  rect.fills = [{ type: "IMAGE", imageHash: logo.imageHash, scaleMode: "FIT" }];

  container.appendChild(rect);
  return container;
}

function sendToUI(msg: PluginMessage): void {
  figma.ui.postMessage(msg);
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors in `src/code.ts` after this change. Test files may still have errors — fix in later tasks.

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds. `dist/code.js` should be noticeably smaller (previously ~3.7kb).

**Step 4: Commit**

```bash
git add src/code.ts
git commit -m "feat: simplify code.ts — remove token handlers, Logo.dev fetcher, density params"
```

---

### Task 5: Update code.test.ts

**Files:**
- Modify: `tests/code.test.ts`

**Context:** Current code.test.ts imports `LogoAnalysis` and `GridConfig` with old fields. It has `load-token`, `save-token`, and `createImageAsync` tests. All Logo.dev tests must be removed. Generate-grid tests must be rewritten to use `canvasLogos`.

**Step 1: Read the current tests/code.test.ts to understand its full structure**

(Read it before editing — it has token tests, grid generation tests, and canvas selection tests.)

**Step 2: Rewrite tests/code.test.ts**

Keep only canvas-relevant tests. The new `defaultConfig` must use the simplified `GridConfig`:

```typescript
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
```

**Step 3: Run the code tests**

Run: `npm test -- tests/code.test.ts`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/code.test.ts
git commit -m "test: rewrite code.test.ts for canvas-only workflow"
```

---

### Task 6: Update phase6.test.ts

**Files:**
- Modify: `tests/phase6.test.ts`

**Context:** phase6.test.ts has 4 describe blocks:
1. `Phase 6a: Export as Figma Component` — uses `makeLogo()` (LogoAnalysis) and old GridConfig → rewrite using canvasLogos
2. `Phase 6c: calculateNudge` — imports `calculateNudge` from deleted visual-center.ts → DELETE entire block
3. `Phase 6c: Visual Center Nudging in Plugin` — uses LogoAnalysis with visualCenter, uses `alignBy` → DELETE entire block
4. `Phase 6b: Domain List Reordering` — pure logic, no Logo.dev → KEEP as-is

**Step 1: Read tests/phase6.test.ts** (already read above — use the content from memory)

**Step 2: Rewrite tests/phase6.test.ts**

```typescript
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
```

**Step 3: Run the phase6 tests**

Run: `npm test -- tests/phase6.test.ts`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add tests/phase6.test.ts
git commit -m "test: update phase6.test.ts — remove visual-center and Logo.dev tests, rewrite Phase 6a for canvas"
```

---

### Task 7: Update enhancements.test.ts

**Files:**
- Modify: `tests/enhancements.test.ts`

**Context:** Delete: `Enhancement: Token format validation`, `Enhancement: Analysis caching`, `Enhancement: CORS error boundary`. Rewrite undo/plural tests to use canvasLogos. Keep: numeric input clamping, clear all domains.

**Step 1: Replace enhancements.test.ts**

```typescript
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
```

**Step 2: Run enhancements tests**

Run: `npm test -- tests/enhancements.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add tests/enhancements.test.ts
git commit -m "test: remove Logo.dev/token tests from enhancements.test.ts"
```

---

### Task 8: Rewrite integration.test.ts

**Files:**
- Modify: `tests/integration.test.ts`

**Context:** Current integration.test.ts imports from url-builder, density, crop, visual-center — all deleted. Replace with canvas-only integration tests covering: full generate flow, selection detection + generate round-trip, appendToExisting flow.

**Step 1: Replace tests/integration.test.ts**

```typescript
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
```

**Step 2: Run integration tests**

Run: `npm test -- tests/integration.test.ts`
Expected: All tests pass.

**Step 3: Run all tests**

Run: `npm test`
Expected: All remaining tests pass. Test count will be lower than 168 (deleted test files + deleted describe blocks).

**Step 4: Commit**

```bash
git add tests/integration.test.ts
git commit -m "test: rewrite integration.test.ts for canvas-only flow"
```

---

### Task 9: Simplify ui.html

**Files:**
- Modify: `src/ui.html`

**Context:** The UI has these sections to remove:
- **API Token section**: `<div class="section" id="token-section">` with token input, save button, DOM refs, `save-token` handler, `token-loaded` handler
- **Logo Options section**: `<div class="section" id="logo-options-section">` with theme/format/greyscale controls and DOM refs
- **Density Factor slider**: `densityFactor` input + Density-Aware toggle
- **Align By dropdown**: `alignBy` select element
- **Functions to delete**: `buildLogoUrl`, `loadImage`, `getImageData`, `calculateDensity` (local), `detectContentBounds`, `calculateVisualCenter` (local), `calculateNormalizedWidth` (local), `applyDensityCompensation` (local), `analyzeLogo`, the image analysis loop in `handleGenerate`
- **Message handlers to remove**: `token-loaded` case, `load-token` postMessage on startup
- **What stays**: Canvas selection banner, canvas badges in logo list, append toggle, Columns/Base Size/Gap/Scale Factor/Export as Component controls, generate button

**Step 1: Read src/ui.html**

Read the entire file to understand the current structure before editing.

**Step 2: Remove API Token section HTML**

Find and delete the HTML block for the API token section (the `<div class="section">` containing the token `<input>` and save button).

**Step 3: Remove Logo Options section HTML**

Find and delete the HTML block for Logo Options (theme radio buttons, format radio buttons, greyscale checkbox).

**Step 4: Remove Density Factor and Align By HTML**

Delete the density factor `<input type="range">` block and the Align By `<select>` block from the Grid Config section.

**Step 5: Remove JavaScript — token and analysis functions**

In the `<script>` tag, delete:
- All `const tokenInput`, `const saveTokenBtn` DOM refs
- `buildLogoUrl(domain, token, config)` function
- `loadImage(url)` function
- `getImageData(img, width, height)` function
- `calculateDensity(imageData)` function (local copy)
- `detectContentBounds(imageData)` function
- `calculateVisualCenter(imageData, bounds)` function
- `calculateNormalizedWidth(aspectRatio, opts)` function (local copy)
- `applyDensityCompensation(size, density, meanDensity, densityFactor)` function (local copy)
- `analyzeLogo(domain, config)` async function
- The `for (const domain of domains)` analysis loop in `handleGenerate`
- The `analysisCache` Map
- All DOM refs for: `themeAuto/Light/Dark`, `formatPng/Jpg/Webp`, `greyscaleCheckbox`, `densityFactorInput`, `densityAwareCheckbox`, `alignBySelect`

**Step 6: Remove token-related message handling**

In the `window.onmessage` handler, delete the `token-loaded` case.

Remove the startup `parent.postMessage({ pluginMessage: { type: 'load-token' } }, '*')` call.

**Step 7: Simplify handleGenerate**

The image analysis loop is gone. `handleGenerate` should now simply:
1. Read config from the remaining inputs (columns, baseSize, gap, scaleFactor, exportAsComponent)
2. Get `canvasLogos` from `canvasLogoMap` values (already collected from selection-detected)
3. Post `{ type: 'generate-grid', config, canvasLogos, appendToExisting }` to the plugin

```javascript
function handleGenerate() {
  const config = {
    columns: parseInt(columnsInput.value, 10) || 4,
    baseSize: parseInt(baseSizeInput.value, 10) || 48,
    gap: parseInt(gapInput.value, 10) || 16,
    scaleFactor: parseFloat(scaleFactorInput.value) || 0.5,
    exportAsComponent: exportAsComponentCheckbox.checked,
  };

  const canvasLogos = Array.from(canvasLogoMap.values());

  parent.postMessage({
    pluginMessage: {
      type: 'generate-grid',
      config,
      canvasLogos,
      appendToExisting,
    },
  }, '*');
}
```

**Step 8: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors. `dist/code.js` is notably smaller.

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: All tests pass.

**Step 9: Commit**

```bash
git add src/ui.html
git commit -m "feat: remove API token input, Logo Options, density/align controls from UI"
```

---

### Task 10: Final verification and cleanup

**Files:**
- Possibly modify: `tests/setup.ts` (check for loadFontAsync reference)
- Possibly modify: `CLAUDE.md`

**Step 1: Check tests/setup.ts for loadFontAsync**

Run: `grep -n "loadFontAsync" tests/setup.ts`
If present, remove it since `figma.loadFontAsync` is no longer called from `code.ts`.

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass. Note the new total count.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

**Step 4: Run build and check output size**

Run: `npm run build && wc -c dist/code.js`
Expected: Notably smaller than the previous ~3.7kb.

**Step 5: Check dist/code.js does not contain Logo.dev references**

Run: `grep -c "logo.dev\|img\.logo\|token\|pk_\|densityAware\|alignBy" dist/code.js`
Expected: 0 matches.

**Step 6: Update CLAUDE.md progress**

Update the Progress section of `CLAUDE.md` to note the API removal:

```markdown
- [x] Remove Logo.dev API — canvas-only workflow, PINF normalization kept
```

Update the Message Protocol section to reflect simplified protocol.

Update test count.

**Step 7: Final commit**

```bash
git add .
git commit -m "docs: update CLAUDE.md for canvas-only workflow"
```
