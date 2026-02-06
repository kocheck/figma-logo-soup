import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma, storage } from "./setup";
import type { LogoAnalysis, GridConfig } from "../src/utils/types";
import {
  calculateNormalizedWidth,
  calculateNormalizedHeight,
  applyDensityCompensation,
  calculateMeanDensity,
} from "../src/utils/normalize";
import { calculateGridLayout, calculateGridBounds } from "../src/utils/grid-layout";
import { buildLogoUrl, parseDomains } from "../src/utils/url-builder";
import { calculateDensity } from "../src/utils/density";
import { detectContentBounds } from "../src/utils/crop";
import { calculateVisualCenter } from "../src/utils/visual-center";

// Helper to trigger the onmessage handler
async function sendMessage(msg: unknown): Promise<void> {
  const handler = mockFigma.ui.onmessage;
  if (!handler) throw new Error("onmessage handler not set");
  await handler(msg);
}

function makeLogo(
  domain: string,
  overrides?: Partial<LogoAnalysis>,
): LogoAnalysis {
  return {
    domain,
    url: `https://img.logo.dev/${domain}?token=pk_test&size=128&format=png&theme=light`,
    naturalWidth: 128,
    naturalHeight: 128,
    aspectRatio: 1,
    density: 0.5,
    contentBounds: {
      top: 0,
      right: 127,
      bottom: 127,
      left: 0,
      width: 128,
      height: 128,
    },
    visualCenter: { x: 64, y: 64, offsetX: 0, offsetY: 0 },
    normalizedWidth: 48,
    normalizedHeight: 48,
    ...overrides,
  };
}

const defaultConfig: GridConfig = {
  columns: 4,
  baseSize: 48,
  gap: 16,
  theme: "light",
  greyscale: false,
  format: "png",
  scaleFactor: 0.5,
  densityAware: true,
  densityFactor: 0.5,
  exportAsComponent: false,
  alignBy: "bounds",
};

describe("Integration: Full Pipeline", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();
    mockFigma.ui.onmessage = null;
    vi.resetModules();
    await import("../src/code");
  });

  it("token save → load round-trip", async () => {
    await sendMessage({ type: "save-token", token: "pk_round_trip" });
    await sendMessage({ type: "load-token" });

    const calls = mockFigma.ui.postMessage.mock.calls;
    const tokenMsg = calls.find(
      (c: unknown[]) => (c[0] as { type: string }).type === "token-loaded",
    );
    expect(tokenMsg).toBeDefined();
    expect(tokenMsg![0]).toEqual({
      type: "token-loaded",
      token: "pk_round_trip",
    });
  });

  it("full generate flow: domains → normalized logos → Figma frame", async () => {
    // Simulate what the UI would do:
    // 1. Parse domains
    const domains = parseDomains("stripe.com, github.com, figma.com");
    expect(domains).toHaveLength(3);

    // 2. Build URLs
    const token = "pk_test";
    const urls = domains.map((d) =>
      buildLogoUrl({ domain: d, token, size: 128, format: "png", theme: "light" }),
    );
    expect(urls[0]).toContain("stripe.com");

    // 3. Analyze (simulated — different aspect ratios)
    const logos: LogoAnalysis[] = [
      makeLogo("stripe.com", { aspectRatio: 2.5, density: 0.6 }),
      makeLogo("github.com", { aspectRatio: 1, density: 0.8 }),
      makeLogo("figma.com", { aspectRatio: 0.8, density: 0.3 }),
    ];

    // 4. Apply PINF normalization
    const opts = {
      baseSize: defaultConfig.baseSize,
      scaleFactor: defaultConfig.scaleFactor,
      densityAware: defaultConfig.densityAware,
      densityFactor: defaultConfig.densityFactor,
    };

    for (const logo of logos) {
      logo.normalizedWidth = calculateNormalizedWidth(logo.aspectRatio, opts);
      logo.normalizedHeight = calculateNormalizedHeight(logo.aspectRatio, opts);
    }

    // Wide logo should be wider than square
    expect(logos[0].normalizedWidth).toBeGreaterThan(logos[1].normalizedWidth);

    // 5. Apply density compensation
    const meanDensity = calculateMeanDensity(logos.map((l) => l.density));
    for (const logo of logos) {
      logo.normalizedWidth = applyDensityCompensation(
        logo.normalizedWidth,
        logo.density,
        meanDensity,
        opts.densityFactor,
      );
      logo.normalizedHeight = logo.normalizedWidth / logo.aspectRatio;
    }

    // 6. Calculate grid layout
    const gridItems = calculateGridLayout(
      logos.map((l) => ({
        width: l.normalizedWidth,
        height: l.normalizedHeight,
      })),
      { columns: defaultConfig.columns, gap: defaultConfig.gap },
    );
    expect(gridItems).toHaveLength(3);
    const bounds = calculateGridBounds(gridItems);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);

    // 7. Send to plugin for Figma generation
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos,
    });

    // Verify frame was created
    expect(mockFigma.createFrame).toHaveBeenCalled();
    // Verify images were fetched
    expect(mockFigma.createImageAsync).toHaveBeenCalledTimes(3);
    // Verify complete message was sent
    const completeCalls = mockFigma.ui.postMessage.mock.calls.filter(
      (c: unknown[]) => (c[0] as { type: string }).type === "complete",
    );
    expect(completeCalls).toHaveLength(1);
  });

  it("handles 0 logos gracefully", async () => {
    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos: [],
    });

    const errorCalls = mockFigma.ui.postMessage.mock.calls.filter(
      (c: unknown[]) => (c[0] as { type: string }).type === "error",
    );
    expect(errorCalls).toHaveLength(1);
    expect(errorCalls[0][0].message).toBe("No logos to generate");
  });

  it("handles large batch (20 logos)", async () => {
    const logos = Array.from({ length: 20 }, (_, i) =>
      makeLogo(`company${i}.com`),
    );

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos,
    });

    expect(mockFigma.createImageAsync).toHaveBeenCalledTimes(20);
    const progressCalls = mockFigma.ui.postMessage.mock.calls.filter(
      (c: unknown[]) => (c[0] as { type: string }).type === "progress",
    );
    expect(progressCalls).toHaveLength(20);
  });

  it("handles mix of successful and failed image fetches", async () => {
    // First call succeeds, second fails, third succeeds
    mockFigma.createImageAsync
      .mockResolvedValueOnce({ hash: "hash1" })
      .mockRejectedValueOnce(new Error("404"))
      .mockResolvedValueOnce({ hash: "hash3" });

    const logos = [
      makeLogo("good1.com"),
      makeLogo("bad.com"),
      makeLogo("good2.com"),
    ];

    await sendMessage({
      type: "generate-grid",
      config: defaultConfig,
      logos,
    });

    // Should still complete
    const completeCalls = mockFigma.ui.postMessage.mock.calls.filter(
      (c: unknown[]) => (c[0] as { type: string }).type === "complete",
    );
    expect(completeCalls).toHaveLength(1);

    // Should have a placeholder for the failed one
    const frameResults = mockFigma.createFrame.mock.results;
    const failedFrame = frameResults.find(
      (r: { value: { name: string } }) => r.value.name.includes("(failed)"),
    );
    expect(failedFrame).toBeDefined();
  });
});

