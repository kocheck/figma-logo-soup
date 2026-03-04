# Canvas Logo Selection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users select logo nodes already on the Figma canvas, have them auto-detected when the plugin opens, and generate/append a Logo Soup grid from them — no API key required for locally-placed images.

**Architecture:** On startup, the plugin reads `figma.currentPage.selection`, extracts domain names and image hashes from selected nodes, and sends them to the UI via `selection-detected`. The UI pre-populates the domain list and shows a new/append toggle. When generating, canvas-sourced logos bypass `createImageAsync` and use the extracted image hash or SVG clone directly.

**Tech Stack:** TypeScript strict, Figma Plugin API, Vitest, plain HTML/CSS/JS UI (safe DOM methods only — no innerHTML), esbuild

---

## Task 1: Add types for canvas logo selection

**Files:**
- Modify: `src/utils/types.ts`

**Step 1: Add `CanvasLogo` interface**

In `src/utils/types.ts`, add after the `LogoAnalysis` interface:

```typescript
export interface CanvasLogo {
  domain: string;      // extracted from node name, or "unknown"
  width: number;       // node.width (natural dimensions)
  height: number;      // node.height
  imageHash?: string;  // from image fill, if present
  isSvg?: boolean;     // true for VectorNode
  nodeId?: string;     // figma node ID, used for SVG cloning
}
```

**Step 2: Add `imageHash?` to `LogoAnalysis`**

After `normalizedHeight` in the `LogoAnalysis` interface, add:

```typescript
  imageHash?: string;  // pre-fetched hash for canvas-sourced logos
```

**Step 3: Update message protocol**

Replace the `generate-grid` variant in `UIMessage`:

```typescript
  | { type: "generate-grid"; config: GridConfig; logos: LogoAnalysis[]; appendToExisting?: boolean; canvasLogos?: CanvasLogo[] }
```

Add to `PluginMessage` union:

```typescript
  | { type: "selection-detected"; logos: CanvasLogo[]; hasExistingGrid: boolean }
```

**Step 4: Verify types compile**

```bash
npm run typecheck
```
Expected: no errors

**Step 5: Commit**

```bash
git add src/utils/types.ts
git commit -m "feat: add CanvasLogo type and selection-detected message protocol"
```

---

## Task 2: Update test mocks for canvas selection

**Files:**
- Modify: `tests/setup.ts`

**Step 1: Add `getNodeById` to mock figma**

In `tests/setup.ts`, add `getNodeById` to `mockFigma` (after `loadFontAsync`):

```typescript
  getNodeById: vi.fn((_id: string) => null as unknown),
```

Also update `mockFigma.currentPage` to include `children`:

```typescript
  currentPage: {
    appendChild: vi.fn(),
    selection: [] as unknown[],
    children: [] as unknown[],
  },
```

**Step 2: Verify existing tests still pass**

```bash
npm test
```
Expected: 158 passing, 0 failing

**Step 3: Commit**

```bash
git add tests/setup.ts
git commit -m "test: add getNodeById mock and currentPage.children to figma mock"
```

---

## Task 3: Domain extraction helper (`extractCanvasSelection`)

**Files:**
- Modify: `src/code.ts`
- Create: `tests/canvas-selection.test.ts`

**Step 1: Write failing tests**

Create `tests/canvas-selection.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma } from "./setup";
import type { GridConfig } from "../src/utils/types";

async function loadCode() {
  vi.resetModules();
  await import("../src/code");
}

const defaultConfig: GridConfig = {
  columns: 4, baseSize: 48, gap: 16, theme: "light", greyscale: false,
  format: "png", scaleFactor: 0.5, densityAware: false, densityFactor: 0.5,
  exportAsComponent: false, alignBy: "bounds",
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
```

**Step 2: Run tests to verify they fail**

```bash
npm test tests/canvas-selection.test.ts
```
Expected: FAIL — `selection-detected` message never sent

**Step 3: Implement `extractCanvasSelection` in `src/code.ts`**

Update the import at the top to include `CanvasLogo`:

```typescript
import type { UIMessage, PluginMessage, LogoAnalysis, GridConfig, CanvasLogo } from "./utils/types";
```

Add the domain regex and helper functions before `figma.ui.onmessage`:

