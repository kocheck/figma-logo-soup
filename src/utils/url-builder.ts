export interface LogoUrlOptions {
  domain: string;
  token: string;
  size?: number;
  format?: "png" | "jpg" | "webp";
  greyscale?: boolean;
  theme?: "auto" | "light" | "dark";
}

/**
 * Build a Logo.dev CDN URL for fetching a logo image.
 *
 * Format: https://img.logo.dev/{domain}?token={pk_...}&size={int}&format={str}&theme={str}&greyscale={bool}
 */
export function buildLogoUrl(options: LogoUrlOptions): string {
  const { domain, token, size = 128, format = "png", greyscale = false, theme = "light" } = options;

  if (!token) {
    throw new Error("API token is required. Get one at https://logo.dev");
  }

  if (!domain) {
    throw new Error("Domain is required");
  }

  // Clean the domain — strip protocol and trailing slashes
  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .trim()
    .toLowerCase();

  if (!cleanDomain) {
    throw new Error("Domain is empty after cleaning");
  }

  const params = new URLSearchParams({
    token,
    size: String(Math.min(Math.max(size, 1), 800)),
    format,
    theme,
  });

  if (greyscale) {
    params.set("greyscale", "true");
  }

  return `https://img.logo.dev/${encodeURIComponent(cleanDomain)}?${params.toString()}`;
}

/**
 * Parse a list of domains from user input (newline or comma separated).
 */
export function parseDomains(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, ""))
    .filter((d) => d.length > 0);
}
