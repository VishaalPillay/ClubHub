# Architecture — ClubHub on AWS (Mode A)

Construct-by-construct walkthrough of the CDK app, and the reasoning behind each decision.
Source: tag [`aws-cdk-final`](https://github.com/VishaalPillay/ClubHub/tree/aws-cdk-final/infra).

Region **`ap-south-1` (Mumbai)** — the users are Indian students, so latency and data residency
both point the same way.

---

## Composition — one stack, four constructs

Four Constructs (`network`, `database`, `media`, `api`) compose into a single
`ClubHubStack`. Splitting them into four *stacks* would have been the more obvious modular
choice and would have been wrong:

> Separate stacks would have to share resources through CloudFormation exports, which **lock
> the exporting resource against change while it is referenced** — a common iteration headache.
> Constructs live in the same stack, so we can wire them with plain object references and no
> export/import friction, while the code stays modular (one concern per file).

Modularity was bought at the file level, where it is free, instead of the stack level, where it
costs deployment flexibility. If one part later needs its own lifecycle — the database is the
likely candidate — that Construct gets promoted to a Stack then, not speculatively.

Inputs arrive as CDK context (`-c domainName=… -c googleClientId=… -c alertEmail=…`), all
optional. With no `domainName` the stack still deploys, on plain HTTP at the raw ALB DNS name —
so a first bring-up never blocks on DNS.

---

## Network — the VPC

```ts
this.vpc = new ec2.Vpc(this, "Vpc", {
  maxAzs: 2,
  natGateways: 0,
  subnetConfiguration: [
    { name: "public",   subnetType: ec2.SubnetType.PUBLIC,           cidrMask: 24 },
    { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
  ],
});
```

**Two tiers, two AZs, and zero NAT gateways.** The NAT decision is the interesting one — a NAT
gateway costs ~$33/month, which on a ~$50/month stack is a third of the bill.

A NAT exists to give *private* subnets outbound internet access. This deployment does not need
that: the database never calls out, and the API reaches ECR, S3, and Google's token endpoint
through the Internet Gateway because it sits in a **public** subnet.

The obvious objection — "the API is on the public internet" — does not hold. The Fargate task
has a public IP but its security group accepts traffic **only from the ALB's security group**.
The ingress posture is identical to a private-subnet deployment; what changes is only the
egress path, and $33/month.

RDS meanwhile sits in `PRIVATE_ISOLATED`: no route to the internet in *or* out. The database is
not firewalled off from the internet, it is *unrouteable* from it.

---

## Database — RDS PostgreSQL 16

`db.t4g.micro` (Graviton), single-AZ, 20 GB gp3, encrypted, 7-day automated backups,
`RemovalPolicy.SNAPSHOT` so a teardown leaves a final snapshot rather than silently dropping
data. `deletionProtection: false` with a comment to flip it once the data matters.

The detail worth stealing:

```ts
credentials: rds.Credentials.fromGeneratedSecret("clubhub", {
  excludeCharacters: "/@\"\\ %:#?&=+'`",
}),
```

RDS generates the password directly into Secrets Manager — it never exists in code, in git, or
in a human's clipboard. The `excludeCharacters` set is not arbitrary: `entrypoint.sh` assembles
a URL-form DSN (`postgresql+psycopg://user:pass@host/db`) from the discrete parts, and every
excluded character is one that would terminate a URL component early. A generated password
containing `@` or `/` would produce a DSN that parses *successfully* into the wrong host.

That is a class of bug that surfaces at 3am on a redeploy months later, and it was designed out
at the schema level rather than escaped at the string level.

---

## Media — private S3 behind CloudFront

```ts
this.bucket = new s3.Bucket(this, "AvatarsBucket", {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  encryption: s3.BucketEncryption.S3_MANAGED,
  enforceSSL: true,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
});

this.distribution = new cloudfront.Distribution(this, "MediaCdn", {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
  },
});
```

The bucket is **never public**. Origin Access Control lets CloudFront — and only CloudFront —
read it; CDK writes the matching bucket policy. `ALLOW_GET_HEAD` means the CDN cannot write even
if something upstream tried.

`CACHING_OPTIMIZED` is safe here specifically because the API writes **content-unique keys**
(`avatars/{user_id}/{uuid}.webp`) with `Cache-Control: public, max-age=31536000, immutable`.
Cache invalidation is avoided rather than solved: a new avatar is a new key.

`RETAIN` on delete — a `cdk destroy` must not take user uploads with it.

> This construct is also where the design's most instructive gap lives. See
> [KNOWN-GAPS.md §1](./KNOWN-GAPS.md): `media.<domain>` was promised in the diagram and the env
> template but never wired in code, and that discrepancy is what shaped the media-hostname rule
> in [ADR-0004](../docs/adr/0004-hosting-platform.md).

---

## API — Fargate behind an ALB

`internet → ALB (HTTPS, ACM) → Fargate task (FastAPI :8000) → RDS / S3 / Secrets Manager`

### Secrets as discrete fields

