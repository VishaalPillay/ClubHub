export type SocialPlatform = "github" | "linkedin" | "instagram";

const PLATFORMS: Record<
  SocialPlatform,
  { label: string; host: string; path: RegExp; example: string }
> = {
  github: {
    label: "GitHub",
    host: "github.com",
    path: /^\/[a-z\d](?:[a-z\d-]{0,38})\/?$/i,
    example: "github.com/you",
  },
  linkedin: {
    label: "LinkedIn",
    host: "linkedin.com",
    path: /^\/(in|company)\/[a-z\d][a-z\d._-]{1,99}\/?$/i,
    example: "linkedin.com/in/you",
  },
  instagram: {
    label: "Instagram",
    host: "instagram.com",
    path: /^\/[a-z\d._]{1,30}\/?$/i,
    example: "instagram.com/you",
  },
};

/**
 * Accepts a bare handle or a full URL and, only if it actually resolves to the
 * named platform's domain with a plausible profile path, returns the normalized
 * https:// URL. Anything else — a random string, a different site — is rejected
 * with a message naming the expected shape, rather than silently prepending
 * https:// onto arbitrary text (e.g. "kbdiajbdj" becoming "https://kbdiajbdj").
 */
export function normalizeSocialUrl(
  platform: SocialPlatform,
  raw: string
): { url?: string; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const cfg = PLATFORMS[platform];
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { error: `That doesn't look like a ${cfg.label} link — try ${cfg.example}` };
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== cfg.host || !cfg.path.test(parsed.pathname)) {
    return { error: `That doesn't look like a ${cfg.label} link — try ${cfg.example}` };
  }
  return { url: `https://${host}${parsed.pathname}` };
}
