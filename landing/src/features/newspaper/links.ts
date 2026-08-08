/**
 * Absolute URLs into the app, which is a different origin from this site.
 *
 * The landing page is served from the apex (https://<domain>) by Cloudflare Pages; the app
 * runs at https://app.<domain> on the droplet. Every link out of the paper therefore has to
 * be absolute — a bare `/login` would 404 against the static export.
 *
 * Inlined at build time, so Cloudflare Pages needs NEXT_PUBLIC_APP_URL set before the first
 * production build. The fallback matches `npm run dev` in frontend/ (port 3000), while this
 * site dev-serves on 3001, so both run side by side locally.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const LOGIN_URL = `${APP_URL}/login`;
export const REGISTER_URL = `${APP_URL}/register`;