The single best snippet in the codebase:

```ts
const secrets: Record<string, ecs.Secret> = {
  JWT_SECRET_KEY:    ecs.Secret.fromSecretsManager(props.jwtSecret),
  POSTGRES_HOST:     ecs.Secret.fromSecretsManager(dbSecret, "host"),
  POSTGRES_PORT:     ecs.Secret.fromSecretsManager(dbSecret, "port"),
  POSTGRES_USER:     ecs.Secret.fromSecretsManager(dbSecret, "username"),
  POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
  POSTGRES_DB:       ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
};
```

Not a pre-built `DATABASE_URL`. ECS resolves each field from Secrets Manager at container start
and injects it into the process environment; `entrypoint.sh` stitches them into a DSN in
memory. **The password never appears in the task definition, the image, or CloudFormation** —
all of which are readable by anyone with console access.

The task definition, meanwhile, carries only non-secret config:

```ts
const environment: Record<string, string> = {
  DEBUG: "false",
  COOKIE_SECURE: domainName ? "true" : "false",
  CORS_ORIGINS:  domainName ? `https://app.${domainName}` : "http://localhost:3000",
  STORAGE_BACKEND: "s3",
  S3_BUCKET: props.mediaBucket.bucketName,
  S3_REGION: region,
  S3_PUBLIC_BASE_URL: `https://${props.mediaDistribution.distributionDomainName}`,
  GOOGLE_CLIENT_ID: props.googleClientId ?? "",
};
```

`COOKIE_SECURE` is derived from whether a domain exists, because over plain HTTP a `Secure`
cookie would simply be dropped by the browser — the config cannot get out of step with the
protocol because it is computed from it.

### One task, on purpose

```ts
desiredCount: 1,
minHealthyPercent: 0,   // replace in place; do NOT run two tasks
```

This looks like a cost decision and is really a **correctness** one. Two tasks would race
`alembic upgrade head` on boot. It also silently doubles every rate limit, because slowapi's
counters are per-process — see [KNOWN-GAPS.md §5](./KNOWN-GAPS.md).

The cost is a few seconds of downtime per deploy, documented in the code with its upgrade path
(a pre-traffic migration task, then `minHealthyPercent: 100`). It was never built.

This is the property the droplet build inherited **structurally** rather than by configuration:
one `api` container in Compose is single-writer by construction.

### The rest

- **`ContainerImage.fromAsset("../backend")`** — `cdk deploy` builds the image locally, pushes
  to the CDK-managed ECR, and rolls the service in one converging command. No "push an image
  first" step; the first deploy just works. The cost is that deploys need Docker running.
- **`circuitBreaker: { rollback: true }`** with a `/health` target-group check and a 120s grace
  period — a task that fails to migrate rolls itself back instead of taking the service down.
- **`grantPut` only** on the media bucket. The API can write avatars; it cannot read or delete
  them. CloudFront does the reading.
- **ACM + Route 53 only when `domainName` is set** — `HostedZone.fromLookup`, a DNS-validated
  certificate, `redirectHTTP: true`, `SslPolicy.RECOMMENDED_TLS`.
- **A `$40/month` budget** with an email alert at 80% of actual spend, created only when
  `alertEmail` is supplied. A guardrail on a student account, not an afterthought.

---

## CD — GitHub OIDC, no static keys

The deploy workflow held **no AWS credentials**. It exchanged a short-lived GitHub OIDC token
for a role session:

```yaml
permissions:
  id-token: write
  contents: read

- name: Configure AWS credentials (OIDC)
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
    aws-region: ${{ vars.AWS_REGION }}
```

Two properties made this tight:

1. **The trust policy pinned the `sub` claim** to `repo:VishaalPillay/ClubHub:ref:refs/heads/main`
   — a fork, a PR branch, or another repo cannot assume the role even with a valid GitHub token.
2. **The role's only inline permission was `sts:AssumeRole` on `arn:aws:iam::<account>:role/cdk-*`.**
   It could not touch AWS directly; it could only step into the roles CDK bootstrap already
   created for exactly this purpose.

Every input (`DOMAIN_NAME`, `GOOGLE_CLIENT_ID`, `ALERT_EMAIL`, the role ARN, the region) was a
repo **Variable**, not a Secret — because none of them are secret. There was no long-lived
credential anywhere in the pipeline.

Full setup procedure: [RUNBOOK.md §7](./RUNBOOK.md).

---

## Reference: file map

| File | Responsibility |
|---|---|
| `bin/clubhub.ts` | App entry; reads `-c` context, defaults region to `ap-south-1` |
| `lib/clubhub-stack.ts` | Composes the four constructs; generates the JWT secret |
| `lib/network.ts` | VPC — public + isolated subnets, no NAT |
| `lib/database.ts` | RDS PostgreSQL 16 + generated Secrets Manager credentials |
| `lib/media.ts` | Private S3 avatars bucket + CloudFront (OAC) |
| `lib/api.ts` | ECR image asset, Fargate service, ALB, ACM cert, Route 53, cost budget |
