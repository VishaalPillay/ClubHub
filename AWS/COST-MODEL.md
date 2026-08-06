# Cost Model — why the AWS design was deferred

The architecture was sound. This document is why it did not ship.

All figures are `ap-south-1` (Mumbai) list prices at design time, for a **single** always-on
environment with no staging. USD, with ₹ at ~84/USD.

---

## Mode A — monthly run rate

| Line item | Configuration | USD/mo | Note |
|---|---|---:|---|
| **Application Load Balancer** | 1 ALB + minimal LCU | **~18** | The largest line, and structurally unavoidable |
| **RDS PostgreSQL** | `db.t4g.micro`, 20 GB gp3, single-AZ | ~15 | ~13 instance + ~2 storage |
| **ECS Fargate** | 256 CPU / 512 MiB, 1 task, 24×7 | ~9 | ~730 vCPU-hrs + GB-hrs |
| **RDS backups** | 7-day retention | ~1 | Free up to the instance's storage size |
| **Secrets Manager** | 2 secrets | ~0.80 | $0.40 each |
| **CloudWatch Logs** | 1-month retention, low volume | ~1 | |
| **S3 + CloudFront** | Avatars, low traffic | ~1 | Comfortably inside CloudFront's free tier at this scale |
| **Route 53** | 1 hosted zone | ~0.50 | |
| **ECR** | One image, a few versions | ~0.50 | |
| **Amplify Hosting** | Next.js SSR | ~0–3 | Free tier covers a low-traffic launch |
| **NAT Gateway** | — | **0** | Designed out — see below |
| | **Total** | **~$46–52** | **≈ ₹3,900–4,400 / month** |

### The ALB is the problem

At ~$18/month the load balancer costs **twice the compute it fronts**. It is also not optional:
`ApplicationLoadBalancedFargateService` needs it for TLS termination, and a Fargate task cannot
sensibly hold an ACM certificate itself. Every "make AWS cheaper" path runs into it.

The alternatives all trade the ALB for a different problem: API Gateway HTTP API (cheaper at low
volume, but a rewrite of the ingress model), CloudFront → Fargate directly (loses health checks
and rolling deploys), or App Runner (simpler, but ~$25/month minimum and less control).

### What was already optimised

The design was not naive about cost. Before it was rejected it had already removed:

| Decision | Saved |
|---|---|
| `natGateways: 0` — Fargate public-with-public-IP, SG-locked to the ALB | **~$33/mo** |
| Single-AZ RDS instead of Multi-AZ | ~$15/mo |
| `t4g` Graviton over `t3` | ~10% on the instance |
| CloudFront on its default domain, no custom cert | Avoided a us-east-1 cert dependency |
| 1-month log retention, `RemovalPolicy.DESTROY` on the log group | Prevented unbounded log spend |
| A `$40/mo` budget alarm at 80% actual | Made overruns visible, not discovered |

**There was no fat left to cut.** ~$46/month was the honest floor for this architecture.

---

## The credits cliff

AWS credits: **$200**. At ~$48/month that is **~4 months** of runway.

That is the whole problem. Not that AWS is expensive in absolute terms — ₹4,000/month is
unremarkable for a funded product — but that in month five, a student project with **zero
revenue** and a **total budget of ~₹1,000** owes ₹4,000/month, indefinitely, or it goes dark and
takes its users' data with it.

A deployment you cannot afford to keep running is not a deployment. It is a demo with a timer.

---

## The comparison that ended it

The GitHub Student Developer Pack provides a **DigitalOcean credit of $13/month for 24 months**
and a **free domain for a year**. That reframes the question entirely: it is not "which cloud is
cheapest" but "what runway does each option actually buy".

| | AWS Mode A | One droplet |
|---|---|---|
| Monthly cost | ~$48 | **$14.40** ($12 droplet + $2.40 weekly backups) |
| Out of pocket | $48/mo after month 4 | **$0 for 24 months** (credit-covered) |
| Runway | ~4 months | **24 months** |
| Cold starts | None | None |
| Database | Managed, 20 GB, automated backups | Self-managed in Compose, `pg_dump` cron to R2 |
| Media | S3 + CloudFront | Cloudflare R2 (10 GB, zero egress, free) |
| Landing page | Amplify | Cloudflare Pages (unlimited bandwidth, free) |
| Availability | Single-AZ, ALB survives task loss | **Single box — it is the SPOF** |
| Scaling | Change two numbers, redeploy | Resize the droplet (reboot) |
| Ops burden | Low | **You own backups, patching, TLS renewal** |

### Why not a free PaaS instead?

Both were evaluated and rejected on evidence, not preference:

- **Render free tier** — free Postgres is **permanently deleted 30 days after creation**, and
  free web services sleep after 15 minutes with a 30–60s cold start. That is not a production
  database and not a production front door.
- **Vercel Hobby** — terms prohibit commercial use, and ClubHub is intended as a SaaS. Cloudflare
  Pages permits commercial use on its free tier, which is why the *landing page* went there.

The droplet wins because $13/month of credit buys a real always-on machine, and a real machine
has no asterisks.

---

## What was given up

Stated plainly, because these are real:

- **No multi-AZ, no redundancy.** The droplet is a single point of failure. An AZ outage or a
  bad kernel takes the whole product down.
- **No managed backups.** `pg_dump` to Cloudflare R2 on a cron, plus DigitalOcean's weekly
  droplet snapshots. Both must be *rehearsed*, or they are hypotheses.
- **No horizontal scale.** Vertical only, and a resize means a reboot.
- **Deploys have brief downtime.** `docker compose up -d --build` rebuilds in place.
- **You own the box.** OS patching, TLS renewal (Caddy automates it), disk headroom.

Every one of these is a documented, deliberate trade rather than an oversight — recorded in
[ADR-0004](../docs/adr/0004-hosting-platform.md).

## The exits, in order

Should traffic justify the spend, the escape hatches are cheap and known:

1. **Resize the droplet** — $12 → $24/mo, one reboot. Covers a lot of growth.
2. **Move Postgres to managed** — DigitalOcean Managed Postgres at $15/mo removes the backup
   burden and the largest single operational risk. Do this first, not last.
3. **Split web and API onto separate droplets** — removes the noisy-neighbour problem during
   `next build`.
4. **Return to this folder.** The CDK app at tag `aws-cdk-final` still synthesizes. The container
   contract never changed, so coming back is a `cdk deploy` and a DNS cutover, not a rewrite.

That last point is the reason this design was worth building even unbuilt: it forced every
environment-specific decision out of the application and into configuration, which is precisely
what made the app portable enough to leave.
