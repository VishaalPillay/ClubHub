/**
 * Absolute URL of the marketing site, which is a different origin from this app.
 *
 * The landing page lives at the apex (https://<domain>) on Cloudflare Pages; this app is
 * served from https://app.<domain>. So "go home" links out of the app have to be absolute —
 * a bare `/` would land on the app's own root, which now just redirects back to /portal.
 *
 * Inlined at build time like every NEXT_PUBLIC_* value, so changing it needs a rebuild of the
 * `web` image, not a container restart. The fallback matches `npm run dev` in landing/ (3001).
 */
export const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3001";
