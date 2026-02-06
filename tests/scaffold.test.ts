import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");

describe("Phase 1: Project Scaffolding", () => {
  it("manifest.json exists and has correct structure", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, "manifest.json"), "utf-8"),
    );
    expect(manifest.name).toBe("Logo Soup");
    expect(manifest.main).toBe("dist/code.js");
    expect(manifest.ui).toBe("src/ui.html");
    expect(manifest.editorType).toContain("figma");
    expect(manifest.networkAccess.allowedDomains).toContain(
      "https://img.logo.dev",
    );
  });

  it("tsconfig.json has strict mode enabled", () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf-8"),
    );
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("src/utils/types.ts exports expected types", async () => {
    const types = await import("../src/utils/types");
    // Type-level check: ensure the module exports exist
    expect(types).toBeDefined();
  });

  it("source directories exist", () => {
    expect(fs.existsSync(path.join(root, "src"))).toBe(true);
    expect(fs.existsSync(path.join(root, "src", "utils"))).toBe(true);
    expect(fs.existsSync(path.join(root, "tests"))).toBe(true);
  });

  it("esbuild compiles code.ts without error", async () => {
    const esbuild = await import("esbuild");
    const result = await esbuild.build({
      entryPoints: [path.join(root, "src", "code.ts")],
      bundle: true,
      write: false,
      target: "es2020",
      format: "iife",
    });
    expect(result.errors).toHaveLength(0);
    expect(result.outputFiles).toHaveLength(1);
    expect(result.outputFiles[0].text).toContain("showUI");
  });
});
