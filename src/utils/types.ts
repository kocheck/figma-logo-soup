// Shared types — expanded in Phase 2

export interface NormalizeOptions {
  baseSize: number;
  scaleFactor: number;
}

export type AlignBy = "bounds" | "visual-center-x" | "visual-center-y" | "visual-center-xy";

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
  exportAsComponent: boolean;
  alignBy: AlignBy;
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
  imageHash?: string;  // pre-fetched hash for canvas-sourced logos
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
  | { type: "generate-grid"; config: GridConfig; logos: LogoAnalysis[]; appendToExisting?: boolean; canvasLogos?: CanvasLogo[] }
  | { type: "save-token"; token: string }
  | { type: "load-token" };

// Message protocol: Plugin → UI
export type PluginMessage =
  | { type: "token-loaded"; token: string | null }
  | { type: "progress"; current: number; total: number; domain: string }
  | { type: "complete" }
  | { type: "error"; message: string }
  | { type: "selection-detected"; logos: CanvasLogo[]; hasExistingGrid: boolean };
