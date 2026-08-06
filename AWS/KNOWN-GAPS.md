# Known Gaps — what the AWS design got wrong

Every architecture document describes the system as intended. This one describes where the
intent and the code disagreed, and what each gap cost.

These were found by auditing the CDK app against its own documentation during the migration off
AWS. Two of them turned out to matter for the stack that actually shipped.

---

## 1. `media.<domain>` was promised but never wired ⚠ *shaped the new design*

**The claim.** The architecture diagram shows a `media.<domain>` CloudFront alias. `.env.example`
documented `S3_PUBLIC_BASE_URL=https://media.<domain>`.

**The code.** `lib/media.ts` sets no `domainNames` and creates no certificate, and `lib/api.ts`
sets the environment variable to the *raw distribution domain*:

```ts
S3_PUBLIC_BASE_URL: `https://${props.mediaDistribution.distributionDomainName}`,
//                            -> https://d111111abcdef8.cloudfront.net
```

**Root cause.** A CloudFront alias requires an ACM certificate in **us-east-1**, while the stack
is single-region `ap-south-1`. Supporting it needs either `crossRegionReferences` or a dedicated
us-east-1 certificate sub-stack — perhaps 15 lines, but a genuine architectural wrinkle.

Notably, the *code was honest about it*. `media.ts` says so in its own doc comment:

> `S3_PUBLIC_BASE_URL` for the API = `https://<distribution domain>`. To use `media.<domain>`
> instead, add `domainNames` + an ACM cert (in us-east-1) here later.

The **diagram and the env template drifted ahead of the implementation**, which is the more
common and more dangerous direction: the artifacts a reviewer trusts described a system that did
not exist.

### Why this one mattered

Left unnoticed, it was a latent **one-way door**. `save_media()` returns an absolute URL that is
persisted verbatim into `users.avatar_url` and never rewritten:

```python
user.avatar_url = storage.save_media(key, out.getvalue(), "image/webp")
```

Worse, the same column also receives `googleusercontent.com` URLs from Google sign-in, so it is
already a heterogeneous bag of absolute URLs with **no rewritable common prefix**. Had this
shipped with `*.cloudfront.net` baked into the database, ever leaving CloudFront would have
required a data migration that distinguished "our old CDN URL" from "a Google avatar" by host
matching.

The rule this produced, now recorded in [ADR-0004](../docs/adr/0004-hosting-platform.md):

> No provider hostname (`*.r2.dev`, `*.cloudfront.net`, `*.s3.amazonaws.com`, `api.<domain>/media`)
> may ever appear in `MEDIA_BASE_URL` or `S3_PUBLIC_BASE_URL`. Bind media to a hostname you own.

The droplet build binds media to `media.<domain>` from day one, which makes the storage backend
swappable forever with zero rows touched. **The gap in the old design is why the new one is right.**

---

## 2. CI never validated the infrastructure

`README.md` claimed verification included "`cdk synth` for the infrastructure".
`.github/workflows/ci.yml` had exactly two jobs: `backend` and `frontend`. **There was no infra
job at all.** `tsc --noEmit` and `cdk synth` were only ever run by hand.

For an infrastructure-as-code project this is the gap that matters most: the entire value
proposition of IaC is that infrastructure is verifiable like code, and it was not being verified.

The correct fix would have been a third job running `npm ci && npx tsc --noEmit && npx cdk synth`
— with the caveat that `cdk synth` needs Docker available, because `ContainerImage.fromAsset`
builds the backend image during synthesis.

**Carried forward:** the same *class* of bug — CI testing a configuration production never uses —
is exactly what hid gap #6 below. The new `prod-image` CI job exists because of it.

---

## 3. `cdk synth` was not hermetic

```ts
zone = route53.HostedZone.fromLookup(this, "Zone", { domainName });
```

`fromLookup` is an environment-bound lookup: it requires a concrete account and region and makes
live AWS API calls during synthesis. So on the custom-domain path, `cdk synth` could not run
without credentials — which is CI-hostile and makes the "just synth it to check" workflow
conditional on a code path.

The usual mitigation is `HostedZone.fromHostedZoneAttributes` with the zone ID passed as context,
trading a lookup for a parameter.

