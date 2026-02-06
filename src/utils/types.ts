// Shared types — expanded in Phase 2

export interface NormalizeOptions {
  baseSize: number;
  scaleFactor: number;
  densityAware: boolean;
  densityFactor: number;
}

export interface GridConfig {
  columns: number;
  baseSize: number;
  gap: number;
  theme: "auto" | "light" | "dark";
  greyscale: boolean;
  format: "png" | "jpg" | "webp";
  scaleFactor: number;
  densityAware: boolean;
  densityFactor: number;
}

export interface ContentBounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface VisualCenter {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

export interface LogoAnalysis {
  domain: string;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
  aspectRatio: number;
  density: number;
  contentBounds: ContentBounds;
  visualCenter: VisualCenter;
  normalizedWidth: number;
  normalizedHeight: number;
}

export interface GridItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Message protocol: UI → Plugin
export type UIMessage =
  | { type: "generate-grid"; config: GridConfig; logos: LogoAnalysis[] }
  | { type: "save-token"; token: string }
  | { type: "load-token" };

// Message protocol: Plugin → UI
export type PluginMessage =
  | { type: "token-loaded"; token: string | null }
  | { type: "progress"; current: number; total: number; domain: string }
  | { type: "complete" }
  | { type: "error"; message: string };