```typescript
const DOMAIN_REGEX = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

function extractNodeAsCanvasLogo(node: SceneNode): CanvasLogo {
  const isDomain = DOMAIN_REGEX.test(node.name);
  const domain = isDomain ? node.name : "unknown";

  // Extract image hash from fills if available
  let imageHash: string | undefined;
  if ("fills" in node && Array.isArray(node.fills)) {
    const imageFill = (node.fills as Paint[]).find((f) => f.type === "IMAGE") as ImagePaint | undefined;
    if (imageFill?.imageHash) imageHash = imageFill.imageHash;
  }

  // SVG / vector node — will be cloned by ID at generation time
  if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") {
    return { domain, width: node.width, height: node.height, isSvg: true, nodeId: node.id };
  }

  return { domain, width: node.width, height: node.height, imageHash };
}

function extractCanvasSelection(): void {
  const selection = figma.currentPage.selection;
  const logos: CanvasLogo[] = [];

  for (const node of selection) {
    // If user selected the whole Logo Soup frame, walk its direct children
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
```

Call `extractCanvasSelection()` right after `figma.showUI(...)`:

```typescript
figma.showUI(__html__, { themeColors: true, width: 360, height: 540 });
extractCanvasSelection(); // read canvas selection on open
```

**Step 4: Run tests**

```bash
npm test tests/canvas-selection.test.ts
```
Expected: all canvas-selection tests pass

**Step 5: Run full suite**

```bash
npm test
```
Expected: 158 + new tests all passing

**Step 6: Commit**

```bash
git add src/code.ts tests/canvas-selection.test.ts
git commit -m "feat: read canvas selection on plugin open and send selection-detected"
```

---

## Task 4: Canvas logo node creation (image hash + SVG clone)

**Files:**
- Modify: `src/code.ts`
- Modify: `tests/canvas-selection.test.ts`

**Step 1: Write failing tests**

Append to `tests/canvas-selection.test.ts`:

```typescript
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

    // Should not create a new frame — reuses existingFrame
    const newFrames = mockFigma.createFrame.mock.results.filter(
      (r: { value: { name: string } }) => r.value.name === "Logo Soup"
    );
    expect(newFrames).toHaveLength(0);
    expect(existingFrame.appendChild).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test tests/canvas-selection.test.ts -- --reporter verbose 2>&1 | tail -20
```

**Step 3: Add normalize import and `createCanvasLogoNode` to `src/code.ts`**

Add import at top:

```typescript
import { calculateNormalizedWidth, calculateNormalizedHeight } from "./utils/normalize";
```

Add `createCanvasLogoNode` function:

```typescript
function createCanvasLogoNode(
  logo: CanvasLogo,
  normalizedWidth: number,
  normalizedHeight: number,
): SceneNode {
  const w = Math.round(normalizedWidth);
  const h = Math.round(normalizedHeight);

  // SVG path: clone the original vector node and resize it
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

  // Image hash path: reuse existing image data, no network fetch
  const container = figma.createFrame();
  container.name = logo.domain;
  container.resize(w, h);
  container.fills = [];
  container.clipsContent = true;

  const rect = figma.createRectangle();
  rect.name = `${logo.domain}-image`;
  rect.resize(w, h);
  rect.fills = [{ type: "IMAGE", imageHash: logo.imageHash ?? "", scaleMode: "FIT" }];

  container.appendChild(rect);
  return container;
}
```

**Step 4: Update `handleGenerateGrid` signature and body**

Update the function signature:

```typescript
async function handleGenerateGrid(
  config: GridConfig,
  logos: LogoAnalysis[],
  appendToExisting?: boolean,
  canvasLogos?: CanvasLogo[],
): Promise<void> {
```

Update the message handler case:

```typescript
case "generate-grid":
  await handleGenerateGrid(msg.config, msg.logos, msg.appendToExisting, msg.canvasLogos);
  break;
```

Replace the empty check:

```typescript
if (logos.length === 0 && (!canvasLogos || canvasLogos.length === 0)) {
  sendToUI({ type: "error", message: "No logos to generate" });
  return;
}
```

Replace `const frame = figma.createFrame()` and its sizing block with:

