# Remove Logo.dev API — Design Doc
**Date:** 2026-03-04

## Problem
The plugin requires a Logo.dev API token, but users just want to arrange logos they already have on the Figma canvas. The token requirement is friction, and all the Logo.dev fetch/analysis infrastructure is now dead weight since canvas selection was added.

## Solution: Hard Rip — Delete All API Code

### What Gets Deleted

**Utility files (delete entirely):**
- `src/utils/url-builder.ts`
- `src/utils/density.ts`
- `src/utils/crop.ts`

**Partial deletions from utilities:**
- `src/utils/normalize.ts` — remove `applyDensityCompensation`, `calculateMeanDensity`; keep `calculateNormalizedWidth`, `calculateNormalizedHeight`
- `src/utils/visual-center.ts` — delete entirely (no visual center analysis without image fetching)

**From `src/utils/types.ts`:**
- Delete `LogoAnalysis`, `ContentBounds`, `VisualCenter` interfaces
- Simplify `GridConfig`: remove `theme`, `greyscale`, `format`, `densityAware`, `densityFactor`, `alignBy`
- Keep: `columns`, `baseSize`, `gap`, `scaleFactor`, `exportAsComponent`
- Simplify `UIMessage` `generate-grid` variant: remove `logos` and `appendToExisting`, change `canvasLogos` to required
- Remove `save-token` and `load-token` from `UIMessage`
- Remove `token-loaded` from `PluginMessage`

**From `src/code.ts`:**
- Remove `handleLoadToken`, `handleSaveToken`, their message cases
- Remove `createLogoNode` (async Logo.dev image fetcher)
- Remove `createPlaceholderNode`
- Remove Logo.dev logo placement loop from `handleGenerateGrid`
- Remove `logos: LogoAnalysis[]` param from `handleGenerateGrid`
- Remove `figma.loadFontAsync` call (only needed for placeholder text labels)
- Remove `calculateGridLayout` import (no longer needed with simplified flow)

**From `src/ui.html`:**
- Delete API Token section HTML + DOM refs + save-token handler
- Delete Logo Options section (theme, format, greyscale) HTML + DOM refs
- Delete Density Factor slider + Density-Aware toggle + Align By dropdown HTML + DOM refs
- Delete functions: `buildLogoUrl`, `loadImage`, `getImageData`, `calculateDensity` (local copy), `detectContentBounds`, `calculateVisualCenter` (local copy), `calculateNormalizedWidth` (local copy), `applyDensityCompensation` (local copy), `analyzeLogo`, `handleGenerate` image analysis loop
- Remove `token-loaded` message handler
- Remove `load-token` message on startup

### New Simplified GridConfig
```typescript
export interface GridConfig {
  columns: number;
  baseSize: number;
  gap: number;
  scaleFactor: number;
  exportAsComponent: boolean;
}
```

### New Generate Message
```typescript
{ type: "generate-grid"; config: GridConfig; canvasLogos: CanvasLogo[]; appendToExisting?: boolean }
```

### New Generate Flow
1. User selects logos on canvas → opens plugin
2. `extractCanvasSelection()` sends `selection-detected` with detected logos
3. UI shows logos in list with ⊞ badges
4. User adjusts Columns / Base Size / Gap / Scale Factor / Export as Component / New grid vs Append
5. If no logos detected: show empty state "Select logos on the Figma canvas to get started"
6. Generate → sends `generate-grid` with `canvasLogos` only (no network fetch)
7. Plugin normalizes via PINF (aspect ratio from canvas width/height), places in grid

### What Stays
- `extractCanvasSelection` and all canvas selection logic
- `createCanvasLogoNode` (SVG clone + image hash paths)
- Frame/component creation and auto-layout
- `calculateNormalizedWidth`/`calculateNormalizedHeight` from normalize.ts
- `calculateGridLayout` from grid-layout.ts
- Columns, Base Size, Gap, Scale Factor, Export as Component UI controls
- Append toggle and selection banner

## Files to Modify
- **Delete:** `src/utils/url-builder.ts`, `src/utils/density.ts`, `src/utils/crop.ts`, `src/utils/visual-center.ts`
- **Simplify:** `src/utils/normalize.ts`, `src/utils/types.ts`
- **Heavily edit:** `src/code.ts`, `src/ui.html`
- **Update:** tests for deleted modules, `tests/setup.ts` (remove loadFontAsync reference if unused)

## Verification
1. `npm run build` — succeeds, dist/code.js shrinks noticeably
2. `npm run typecheck` — 0 errors
3. `npm test` — all remaining tests pass (tests for deleted modules are also deleted)
4. Open plugin in Figma with nothing selected → empty state shown
5. Select frames → open plugin → logos appear, Generate works without any token prompt
