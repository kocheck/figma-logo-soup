import { describe, it, expect } from "vitest";
import { buildLogoUrl, parseDomains } from "../src/utils/url-builder";

describe("buildLogoUrl", () => {
  const token = "pk_test123";

  it("builds basic URL with defaults", () => {
    const url = buildLogoUrl({ domain: "stripe.com", token });
    expect(url).toContain("https://img.logo.dev/stripe.com");
    expect(url).toContain("token=pk_test123");
    expect(url).toContain("size=128");
    expect(url).toContain("format=png");
    expect(url).toContain("theme=light");
  });

  it("includes all custom parameters", () => {
    const url = buildLogoUrl({
      domain: "github.com",
      token,
      size: 256,
      format: "webp",
      theme: "dark",
      greyscale: true,
    });
    expect(url).toContain("size=256");
    expect(url).toContain("format=webp");
    expect(url).toContain("theme=dark");
    expect(url).toContain("greyscale=true");
  });

  it("does not include greyscale param when false", () => {
    const url = buildLogoUrl({ domain: "google.com", token, greyscale: false });
    expect(url).not.toContain("greyscale");
  });

  it("strips protocol from domain", () => {
    const url = buildLogoUrl({ domain: "https://figma.com", token });
    expect(url).toContain("img.logo.dev/figma.com");
    expect(url).not.toContain("https%3A");
  });

  it("strips trailing slashes from domain", () => {
    const url = buildLogoUrl({ domain: "apple.com///", token });
    expect(url).toContain("img.logo.dev/apple.com");
  });

  it("lowercases domain", () => {
    const url = buildLogoUrl({ domain: "GitHub.COM", token });
    expect(url).toContain("img.logo.dev/github.com");
  });

  it("clamps size to valid range (1-800)", () => {
    const urlMin = buildLogoUrl({ domain: "x.com", token, size: 0 });
    expect(urlMin).toContain("size=1");

    const urlMax = buildLogoUrl({ domain: "x.com", token, size: 9999 });
    expect(urlMax).toContain("size=800");
  });

  it("throws on empty token", () => {
    expect(() => buildLogoUrl({ domain: "x.com", token: "" })).toThrow(
      "API token is required",
    );
  });

  it("throws on empty domain", () => {
    expect(() => buildLogoUrl({ domain: "", token })).toThrow(
      "Domain is required",
    );
  });

  it("throws on domain that becomes empty after cleaning", () => {
    expect(() => buildLogoUrl({ domain: "https://", token })).toThrow(
      "Domain is empty after cleaning",
    );
  });

  it("encodes special characters in domain", () => {
    const url = buildLogoUrl({ domain: "my site.com", token });
    expect(url).toContain("my%20site.com");
  });
});

describe("parseDomains", () => {
  it("parses newline-separated domains", () => {
    expect(parseDomains("google.com\napple.com\nstripe.com")).toEqual([
      "google.com",
      "apple.com",
      "stripe.com",
    ]);
  });

  it("parses comma-separated domains", () => {
    expect(parseDomains("google.com, apple.com, stripe.com")).toEqual([
      "google.com",
      "apple.com",
      "stripe.com",
    ]);
  });

  it("handles mixed separators", () => {
    expect(parseDomains("google.com,apple.com\nstripe.com")).toEqual([
      "google.com",
      "apple.com",
      "stripe.com",
    ]);
  });

  it("trims whitespace", () => {
    expect(parseDomains("  google.com  ,  apple.com  ")).toEqual([
      "google.com",
      "apple.com",
    ]);
  });

  it("strips protocols", () => {
    expect(parseDomains("https://google.com\nhttp://apple.com")).toEqual([
      "google.com",
      "apple.com",
    ]);
  });

  it("strips trailing slashes", () => {
    expect(parseDomains("google.com///")).toEqual(["google.com"]);
  });

  it("filters empty entries", () => {
    expect(parseDomains("google.com,,\n\napple.com")).toEqual([
      "google.com",
      "apple.com",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseDomains("")).toEqual([]);
    expect(parseDomains("   ")).toEqual([]);
  });

  it("lowercases domains", () => {
    expect(parseDomains("GitHub.COM")).toEqual(["github.com"]);
  });
});
