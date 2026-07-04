/**
 * In-memory access-token store (ADR-0002).
 *
 * The access token deliberately never touches localStorage — it lives in module state
 * and dies with the tab. Sessions survive reloads via the httpOnly refresh cookie:
 * on boot the AuthProvider calls /auth/refresh to mint a fresh access token.
 */

let accessToken: string | null = null;

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string | null): void => {
    accessToken = token;
  },
  clear: (): void => {
    accessToken = null;
  },
};
