import type { GridItem } from "./types";

export interface GridLayoutOptions {
  columns: number;
  gap: number;
}

export interface SizedItem {
  width: number;
  height: number;
}

/**
 * Calculate grid positions for a list of sized items.
 * Items flow left-to-right, wrapping at the specified column count.
 * Each row's height is determined by the tallest item in that row.
 *
 * Returns positions (x, y) and final dimensions for each item.
 */
export function calculateGridLayout(
  items: SizedItem[],
  options: GridLayoutOptions,
): GridItem[] {
  const { columns, gap } = options;

  if (items.length === 0) return [];
  if (columns <= 0) return items.map((item) => ({ x: 0, y: 0, width: item.width, height: item.height }));

  const result: GridItem[] = [];
  let currentY = 0;

  for (let rowStart = 0; rowStart < items.length; rowStart += columns) {
    const rowItems = items.slice(rowStart, rowStart + columns);

    // Row height = tallest item in this row
    const rowHeight = Math.max(...rowItems.map((item) => item.height));

    let currentX = 0;
    for (let col = 0; col < rowItems.length; col++) {
      const item = rowItems[col];

      // Center the item vertically within the row
      const yOffset = (rowHeight - item.height) / 2;

      result.push({
        x: currentX,
        y: currentY + yOffset,
        width: item.width,
        height: item.height,
      });

      currentX += item.width + gap;
    }

    currentY += rowHeight + gap;
  }

  return result;
}

/**
 * Calculate the total bounding box of a grid layout.
 */
export function calculateGridBounds(
  gridItems: GridItem[],
): { width: number; height: number } {
  if (gridItems.length === 0) return { width: 0, height: 0 };

  let maxRight = 0;
  let maxBottom = 0;

  for (const item of gridItems) {
    const right = item.x + item.width;
    const bottom = item.y + item.height;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  return { width: maxRight, height: maxBottom };
}
