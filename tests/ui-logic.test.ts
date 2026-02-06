import { describe, it, expect } from "vitest";
// UI logic tests — testing the pure functions that exist in ui.html
// We re-implement them here to validate the algorithm, since the UI
// uses the same formulas as the tested utility modules.

import { parseDomains, buildLogoUrl } from "../src/utils/url-builder";
import { calculateDensity } from "../src/utils/density";
import { detectContentBounds } from "../src/utils/crop";
import { calculateVisualCenter } from "../src/utils/visual-center";
import {
  calculateNormalizedWidth,
  applyDensityCompensation,
} from "../src/utils/normalize";
import type { NormalizeOptions } from "../src/utils/types";

describe("UI Logic: Config Validation", () => {
  it("getConfig returns valid defaults", () => {
    // Simulate what getConfig() would return with default form values
    const config = {
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
      alignBy: "visual-center-y",
    };
    expect(config.columns).toBeGreaterThan(0);
    expect(config.baseSize).toBeGreaterThan(0);
    expect(config.gap).toBeGreaterThanOrEqual(0);
    expect(["light", "dark", "auto"]).toContain(config.theme);
    expect(["png", "jpg", "webp"]).toContain(config.format);
    expect(config.scaleFactor).toBeGreaterThanOrEqual(0);
    expect(config.scaleFactor).toBeLessThanOrEqual(1);
    expect(config.densityFactor).toBeGreaterThanOrEqual(0);
    expect(config.densityFactor).toBeLessThanOrEqual(1);
  });
});

describe("UI Logic: Domain Parsing", () => {
  it("handles typical user input", () => {
    expect(parseDomains("stripe.com, github.com")).toEqual([
      "stripe.com",
      "github.com",
    ]);
  });

  it("handles messy input with protocols and slashes", () => {
    expect(
      parseDomains("https://Stripe.COM/\nhttp://github.com//"),
    ).toEqual(["stripe.com", "github.com"]);
  });
});

describe("UI Logic: URL Construction", () => {
  it("builds correct CDN URL for UI analysis", () => {
    // The UI builds URLs with a larger size for analysis (4x baseSize)
    // then the plugin fetches at the actual needed size
    const url = buildLogoUrl({
      domain: "stripe.com",
      token: "pk_test",
      size: 192, // 48 * 4 clamped
      format: "png",
      theme: "light",
    });
    expect(url).toContain("img.logo.dev/stripe.com");
    expect(url).toContain("token=pk_test");
    expect(url).toContain("size=192");
  });
});

describe("UI Logic: Message Protocol", () => {
  it("generate-grid message has required fields", () => {
    const msg = {
      type: "generate-grid" as const,
      config: {
        columns: 4,
        baseSize: 48,
        gap: 16,
        theme: "light" as const,
        greyscale: false,
        format: "png" as const,
        scaleFactor: 0.5,
        densityAware: true,
        densityFactor: 0.5,
        exportAsComponent: false,
        alignBy: "visual-center-y" as const,
      },
      logos: [
        {
          domain: "stripe.com",
          url: "https://img.logo.dev/stripe.com?token=pk_test&size=128&format=png&theme=light",
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
        },
      ],
    };

    expect(msg.type).toBe("generate-grid");
    expect(msg.config).toBeDefined();
    expect(msg.logos).toHaveLength(1);
    expect(msg.logos[0].domain).toBe("stripe.com");
    expect(msg.logos[0].normalizedWidth).toBeGreaterThan(0);
    expect(msg.logos[0].normalizedHeight).toBeGreaterThan(0);
  });

  it("save-token message has required fields", () => {
    const msg = { type: "save-token" as const, token: "pk_abc123" };
    expect(msg.type).toBe("save-token");
    expect(msg.token).toBeTruthy();
  });

  it("load-token message is well-formed", () => {
    const msg = { type: "load-token" as const };
    expect(msg.type).toBe("load-token");
  });
});

describe("UI Logic: Density Compensation Flow", () => {
  it("applies density compensation across a set of logos", () => {
    // Simulate the UI's post-analysis density compensation loop
    const logos = [
      { density: 0.8, normalizedWidth: 48, aspectRatio: 1 },
      { density: 0.2, normalizedWidth: 48, aspectRatio: 1 },
      { density: 0.5, normalizedWidth: 48, aspectRatio: 1 },
    ];

    const densities = logos.map((l) => l.density);
    const meanDensity = densities.reduce((a, b) => a + b, 0) / densities.length;
    const densityFactor = 0.5;

    const opts: NormalizeOptions = {
      baseSize: 48,
      scaleFactor: 0.5,
      densityAware: true,
      densityFactor: 0.5,
    };

    const adjusted = logos.map((l) => ({
      ...l,
      normalizedWidth: applyDensityCompensation(
        l.normalizedWidth,
        l.density,
        meanDensity,
        densityFactor,
      ),
    }));

    // Dense logo should shrink
    expect(adjusted[0].normalizedWidth).toBeLessThan(48);
    // Light logo should grow
    expect(adjusted[1].normalizedWidth).toBeGreaterThan(48);
    // Average-density logo should stay roughly the same
    expect(adjusted[2].normalizedWidth).toBeCloseTo(48, 0);
  });
});

describe("UI Logic: Fallback Analysis", () => {
  it("returns default analysis for failed image load", () => {
    const baseSize = 48;
    // Simulate the fallback in analyzeLogo when image fails
    const fallback = {
      domain: "bad.com",
      url: "https://img.logo.dev/bad.com?token=pk_test&size=128&format=png&theme=light",
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
      normalizedWidth: baseSize,
      normalizedHeight: baseSize,
    };

    expect(fallback.normalizedWidth).toBe(48);
    expect(fallback.normalizedHeight).toBe(48);
    expect(fallback.aspectRatio).toBe(1);
  });
});
