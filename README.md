# Figma Logo Soup

A Figma plugin that generates visually balanced logo grids directly on the canvas, using the [Logo.dev](https://logo.dev) API for logo sourcing and the [Logo Soup](https://www.sanity.io/blog/the-logo-soup-problem) normalization algorithm for visual harmony.

Inspired by [react-logo-soup](https://github.com/sanity-labs/react-logo-soup) by Sanity Labs.

## Features

- **PINF Normalization** — Proportional Image Normalization Formula balances logo sizes based on aspect ratio
- **Density-Aware Scaling** — Analyzes pixel density to scale down dense logos and scale up light ones
- **Content Boundary Detection** — Crops to actual content bounds, ignoring baked-in whitespace
- **Visual Center Calculation** — Finds visual center of mass for perceptually centered alignment
- **Auto-Layout Grid** — Wrapping grid with configurable columns, gap, and base size
- **Figma-Native Theming** — UI respects Figma's light/dark theme
- **Popular Logo Presets** — Quick-add common tech company logos
- **Persistent API Token** — Saved between sessions via `figma.clientStorage`
- **Graceful Error Handling** — Failed logos show placeholder rectangles with domain labels

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Logo.dev](https://logo.dev) publishable API token (`pk_...`)

### Install

```bash
git clone https://github.com/your-org/figma-logo-soup.git
cd figma-logo-soup
npm install
```

### Build

```bash
npm run build       # Production build
npm run watch       # Watch mode for development
```

### Test

```bash
npm test            # Run all tests
npm run test:watch  # Watch mode
npm run typecheck   # TypeScript type checking
```

### Load in Figma

1. Open Figma Desktop
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select the `manifest.json` file from this project
4. The plugin appears under **Plugins → Development → Logo Soup**

## Usage

1. Open the plugin from the Figma menu
2. Enter your Logo.dev API token (saved for future sessions)
3. Add domains — type them manually or click preset chips
4. Configure grid settings (columns, base size, gap)
5. Choose logo options (theme, format, greyscale)
6. Adjust normalization (scale factor, density factor)
7. Click **Generate Logo Soup**
8. A "Logo Soup" frame appears on your canvas with balanced logos

## Architecture

```
src/
├── code.ts                  # Plugin sandbox — Figma API orchestration
├── ui.html                  # Plugin UI — form + canvas-based image analysis
└── utils/
    ├── types.ts             # Shared TypeScript types & message protocol
    ├── normalize.ts         # PINF formula + density compensation
    ├── density.ts           # Pixel density analysis from ImageData
    ├── crop.ts              # Content boundary detection
    ├── visual-center.ts     # Visual center of mass calculation
    ├── url-builder.ts       # Logo.dev CDN URL construction
    └── grid-layout.ts       # Grid position calculator
```

### Key Algorithm: PINF

```
normalizedWidth = baseSize × (aspectRatio ^ scaleFactor)
```

- `scaleFactor = 0` → all logos same width
- `scaleFactor = 1` → all logos same height
- `scaleFactor = 0.5` → balanced (default)

### Message Flow

```
UI (iframe)                          Plugin Sandbox
     │                                     │
     │──── load-token ────────────────────→│
     │←─── token-loaded ──────────────────│
     │                                     │
     │  [User configures & clicks Generate]│
     │                                     │
     │  [Canvas analysis: density,         │
     │   bounds, visual center]            │
     │                                     │
     │──── generate-grid ─────────────────→│
     │                                     │── createFrame("Logo Soup")
     │←─── progress(1/N) ────────────────│── createImageAsync(url)
     │←─── progress(2/N) ────────────────│── createImageAsync(url)
     │  ...                                │  ...
     │←─── complete ──────────────────────│
```

## License

MIT
