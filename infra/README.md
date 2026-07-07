# ClubHub Infrastructure (AWS CDK)

TypeScript CDK app that provisions the **Mode A** deployment: VPC → RDS Postgres → S3 + CloudFront
(avatars) → ECS Fargate API behind an ALB, with Secrets Manager, TLS, Route 53, and a cost budget.

**Full step-by-step guide:** [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
**Architecture diagram:** [`../docs/clubhub-aws-architecture.drawio`](../docs/clubhub-aws-architecture.drawio).

## Layout

```
bin/clubhub.ts        # app entry; reads -c domainName / googleClientId / alertEmail
lib/clubhub-stack.ts  # composes the four constructs into one stack
lib/network.ts        # VPC (public + isolated subnets, no NAT)
lib/database.ts       # RDS PostgreSQL 16 + generated credentials secret
lib/media.ts          # private S3 bucket + CloudFront (OAC)
lib/api.ts            # Fargate service + ALB + cert/Route53 + budget
```

## Quick commands

```bash
npm install                     # once
npx cdk bootstrap               # once per account+region
npx tsc --noEmit                # type-check
npx cdk synth                   # generate CloudFormation locally (builds the image)
npx cdk diff  -c domainName=... # preview changes against the deployed stack
npx cdk deploy -c domainName=clubhub.example -c googleClientId=... -c alertEmail=you@example.com
npx cdk destroy                 # tear down (keeps the S3 bucket + a final RDS snapshot)
```

Region defaults to `ap-south-1` (override with `CDK_DEFAULT_REGION`). Requires Docker running for
the API image build. All inputs are optional: omit `domainName` for an HTTP-only first bring-up.
