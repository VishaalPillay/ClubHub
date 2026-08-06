# ADR-0004 — Host on one DigitalOcean droplet, not AWS

- **Status:** Accepted
- **Date:** 2026-08-05
- **Supersedes:** the implicit Mode-A AWS decision, preserved in [`AWS/`](../../AWS/README.md)
- **Context:** Pre-launch. Zero revenue, a student budget of ~₹1,000, a launch target of end of
  August 2026.

## Context

The project had a complete, synthesizable AWS CDK app (`infra/`): VPC, RDS Postgres, Fargate
behind an ALB, S3 + CloudFront, Secrets Manager, GitHub OIDC deployment. It was never deployed.

Costed to the line item it runs **~$46–52/month** (~₹4,000), of which the ALB alone is ~$18 and is
structurally unavoidable for HTTPS into Fargate. There was no fat left to cut — the design had
already eliminated the NAT gateway (~$33/mo), chosen single-AZ, and picked Graviton instances.
$200 of AWS credits buys roughly **four months**. In month five a revenue-free student project
owes ₹4,000/month indefinitely, or goes dark and takes its users' data with it.

Meanwhile the GitHub Student Developer Pack provides a **DigitalOcean credit of $13/month for 24
months** and a free `.me` domain for a year.

Free PaaS tiers were evaluated and rejected on evidence:

- **Render** — free Postgres is permanently deleted 30 days after creation; free web services
  sleep after 15 minutes with a 30–60s cold start.
- **Vercel Hobby** — its terms prohibit commercial use, and ClubHub is intended as a SaaS.
  (Cloudflare Pages permits commercial use, which is why the landing page went there.)

## Decision

Run the whole application on **one DigitalOcean droplet** (2 GB / 1 vCPU, `blr1`, $12/mo + $2.40
weekly backups — inside the monthly credit), using Docker Compose:

```
Caddy (auto-TLS)  →  web (next start)  ·  api (FastAPI)  →  db (Postgres 16)
```

- **Landing page** — extracted to `landing/`, a static `output: "export"` Next app on
  **Cloudflare Pages** at the apex domain. Unlimited bandwidth, commercial use allowed, and it
  stays up when the droplet doesn't.
- **App** at `app.<domain>`, **API** at `api.<domain>`, both on the droplet behind Caddy.
- **Media** on **Cloudflare R2** (10 GB, zero egress, free), bound to `media.<domain>`.
- **DNS** on Cloudflare, with `app` and `api` **unproxied** (grey cloud) so Caddy can complete
  ACME challenges.

## The invariant that must survive any future move

**Persisted media URLs bind to `media.<domain>` — never to a provider hostname.**

`save_media()` returns an absolute URL that is written verbatim into `users.avatar_url` and never
rewritten:

```python
# app/modules/users/service.py
user.avatar_url = storage.save_media(key, out.getvalue(), "image/webp")
```

The same column also receives `googleusercontent.com` URLs from Google sign-in
(`app/modules/auth/service.py`), so it is already a heterogeneous bag of absolute URLs with **no
rewritable common prefix**. Baking `*.r2.dev`, `*.cloudfront.net`, or `api.<domain>/media` into it
would make the storage backend a **one-way door**: changing providers would orphan every stored
avatar and require a data migration that distinguishes "our old URL" from "a Google URL" by host
matching.

Bound to a hostname we own, the backend is swappable forever with zero rows touched — moving R2 →
S3 → local disk is an `rclone copy` and a DNS change.

This rule exists because the AWS design nearly shipped the mistake: its diagram and env template
promised `media.<domain>` while the code emitted the raw CloudFront domain. See
[`AWS/KNOWN-GAPS.md` §1](../../AWS/KNOWN-GAPS.md).

## Consequences

**What gets better**

- ₹0 out of pocket for 24 months, against ~4 months of AWS runway.
- No cold starts, no database expiry, no commercial-use restriction.
- Production topology is nearly identical to `docker-compose.yml`, so local dev and prod diverge
  by configuration rather than by architecture.
- `docker compose run --rm api <cmd>` is the ops path in both — one execution model
  ([ADR-0003](./0003-execution-model.md)).

**What gets worse — stated plainly**

- **Single point of failure.** No multi-AZ, no redundancy. The box dying takes the product down.
- **Self-managed backups.** `pg_dump` to R2 nightly plus DigitalOcean weekly snapshots. Both are
  hypotheses until a restore is rehearsed.
- **Deploys have brief downtime.** `up -d --build` rebuilds in place, and `next build` is the
  heaviest thing that will ever run on the box.
- **Vertical scale only**, and a resize means a reboot.
- **We own the OS** — patching, disk headroom, TLS renewal (Caddy automates the last one).

**Mitigations:** healthchecks with `restart: unless-stopped` on every service, a 2 GB swapfile so
a build OOM degrades to a slow build rather than a kill, off-box backup replication, and UFW with
only Caddy publishing ports.

## What did not change — the actual finding

**Zero application code changed to move clouds.** The container contract, the storage interface,
and the `COOKIE_SECURE` / `CORS_ORIGINS` configuration absorbed the entire migration.

The only backend edits made alongside it were fixes to pre-existing bugs the AWS deployment would
also have hit — a missing `google-auth[requests]` extra that broke any production image, and a
spoofable rate-limit key — plus one new optional setting (`S3_ENDPOINT_URL`) to point the existing
S3 backend at R2.

That portability was not luck. It is what the AWS design bought: it forced every
environment-specific decision out of the application and into configuration. The work in
[`AWS/`](../../AWS/README.md) is why leaving AWS was cheap.

## Revisiting

Return to AWS, or scale up, when any of these fire — in this order:

1. The droplet's memory is the binding constraint → resize ($12 → $24/mo, one reboot).
2. Backup ops become the dominant risk → DigitalOcean Managed Postgres ($15/mo).
3. `docker compose up -d --build` starts causing user-visible downtime → move image builds to
   GitHub Actions + GHCR, reducing deploys to `pull` + container swap.
4. Availability requirements outgrow one box → the CDK app at tag `aws-cdk-final` still
   synthesizes, and the container contract never changed.