describe("Integration: Normalization Pipeline", () => {
  it("PINF + density produces visually balanced sizes", () => {
    // Simulate 3 logos with very different characteristics
    const logos = [
      { ar: 3.0, density: 0.3 }, // wide, light (e.g., wordmark)
      { ar: 1.0, density: 0.9 }, // square, dense (e.g., app icon)
      { ar: 0.7, density: 0.5 }, // tall, medium (e.g., portrait logo)
    ];

    const opts = {
      baseSize: 48,
      scaleFactor: 0.5,
      densityAware: true,
      densityFactor: 0.5,
    };

    // Step 1: PINF normalization
    const normalized = logos.map((l) => ({
      ...l,
      width: calculateNormalizedWidth(l.ar, opts),
      height: calculateNormalizedHeight(l.ar, opts),
    }));

    // Step 2: Density compensation
    const meanDensity = calculateMeanDensity(logos.map((l) => l.density));

    const final = normalized.map((l) => ({
      ...l,
      finalWidth: applyDensityCompensation(
        l.width,
        l.density,
        meanDensity,
        opts.densityFactor,
      ),
    }));

    // Light wide logo: wider after PINF, then scaled UP by density (light)
    // Dense square logo: baseSize after PINF, then scaled DOWN by density (dense)
    expect(final[0].finalWidth).toBeGreaterThan(final[1].finalWidth);

    // All sizes should be positive and reasonable
    for (const f of final) {
      expect(f.finalWidth).toBeGreaterThan(0);
      expect(f.finalWidth).toBeLessThan(500);
    }
  });

  it("grid layout produces non-overlapping items", () => {
    const items = [
      { width: 80, height: 30 },
      { width: 48, height: 48 },
      { width: 60, height: 40 },
      { width: 45, height: 55 },
      { width: 70, height: 35 },
    ];

    const layout = calculateGridLayout(items, { columns: 3, gap: 16 });

    // Check no overlapping rectangles
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i];
        const b = layout[j];
        const overlaps =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(overlaps).toBe(false);
      }
    }
  });
});

describe("Integration: URL + Config", () => {
  it("all supported format/theme combinations produce valid URLs", () => {
    const formats = ["png", "jpg", "webp"] as const;
    const themes = ["light", "dark", "auto"] as const;

    for (const format of formats) {
      for (const theme of themes) {
        const url = buildLogoUrl({
          domain: "test.com",
          token: "pk_test",
          format,
          theme,
        });
        expect(url).toContain("img.logo.dev");
        expect(url).toContain(`format=${format}`);
        expect(url).toContain(`theme=${theme}`);
      }
    }
  });

  it("greyscale URL includes greyscale param", () => {
    const url = buildLogoUrl({
      domain: "test.com",
      token: "pk_test",
      greyscale: true,
    });
    expect(url).toContain("greyscale=true");
  });
});
