# Figma Logo Soup — Project Blueprint

## Overview
A Figma Plugin that generates visually balanced logo grids on the Figma canvas using the Logo Soup normalization algorithm (PINF) for visual harmony. Works with logos already on the canvas — no external API required. Inspired by [react-logo-soup](https://github.com/sanity-labs/react-logo-soup) by Sanity Labs.

## Architecture

### Project Structure
```
figma-logo-soup/
├── CLAUDE.md                    # This file — phased plan + progress
├── manifest.json                # Figma plugin manifest
├── package.json                 # Scripts: build, watch, test
├── tsconfig.json                # TypeScript strict mode
├── esbuild.config.mjs           # Build config for plugin sandbox
├── vitest.config.ts             # Vitest configuration
├── .gitignore
├── src/
│   ├── code.ts                  # Plugin sandbox entry point
│   ├── ui.html                  # Plugin UI (plain HTML/CSS/JS)
│   ├── utils/
│   │   ├── types.ts             # Shared TypeScript types & message protocol
│   │   ├── normalize.ts         # PINF formula
│   │   └── grid-layout.ts       # Grid position calculator
├── tests/
│   ├── setup.ts                 # Figma API mocks
│   ├── normalize.test.ts
│   ├── grid-layout.test.ts
│   ├── code.test.ts             # Plugin sandbox tests
│   ├── integration.test.ts      # Full flow tests
│   ├── phase6.test.ts           # Phase 6 feature tests
│   ├── canvas-selection.test.ts # Canvas selection workflow tests
│   └── enhancements.test.ts     # v1.0 enhancement tests
└── README.md
```

### Module Boundaries
- **Pure utilities** (`src/utils/`): Zero Figma dependencies. Framework-agnostic math and URL construction. Trivially testable.
- **Plugin sandbox** (`src/code.ts`): Thin orchestration layer. Uses Figma API for canvas manipulation. Tested with mocked `figma` global.
- **Plugin UI** (`src/ui.html`): User interaction + canvas-based image analysis. Sends results to plugin via `postMessage`.

### Message Protocol (UI ↔ Plugin)
```
UI → Plugin:
  { type: 'generate-grid', config: GridConfig, canvasLogos: CanvasLogo[], appendToExisting?: boolean }

Plugin → UI:
  { type: 'progress', current: number, total: number, domain: string }
  { type: 'complete' }
  { type: 'error', message: string }
  { type: 'selection-detected', logos: CanvasLogo[], hasExistingGrid: boolean }
```

### Key Algorithm: PINF (Proportional Image Normalization Formula)
```
normalizedWidth = baseSize × (aspectRatio ^ scaleFactor)
normalizedHeight = normalizedWidth / aspectRatio
```
- `scaleFactor=0` → all logos same width
- `scaleFactor=1` → all logos same height
- `scaleFactor=0.5` → balanced (default)

### Density-Aware Scaling
- Count filled vs transparent pixels (weighted by opacity)
- Dense logos scale down, light logos scale up
- `densityFactor`: 0 = pure PINF, 1 = density dominant, 0.5 = balanced

## Conventions
- TypeScript strict mode throughout
- Build: esbuild (not webpack)
- Test: Vitest with full coverage for all utility functions
- UI: Plain HTML/CSS/JS (no React/Vue/Svelte)
- Canvas-only workflow: logos are selected from the Figma canvas, no external API calls
- Error handling: failed logos → placeholder rectangle with domain name text
- Logo nodes named with domain (e.g., "stripe.com")
- Parent frame named "Logo Soup" with auto-layout wrap

## Build & Test Commands
```bash
npm run build          # esbuild production build
npm run watch          # esbuild watch mode
npm test               # vitest run
npm run test:watch     # vitest watch mode
npm run typecheck      # tsc --noEmit
```

## Progress

- [x] Phase 1: Project Scaffolding & Build Pipeline — COMPLETE (5 tests)
- [x] Phase 2: Core Normalization Engine — COMPLETE (78 tests)
- [x] Phase 3: Plugin Sandbox Core — COMPLETE (16 tests)
- [x] Phase 4: Plugin UI — COMPLETE (9 tests)
- [x] Phase 5: Integration & Polish — COMPLETE (9 tests)
- [x] Phase 6: Advanced Features — COMPLETE (20 tests)
  - [x] 6a: Export as Figma Component
  - [x] 6b: Drag-to-Reorder domain list in UI
  - [x] 6c: Visual Center Alignment Nudging
  - [x] 6d: Tests for all Phase 6 features

- [x] v1.0 Enhancements — COMPLETE (21 tests)
  - [x] Token format validation (pk_ prefix)
  - [x] Numeric input blur clamping (columns, baseSize, gap, scaleFactor, densityFactor)
  - [x] CORS error boundary on canvas getImageData
  - [x] Accessibility (ARIA labels, keyboard nav, live regions)
  - [x] Undo support via figma.notify button
  - [x] Loading spinner on generate button
  - [x] Clear All domains button
  - [x] Analysis caching (Map keyed by URL)
  - [x] Singular/plural notification message
  - [x] Empty state for domain list
  - [x] Tooltips on Scale Factor and Density Factor

- [x] Remove Logo.dev API — canvas-only workflow, PINF normalization kept

**Total: 82 tests passing across 8 test files, 3.3kb dist/code.js**

---

## Phase Details

### Phase 1: Project Scaffolding & Build Pipeline
- Initialize project structure (src/, tests/, src/utils/)
- package.json with esbuild build scripts and Vitest
- manifest.json with Figma plugin config and `networkAccess.allowedDomains: ["img.logo.dev"]`
- tsconfig.json with strict mode
- esbuild.config.mjs for building code.ts → dist/code.js
- vitest.config.ts
- .gitignore
- **Tests**: Build pipeline smoke test — esbuild compiles, Vitest runs

### Phase 2: Core Normalization Engine (Pure Logic)
- `normalize.ts` — PINF formula + density compensation
- `grid-layout.ts` — grid position calculator
- `types.ts` — shared types
- **Tests**: Full unit tests for every function with edge cases

### Phase 3: Plugin Sandbox Core (code.ts)
- Main plugin entry point
- Message handler dispatch
- Frame creation with auto-layout wrap
- Canvas logo placement via PINF normalization
- Error handling with placeholder rectangles
- **Tests**: Mock `figma` global, test all handlers

### Phase 4: Plugin UI (ui.html)
- Complete plugin interface with Figma-native theming
- Domain list, Grid config options
- Canvas selection detection and logo analysis
- PostMessage integration
- Progress/error feedback
- **Tests**: Message serialization, config validation

### Phase 5: Integration & Polish
- End-to-end message flow
- Popular logos quick-add
- Loading states and progress indicator
- Final error handling sweep
- **Tests**: Integration tests for full message round-trip

### Phase 6: Advanced Features — COMPLETE
- Export as Figma component (exportAsComponent config flag)
- Drag-to-reorder domain list in UI (HTML5 Drag and Drop API)
- Visual center alignment nudging (calculateNudge + alignBy config: bounds/visual-center-x/y/xy)
