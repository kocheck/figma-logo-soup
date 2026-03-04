# Canvas Logo Selection — Design Doc
**Date:** 2026-03-04

## Problem
Users want to select logos already placed on the Figma canvas (from a previous Logo Soup run, manually placed images, or SVGs) and add them into a new or existing Logo Soup grid — without needing to re-type domain names or have an API key if the images are already local.

## Solution: Auto-detect on Plugin Open + Canvas-Native Image Reuse

### 1. Domain Extraction (plugin sandbox — `src/code.ts`)

On plugin open, immediately after `figma.showUI(...)`:
1. Read `figma.currentPage.selection`
2. For each selected node, walk direct children if parent frame is named "Logo Soup" (to support selecting the whole grid)
3. For each node, attempt domain extraction from `node.name` via regex `/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/`
4. Extract image data:
   - Frame/Rectangle with image fill → extract `imageHash` from first `IMAGE` type fill
   - VectorNode (SVG) → no imageHash, will clone directly
5. Send `{ type: "selection-detected", logos: CanvasLogo[] }` to UI

**New type `CanvasLogo`:**
```typescript
interface CanvasLogo {
  domain: string;        // extracted from name, or fallback "unknown"
  width: number;         // node.width
  height: number;        // node.height
  imageHash?: string;    // from image fill, if present
  isSvg?: boolean;       // true for VectorNode
  nodeId?: string;       // figma node ID for SVG cloning
}
```

### 2. UI Changes (`src/ui.html`)

On receiving `selection-detected`:
- Prepend detected domains to the domain list (deduplicated)
- Show dismissable info banner: `"X logos imported from canvas selection"`
- Show new toggle near Generate button: **"New grid" / "Append to existing Logo Soup"**
  - Default: "Append" if a "Logo Soup" frame exists on current page; otherwise "New grid"
  - (Plugin will detect existence and include in `selection-detected` message)

Canvas-sourced logos in the domain list show a canvas icon badge. They don't require API key.

The `generate-grid` message gets two new fields:
- `appendToExisting: boolean`
- `canvasLogos: CanvasLogo[]` — logos to place directly from canvas data (bypasses Logo.dev fetch)

### 3. Grid Generation (`src/code.ts`)

In the `generate-grid` handler:
- If `appendToExisting: true`, find existing "Logo Soup" frame on `figma.currentPage.children` by name; fall back to creating new
- For each logo in `logos` array (existing flow, Logo.dev fetch)
- For each logo in `canvasLogos`:
  - If `imageHash` present: create container frame + rectangle with that image hash (no `createImageAsync` call)
  - If `isSvg: true` + `nodeId`: clone the SVG node via `figma.getNodeById(nodeId).clone()`, resize to normalized dimensions
  - Apply PINF normalization to `canvasLogos` using their `width/height` as natural dimensions; density defaults to 0.5

### 4. Type Changes (`src/utils/types.ts`)

- Add `CanvasLogo` interface
- Add `imageHash?: string` to `LogoAnalysis`
- Add `appendToExisting?: boolean` and `canvasLogos?: CanvasLogo[]` to `generate-grid` message
- Add `selection-detected` to Plugin → UI message union

## Files to Modify
- `src/utils/types.ts` — new types and message variants
- `src/code.ts` — selection reading on startup, canvas logo handling in generate-grid
- `src/ui.html` — selection-detected handler, banner, new/append toggle, canvas badges

## Verification
1. Place some logo frames on canvas (or use an existing Logo Soup grid), select them, open plugin → domain list pre-populated
2. Place an image manually on canvas (no domain name), select it → appears as "unknown" or nearest extracted name
3. Place an SVG, select it → cloned into grid without API key
4. Generate with API key → new grid created
5. Generate append → logos added to existing Logo Soup frame
6. Open plugin with nothing selected → no banner, normal flow
7. Run `npm test` → all 158 existing tests still pass + new tests for extraction logic
