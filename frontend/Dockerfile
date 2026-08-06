# Multi-stage build for the Next.js app.
#
# The runtime stage carries only `.next/standalone` (a self-contained server.js plus the
# node_modules actually reached), `.next/static`, and `public/` — no source, no dev deps,
# no full node_modules tree. That matters on a 2 GB droplet where this image is rebuilt in
# place while the site is serving.

# ─── deps ────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder ─────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time, not read at runtime.
# They must therefore arrive as build args — setting them in the container environment
# later has no effect, which is the single most common deployment surprise here.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_LANDING_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_LANDING_URL=$NEXT_PUBLIC_LANDING_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── runner ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # standalone server.js binds 127.0.0.1 by default, which is unreachable from Caddy
    # in another container. Bind all interfaces; the port is never published to the host.
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