```typescript
// Find existing Logo Soup frame or create a new one
const allNormalizedWidths = [
  ...logos.map((l) => l.normalizedWidth),
  ...(canvasLogos ?? []).map((cl) =>
    calculateNormalizedWidth(cl.width / cl.height, {
      baseSize: config.baseSize,
      scaleFactor: config.scaleFactor,
      densityAware: false,
      densityFactor: 0,
    })
  ),
  config.baseSize, // fallback minimum
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
```

After the Logo.dev logo loop, add the canvas logo loop:

```typescript
// Place canvas-sourced logos (no network fetch needed)
for (const cl of canvasLogos ?? []) {
  const aspectRatio = cl.width > 0 && cl.height > 0 ? cl.width / cl.height : 1;
  const opts = { baseSize: config.baseSize, scaleFactor: config.scaleFactor, densityAware: false as const, densityFactor: 0 };
  const nw = calculateNormalizedWidth(aspectRatio, opts);
  const nh = calculateNormalizedHeight(aspectRatio, opts);
  const node = createCanvasLogoNode(cl, nw, nh);
  frame.appendChild(node as Parameters<typeof frame.appendChild>[0]);
}
```

**Step 5: Run tests**

```bash
npm test
```
Expected: all tests passing

**Step 6: Commit**

```bash
git add src/code.ts tests/canvas-selection.test.ts
git commit -m "feat: canvas logo node creation with image hash reuse and SVG clone support"
```

---

## Task 5: UI — `selection-detected` handler, banner, domain badges, append toggle

**Files:**
- Modify: `src/ui.html`

> The UI is a large plain HTML/JS file. All DOM construction uses `createElement`/`textContent` — never `innerHTML` with dynamic content.

**Step 1: Add `canvasLogoMap` and `appendToExisting` state**

Near the top of the `<script>` block (where `let domains = []` is declared), add:

```javascript
// Canvas logo metadata: domain string → CanvasLogo from plugin selection
const canvasLogoMap = new Map();
let appendToExisting = false;
```

**Step 2: Handle `selection-detected` message**

In `window.onmessage` dispatch, add a new case after `'token-loaded'`:

```javascript
case 'selection-detected': {
  const { logos, hasExistingGrid } = msg;
  if (logos.length > 0) {
    logos.forEach(logo => {
      if (!domains.includes(logo.domain)) {
        canvasLogoMap.set(logo.domain, logo);
        domains.unshift(logo.domain);
      }
    });
    renderDomains();
    showSelectionBanner(logos.length);
  }
  appendToExisting = hasExistingGrid;
  renderAppendToggle();
  break;
}
```

**Step 3: Add `showSelectionBanner` function**

```javascript
function showSelectionBanner(count) {
  const existing = document.getElementById('selection-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'selection-banner';
  banner.style.cssText = [
    'background:var(--figma-color-bg-selected,#e8f0fe)',
    'color:var(--figma-color-text,#333)',
    'padding:8px 12px',
    'font-size:11px',
    'border-radius:4px',
    'margin-bottom:8px',
    'display:flex',
    'justify-content:space-between',
    'align-items:center',
  ].join(';');

  const text = document.createElement('span');
  text.textContent = `${count} logo${count === 1 ? '' : 's'} imported from canvas selection`;

  const dismiss = document.createElement('button');
  dismiss.textContent = '\u2715';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:0 0 0 8px;';
  dismiss.addEventListener('click', () => banner.remove());

  banner.appendChild(text);
  banner.appendChild(dismiss);

  const domainSection = document.querySelector('.section-domains') || document.getElementById('domain-list');
  if (domainSection && domainSection.parentNode) {
    domainSection.parentNode.insertBefore(banner, domainSection);
  }
}
```

**Step 4: Add canvas badge in `renderDomains`**

In the `renderDomains` function, where the domain label element is constructed, add a badge for canvas-sourced domains:

```javascript
if (canvasLogoMap.has(domain)) {
  const badge = document.createElement('span');
  badge.textContent = '\u229e'; // ⊞ unicode box with cross (canvas indicator)
  badge.title = 'From canvas selection — no API key needed';
  badge.setAttribute('aria-label', 'Canvas logo');
  badge.style.cssText = 'font-size:9px;opacity:0.55;margin-right:4px;';
  label.insertBefore(badge, label.firstChild);
}
```