---

## 4. Every deploy had hard downtime

```ts
minHealthyPercent: 0,
```

Documented and deliberate — two tasks would race `alembic upgrade head` — but the consequence is
that **every deploy dropped requests for a few seconds**. The comment names the upgrade path (a
pre-traffic migration task, then `minHealthyPercent: 100`) and it was never built.

Acceptable for a pre-launch product. Worth being explicit that "rolling deploy" was not what this
did.

---

## 5. Rate limiting was correct only by accident

`app/core/ratelimit.py` uses slowapi's default **in-process** storage. That is correct for
exactly one task, and the stack ran `desiredCount: 1` — so it worked.

But nothing *enforced* the coupling. Scaling to `desiredCount: 2` for availability — an obviously
sensible change, and one nothing in the stack would have objected to — would have silently made
every configured limit **2× looser**, with no error, no warning, and no test failure. The
brute-force protection on `/auth/login` would have quietly halved in strength.

An availability improvement that silently degrades a security control is the worst kind of
coupling: invisible, and in the direction of "looks better, is worse".

**Carried forward:** on the droplet the single-instance property is *structural* (one `api`
service in Compose) rather than configured, and the constraint is now written into
[ADR-0003](../docs/adr/0003-execution-model.md), `entrypoint.sh`, and the module docstring —
including the rule that adding `--workers` requires a Redis limiter backend first.

---

## 6. The rate-limit key was spoofable ⚠ *live bug, fixed in the migration*

```python
def client_ip(request: Request) -> str:
    """Best-effort client IP: the first X-Forwarded-For hop (set by the ALB), else the peer."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()   # LEFTMOST
```

The **leftmost** `X-Forwarded-For` hop is the one furthest from the server — it is whatever the
*client* sent. An ALB **appends** to the header rather than replacing it, so a caller sending
`X-Forwarded-For: 1.2.3.4` produced `1.2.3.4, <real-ip>` and this function returned the forged
value.

**Impact:** any attacker could mint an unlimited number of fresh rate-limit buckets by rotating a
fake header, walking straight past the 10/minute brute-force limit on `/auth/login`. The rate
limiting was decorative against exactly the adversary it existed to stop.

This was a live vulnerability in the AWS design too — it just never got deployed. Fixed during
the migration by keying on the **rightmost** hop (the one our own proxy appended), with the
reverse proxy additionally configured to *replace* rather than append:

```caddyfile
header_up X-Forwarded-For {remote_host}
```

Regression test: `backend/tests/test_ratelimit.py::test_prepended_forwarded_for_hop_does_not_reset_the_bucket`.

---

## 7. The production image could not start

Not an infrastructure bug, but it would have surfaced as one — as a Fargate task failing its
health check and rolling back, with a stack trace buried in CloudWatch.

`backend/app/modules/auth/service.py` imports `google.auth.transport.requests` at module scope.
`pyproject.toml` declared `google-auth>=2.29` **without** the `[requests]` extra, and nothing else
in the runtime dependency closure provides `requests`.

It worked everywhere it was tested and nowhere it mattered:

| Environment | Installs | `requests` present? |
|---|---|---|
| Local compose | `.[dev]` (`INSTALL_DEV=true`) | ✅ via `testcontainers` → `docker` |
| CI `backend` job | `.[dev]` | ✅ same |
| **Production image** | `.` | ❌ **`ImportError` at boot** |

The first `cdk deploy` would have failed, and the cause — a *dev* dependency masking a *runtime*
dependency — is not where anyone looks when a container won't start.

Fixed as `google-auth[requests]>=2.29`, with a CI job that builds the production image and
imports the app to make the gap permanently visible.

---

## The pattern

Five of these seven share one root cause: **the thing that was verified was not the thing that
would run.** CI tested a dependency set production never uses. The diagram described a hostname
the code never created. The rate limiter was correct for a task count nothing enforced.

The mitigation is not more documentation. It is making the verified artifact and the shipped
artifact the same artifact — which is why the replacement CI builds the actual production image,
and why the droplet's single-instance property is structural rather than configured.
