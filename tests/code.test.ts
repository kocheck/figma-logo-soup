import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFigma, storage } from "./setup";
import type { LogoAnalysis, GridConfig } from "../src/utils/types";

// Helper to trigger the onmessage handler set by code.ts
async function sendMessage(msg: unknown): Promise<void> {
  // code.ts sets figma.ui.onmessage directly
  const handler = mockFigma.ui.onmessage;
  if (!handler) throw new Error("onmessage handler not set");
  await handler(msg);
}

function makeLogo(domain: string, overrides?: Partial<LogoAnalysis>): LogoAnalysis {
  return {
    domain,
    url: `https://img.logo.dev/${domain}?token=pk_test&size=128&format=png&theme=light`,
    naturalWidth: 128,
    naturalHeight: 128,
    aspectRatio: 1,
    density: 0.5,
    contentBounds: { top: 0, right: 127, bottom: 127, left: 0, width: 128, height: 128 },
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
};

describe("Plugin Sandbox (code.ts)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    storage.clear();

    // Reset onmessage so fresh import sets it
    mockFigma.ui.onmessage = null;

    // Re-import code.ts to trigger setup
    // vi.resetModules ensures fresh module execution
    vi.resetModules();
    await import("../src/code");
  });

  describe("initialization", () => {
    it("calls figma.showUI with correct options", () => {
      expect(mockFigma.showUI).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          themeColors: true,
          width: 360,
          height: 540,
        }),
      );
    });

    it("sets figma.ui.onmessage handler", () => {
      expect(mockFigma.ui.onmessage).toBeTypeOf("function");
    });
  });

  describe("load-token", () => {
    it("sends null when no token stored", async () => {
      await sendMessage({ type: "load-token" });
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith({
        type: "token-loaded",
        token: null,
      });
    });

    it("sends stored token", async () => {
      storage.set("logo-soup-api-token", "pk_saved123");
      await sendMessage({ type: "load-token" });
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith({
        type: "token-loaded",
        token: "pk_saved123",
      });
    });
  });

  describe("save-token", () => {
    it("persists token to clientStorage", async () => {
      await sendMessage({ type: "save-token", token: "pk_new456" });
      expect(mockFigma.clientStorage.setAsync).toHaveBeenCalledWith(
        "logo-soup-api-token",
        "pk_new456",
      );
      expect(storage.get("logo-soup-api-token")).toBe("pk_new456");
    });
  });

  describe("generate-grid", () => {
    it("sends error for empty logos array", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [],
      });
      expect(mockFigma.ui.postMessage).toHaveBeenCalledWith({
        type: "error",
        message: "No logos to generate",
      });
    });

    it("creates a frame named 'Logo Soup'", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("stripe.com")],
      });

      expect(mockFigma.createFrame).toHaveBeenCalled();
      // The first createFrame call is the parent "Logo Soup" frame
      const frameResult = mockFigma.createFrame.mock.results[0].value;
      expect(frameResult.name).toBe("Logo Soup");
    });

    it("sets auto-layout wrap on parent frame", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("stripe.com")],
      });

      const frame = mockFigma.createFrame.mock.results[0].value;
      expect(frame.layoutMode).toBe("HORIZONTAL");
      expect(frame.layoutWrap).toBe("WRAP");
    });

    it("sends progress messages for each logo", async () => {
      const logos = [makeLogo("stripe.com"), makeLogo("github.com")];
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos,
      });

      const progressCalls = mockFigma.ui.postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === "progress",
      );
      expect(progressCalls).toHaveLength(2);
      expect(progressCalls[0][0]).toEqual({
        type: "progress",
        current: 1,
        total: 2,
        domain: "stripe.com",
      });
      expect(progressCalls[1][0]).toEqual({
        type: "progress",
        current: 2,
        total: 2,
        domain: "github.com",
      });
    });

    it("sends complete message after all logos", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("stripe.com")],
      });

      const lastCall = mockFigma.ui.postMessage.mock.calls.at(-2); // -2 because notify also calls
      // Actually let's just check complete was sent
      const completeCalls = mockFigma.ui.postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === "complete",
      );
      expect(completeCalls).toHaveLength(1);
    });

    it("calls figma.createImageAsync for each logo", async () => {
      const logos = [makeLogo("stripe.com"), makeLogo("github.com")];
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos,
      });

      expect(mockFigma.createImageAsync).toHaveBeenCalledTimes(2);
      expect(mockFigma.createImageAsync).toHaveBeenCalledWith(logos[0].url);
      expect(mockFigma.createImageAsync).toHaveBeenCalledWith(logos[1].url);
    });

    it("names each logo node with its domain", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("stripe.com")],
      });

      // Second createFrame call is the logo container
      const logoFrame = mockFigma.createFrame.mock.results[1].value;
      expect(logoFrame.name).toBe("stripe.com");
    });

    it("creates placeholder on image fetch failure", async () => {
      mockFigma.createImageAsync.mockRejectedValueOnce(new Error("Network error"));

      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("bad-domain.xyz")],
      });

      // Should still complete without throwing
      const completeCalls = mockFigma.ui.postMessage.mock.calls.filter(
        (call: unknown[]) => (call[0] as { type: string }).type === "complete",
      );
      expect(completeCalls).toHaveLength(1);

      // Placeholder frame should be created
      // Frame 0 = parent, Frame 1 = createLogoNode container (created before error),
      // Frame 2 = placeholder container from createPlaceholderNode
      const frameResults = mockFigma.createFrame.mock.results;
      const placeholderFrame = frameResults.find(
        (r: { value: { name: string } }) => r.value.name.includes("(failed)"),
      );
      expect(placeholderFrame).toBeDefined();
      expect(placeholderFrame!.value.name).toBe("bad-domain.xyz (failed)");
    });

    it("sets selection to the generated frame", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("stripe.com")],
      });

      expect(mockFigma.viewport.scrollAndZoomIntoView).toHaveBeenCalled();
    });

    it("calls figma.notify on completion", async () => {
      await sendMessage({
        type: "generate-grid",
        config: defaultConfig,
        logos: [makeLogo("a.com"), makeLogo("b.com")],
      });

      expect(mockFigma.notify).toHaveBeenCalledWith(
        "Logo Soup: 2 logos generated",
      );
    });

    it("applies gap from config to frame spacing", async () => {
      const config = { ...defaultConfig, gap: 24 };
      await sendMessage({
        type: "generate-grid",
        config,
        logos: [makeLogo("a.com")],
      });

      const frame = mockFigma.createFrame.mock.results[0].value;
      expect(frame.itemSpacing).toBe(24);
      expect(frame.counterAxisSpacing).toBe(24);
    });
  });
});