**Step 5: Add `renderAppendToggle` function**

```javascript
function renderAppendToggle() {
  let toggle = document.getElementById('append-toggle');
  if (!toggle) {
    toggle = document.createElement('div');
    toggle.id = 'append-toggle';
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Grid placement');
    toggle.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn && generateBtn.parentNode) {
      generateBtn.parentNode.insertBefore(toggle, generateBtn);
    }
  }

  // Clear children safely
  while (toggle.firstChild) toggle.removeChild(toggle.firstChild);

  const makeBtn = (label, isAppend) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    const active = isAppend === appendToExisting;
    btn.style.cssText = [
      'flex:1',
      'padding:4px 8px',
      'border-radius:4px',
      'cursor:pointer',
      'font-size:11px',
      `border:1px solid var(--figma-color-border,#ccc)`,
      `background:${active ? 'var(--figma-color-bg-selected,#e8f0fe)' : 'var(--figma-color-bg,#fff)'}`,
      `font-weight:${active ? '600' : '400'}`,
    ].join(';');
    btn.addEventListener('click', () => {
      appendToExisting = isAppend;
      renderAppendToggle();
    });
    return btn;
  };

  toggle.appendChild(makeBtn('New grid', false));
  toggle.appendChild(makeBtn('Append to existing', true));
}
```

**Step 6: Update the generate message**

In the generate button's click handler, after building the `logos` array, update the `parent.postMessage` call:

```javascript
// Separate canvas-sourced from Logo.dev logos
const canvasLogosToSend = domains
  .filter(d => canvasLogoMap.has(d))
  .map(d => canvasLogoMap.get(d));
const logosToFetch = logos.filter(l => !canvasLogoMap.has(l.domain));

parent.postMessage({
  pluginMessage: {
    type: 'generate-grid',
    config,
    logos: logosToFetch,
    canvasLogos: canvasLogosToSend,
    appendToExisting,
  }
}, '*');
```

**Step 7: Build and verify**

```bash
npm run build
```

Load plugin in Figma and manually verify:
1. Select some logo frames → open plugin → banner + pre-populated domains with ⊞ badge
2. Select a Logo Soup frame → all child domains appear
3. Nothing selected → no banner, no toggle shown (toggle only renders when `selection-detected` fires)
4. Toggle between "New grid" / "Append to existing" → visual state updates
5. Generate with canvas logos only (no API key) → grid created without errors
6. Generate append → logos added to existing Logo Soup frame

**Step 8: Commit**

```bash
git add src/ui.html
git commit -m "feat: UI handles selection-detected, shows import banner, append toggle, canvas badges"
```

---

## Task 6: Final verification

**Step 1: Run full test suite**

```bash
npm test
```
Expected: all tests passing (158 + new canvas-selection tests)

**Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: 0 errors

**Step 3: Build**

```bash
npm run build
```
Expected: `dist/code.js` built successfully, no `??` or `?.` in output

**Step 4: End-to-end in Figma**

| Scenario | Expected |
|---|---|
| Select image frame named `stripe.com`, open plugin | Banner shown, "stripe.com" with ⊞ badge in list |
| Select whole Logo Soup frame, open plugin | All child domains extracted |
| Select SVG vector node, generate | SVG cloned, resized, placed in grid |
| Canvas logo + no API key, generate | Grid created with no network errors |
| Toggle "Append to existing", generate | Logos added to existing Logo Soup frame |
| Nothing selected, open plugin | Normal flow, no banner |

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: canvas logo selection — complete"
```

---

## Summary of changed files

| File | Change |
|---|---|
| `src/utils/types.ts` | `CanvasLogo` interface, `selection-detected` message, `imageHash?` on `LogoAnalysis`, `appendToExisting`/`canvasLogos` on `generate-grid` |
| `src/code.ts` | `extractCanvasSelection()` called on startup, `createCanvasLogoNode()`, updated `handleGenerateGrid` with append + canvas logo loops |
| `src/ui.html` | `selection-detected` handler, `canvasLogoMap` state, banner, domain badges (safe DOM), append toggle, updated generate message |
| `tests/setup.ts` | `getNodeById` mock, `currentPage.children` array |
| `tests/canvas-selection.test.ts` | New test file — extraction logic, canvas node creation, append-to-existing |
