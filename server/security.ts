import helmet from "helmet";

// Allowed browser origins for cross-origin requests. The client and server are
// served from the same origin in production, so same-origin requests (which
// carry no Origin header, or one matching the host) always work. Set
// ALLOWED_ORIGIN (comma-separated) only when the client is hosted separately.
export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function originOf(envUrl: string | undefined): string {
  try {
    return envUrl ? new URL(envUrl).origin : "";
  } catch {
    return "";
  }
}

// Content-Security-Policy directives. Allows the YouTube/Vimeo embed SDKs and
// their iframes, the Supabase API/storage, optional analytics, and websockets.
export function buildCspDirectives() {
  const supabaseHost = originOf(process.env.SUPABASE_URL);
  const analyticsHost = originOf(process.env.ANALYTICS_URL);
  return {
    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
    "default-src": ["'self'"],
    "script-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com", ...(analyticsHost ? [analyticsHost] : [])],
    "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://player.vimeo.com"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "blob:", "https:"],
    // `https:` lets the client fetch externally-hosted PDFs ("bring your own
    // storage") from any HTTPS origin via pdf.js. img-src/media-src already
    // allow https:, so this keeps connect-src consistent with them.
    "connect-src": ["'self'", "blob:", "data:", "ws:", "wss:", "https:", "https://vimeo.com", ...(supabaseHost ? [supabaseHost] : [])],
    "worker-src": ["'self'", "blob:"],
    "upgrade-insecure-requests": null,
  };
}
