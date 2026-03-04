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
  | { type: "complete" }
  | { type: "error"; message: string }
  | { type: "selection-detected"; logos: CanvasLogo[]; hasExistingGrid: boolean };
