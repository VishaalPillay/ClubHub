# ClubHub — Deployment Runbook (AWS, Mode A)

This is the step-by-step guide to take ClubHub from your laptop to a live URL on AWS, and to
teach you what each step does. Architecture overview: [clubhub-aws-architecture.drawio](./clubhub-aws-architecture.drawio).

**The shape of it:** the backend + all infrastructure are defined as code in [`infra/`](../infra)
(AWS CDK). You run `cdk deploy` once from your laptop to bring it up, then GitHub Actions
redeploys on every push. The frontend runs on AWS Amplify Hosting, connected straight to GitHub.

> **Mental model.** Everything inside AWS is described by the CDK app. `cdk deploy` reads that
> description and makes your account match it. To change infrastructure, you edit TypeScript and
> deploy again — never click around the console (that creates "drift" the code doesn't know about).

---

## 0. Prerequisites (install once)

On your laptop you need:

- **AWS account** — you have a fresh one with $200 credits. Good.
- **AWS CLI v2** — `aws --version`. Install from the AWS docs if missing.
- **Node.js 20+** — `node --version` (you already have it for the frontend).
- **Docker Desktop** — running. `cdk deploy` builds the API image locally, so Docker must be up.
- **A domain name** — you chose the custom-domain path. Buy one anywhere (Route 53, Namecheap,
  etc.). We'll use `clubhub.example` in examples — substitute yours everywhere.

---

## 1. Point the AWS CLI at your account

**Concept.** The CLI (and CDK) act as *you* by using credentials tied to an IAM identity. For a
solo project the simplest safe setup is an **IAM Identity Center (SSO)** user, or an IAM user with
an access key. Either way you end up with a working `aws` CLI.

```bash
aws configure          # paste Access Key ID + Secret, set region = ap-south-1, output = json
aws sts get-caller-identity   # verify: prints your account id + user ARN
```

Set your working region once so CDK picks it up:

```bash
# Windows PowerShell
$env:CDK_DEFAULT_REGION = "ap-south-1"
# macOS/Linux
export CDK_DEFAULT_REGION=ap-south-1
```

> Region choice: **ap-south-1 (Mumbai)** is closest to you. The one exception is CloudFront,
> which is global and whose optional custom-domain certificate must live in us-east-1 — we sidestep
> that by serving avatars from the default CloudFront domain (no cert needed). See `infra/lib/media.ts`.

---

## 2. Register the domain in Route 53 (DNS)

**Concept.** DNS turns `api.clubhub.example` into an IP address. AWS's DNS service is **Route 53**,
and a **hosted zone** is the container for one domain's records. The CDK looks up this zone to
create the API's record and validate its TLS certificate automatically — so the zone must exist
first.

1. Route 53 console → **Hosted zones → Create hosted zone** → enter your domain → Create.
2. Route 53 shows 4 **NS (nameserver)** values. At your registrar, set the domain's nameservers to
   those 4. (If you registered the domain *in* Route 53, this is already done.)
3. Wait for propagation (minutes to a couple hours). Verify:
   ```bash
   aws route53 list-hosted-zones --query "HostedZones[].Name"
   ```

---

## 3. Bootstrap CDK (one time per account+region)

**Concept.** Before CDK can deploy, it needs a small set of shared resources in your account (an S3
bucket + ECR repo for assets, and IAM roles it assumes to deploy). Creating them is called
**bootstrapping**. You do it once.

```bash
cd infra
npm install                       # already done if you followed along; safe to repeat
npx cdk bootstrap                 # uses your CLI creds + region
```

You'll see it create a `CDKToolkit` CloudFormation stack. That's expected.

---

## 4. Deploy the stack 🎉

**Concept.** This single command builds the API Docker image, pushes it, and creates the VPC, RDS,
S3, CloudFront, ALB, Fargate service, TLS cert, DNS record, and cost budget — in dependency order.
First run takes **~15–25 min** (RDS and CloudFront are slow to create).

```bash
cd infra
npx cdk deploy \
  -c domainName=clubhub.example \
  -c googleClientId=YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com \
  -c alertEmail=you@example.com
```

- `-c domainName=...` turns on HTTPS + the `api.clubhub.example` DNS record. Omit it for a first
  HTTP-only bring-up on the raw ALB address.
- `-c googleClientId=...` is injected into the API container (also set it on the frontend, step 6).
- `-c alertEmail=...` creates the monthly **$40 budget** email alert.

CDK prints a **diff** and asks to approve IAM/security changes — review, then `y`. When it finishes
it prints **Outputs**. Copy these — you need them next:

```
ClubHubStack.ApiUrl          = https://api.clubhub.example
ClubHubStack.MediaCdnDomain  = d1234abcd.cloudfront.net
ClubHubStack.MediaBucketName = clubhubstack-mediaavatarsbucket-xxxx
ClubHubStack.DbEndpoint      = clubhubstack-...rds.amazonaws.com
```

**Verify the API is live:**

```bash
curl https://api.clubhub.example/health      # -> {"status":"ok","version":"0.1.0"}
```

Open `https://api.clubhub.example/docs` — the Swagger UI should load.

> **What just happened under the hood.** CDK built the image → pushed to ECR → CloudFormation
> created RDS (in the isolated subnet) and generated its password into Secrets Manager → created the
> ALB + Fargate service → the task booted, read the secrets, assembled `DATABASE_URL`, ran
> `alembic upgrade head`, then started uvicorn → the ALB's `/health` check went green → the target
> became "healthy" and traffic flows.

---

## 5. Configure Google sign-in for production

**Concept.** Google only issues sign-in tokens to origins you've explicitly allowed. Your prod
frontend is a new origin.

- Google Cloud Console → **APIs & Services → Credentials** → your OAuth **Web** client →
  **Authorized JavaScript origins** → add `https://app.clubhub.example` (keep `http://localhost:3000`
  for dev) → Save.
- The **same** client ID goes in two places: the backend (`-c googleClientId=` above, verifies
  tokens) and the frontend (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, next step, renders the button).

---

## 6. Deploy the frontend on AWS Amplify Hosting

**Concept.** The Next.js app can't be a plain static upload — it has server-rendered and dynamic
(`c/[clubId]`) routes, so it needs a Node runtime. **Amplify Hosting** builds and runs Next.js SSR
for you and wires up HTTPS + CDN + a Git-push deploy pipeline — no servers to manage.

1. Amplify console → **Create new app → Deploy from GitHub** → authorize → pick this repo + branch
   `main`.
2. **App root / monorepo**: set the app's root directory to `frontend`. Amplify auto-detects Next.js.
3. **Environment variables** (these are inlined into the build):
   - `NEXT_PUBLIC_API_URL = https://api.clubhub.example`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID = <same web client id>`
4. Deploy. Amplify gives you a `*.amplifyapp.com` URL — check it renders.
5. **Custom domain**: Amplify → **Hosting → Custom domains** → add `clubhub.example`, map the root
   or `app` subdomain to this app. Because your DNS is already in Route 53, Amplify creates the
   records + certificate automatically. End state: `https://app.clubhub.example`.

> Cross-origin cookies note: because the frontend (`app.clubhub.example`) and API
> (`api.clubhub.example`) share the registrable domain `clubhub.example`, the refresh cookie's
> `SameSite=Lax` is sent on the cross-subdomain API calls — no code change needed. This is exactly
> why we chose a custom domain over raw AWS domains.

---

## 7. Turn on automatic deploys (GitHub Actions → AWS via OIDC)

The [CI workflow](../.github/workflows/ci.yml) already runs tests on every push. To let the
[Deploy workflow](../.github/workflows/deploy.yml) run `cdk deploy` for you, give GitHub a role to
assume — **without storing any AWS keys**.

**Concept.** You register GitHub as a trusted **OIDC identity provider** in your account, then
create a role GitHub may assume *only* from this repo. The workflow gets minutes-long credentials.

**7a. Create the OIDC provider** (once per account):

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

**7b. Create the deploy role.** Save this trust policy as `trust.json` (replace ACCOUNT_ID and the
repo `VishaalPillay/ClubHub` with your GitHub `owner/repo`):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:VishaalPillay/ClubHub:ref:refs/heads/main" }
    }
  }]
}
```

```bash
aws iam create-role --role-name clubhub-gha-deploy \
  --assume-role-policy-document file://trust.json

# cdk deploy works by assuming the CDK bootstrap roles, so the CI role only needs to be allowed
# to assume those (least privilege — it can't do arbitrary AWS actions itself).
aws iam put-role-policy --role-name clubhub-gha-deploy \
  --policy-name assume-cdk-roles \
  --policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Action":"sts:AssumeRole","Resource":"arn:aws:iam::ACCOUNT_ID:role/cdk-*"}]
  }'
```

**7c. Tell the workflow about it.** In GitHub → repo **Settings → Secrets and variables → Actions →
Variables**, add:

| Variable | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/clubhub-gha-deploy` |
| `AWS_REGION` | `ap-south-1` |
| `DOMAIN_NAME` | `clubhub.example` |
| `GOOGLE_CLIENT_ID` | `<your web client id>` |
| `ALERT_EMAIL` | `you@example.com` |

Now every push to `main` that touches `backend/**` or `infra/**` redeploys automatically.

---

## 8. Full smoke test (production)

- `curl https://api.clubhub.example/health` → `{"status":"ok"}`.
- Open `https://app.clubhub.example` → landing renders.
- Register with email → profile step → lands on `/portal`.
- **Google sign-in** works; a new Google user goes to the profile step, a returning one to `/portal`.
- Upload an avatar → it appears; the URL is `https://<cloudfront>/avatars/...` and loads as WebP.
- Reload a logged-in tab → stays logged in (silent `/auth/refresh` — the Secure, SameSite=Lax cookie).
- Create a club → dashboard/tasks/leaderboard all work.

---

## 9. Cost & the credits cliff

At list price this stack is ~**$46–52/mo**, but your $200 credits + 6-month free plan cover it — so
effectively **free for ~4 months**. The budget alarm emails you at $40.

**Before credits run out, drop to Mode B (~$5–20/mo):**

1. Snapshot RDS (console → RDS → Snapshots), or `pg_dump` the database.
2. Launch **one Lightsail instance** (~$10/mo), install Docker + Docker Compose.
3. Run the app there with a compose file: the `api` image + a `postgres` container (restore your
   dump into it) + Caddy/nginx for TLS. The app is already containerized, so this is a redeploy,
   not a rewrite.
4. Keep the S3 bucket + CloudFront for avatars (pennies). Keep the frontend on Amplify (cheap) or
   move it onto the box too.
5. `cdk destroy` the Mode-A stack (see below) to stop the Fargate/RDS/ALB charges.

---

## 10. Teardown (stop all charges)

```bash
cd infra
npx cdk destroy
```

This deletes the stack. Two things are deliberately **kept**: the S3 avatars bucket
(`RemovalPolicy.RETAIN`) and a final RDS snapshot (`RemovalPolicy.SNAPSHOT`) — so user data and the
database aren't silently destroyed. Delete those by hand if you truly want them gone.

---

## 11. Troubleshooting (common first-deploy issues)

| Symptom | Cause & fix |
|---|---|
| `cdk deploy` hangs on the service, then rolls back | The task isn't passing `/health`. Check **CloudWatch → Log groups → clubhub-api** for the container's startup logs (migration errors, bad DB creds). The deployment circuit breaker auto-rolls-back. |
| Task logs: `could not connect to server` | RDS security-group rule or subnet issue. Confirm the task is in the VPC and `allowDefaultPortFrom` is present (it is, in `api.ts`). |
| `cdk deploy` fails: cannot pull image / no Docker | Docker Desktop isn't running. Start it and retry. |
| Certificate stuck "pending validation" | The Route 53 hosted zone isn't authoritative yet (NS not propagated). Finish step 2 first. |
| 502 from the ALB | The container crashed after passing health once, or the port is wrong (must be 8000). Check logs. |
| Frontend loads but API calls fail (CORS) | `CORS_ORIGINS` must equal your exact frontend origin. It's derived from `domainName`; if your frontend is on a different host, redeploy with the right `domainName` or adjust `api.ts`. |
| Avatars upload but don't display | `S3_PUBLIC_BASE_URL` must be `https://<MediaCdnDomain>`. It's set automatically; confirm the CloudFront distribution deployed. |

---

## Reference: what's in `infra/`

| File | Responsibility |
|---|---|
| `bin/clubhub.ts` | App entry; reads `-c` context (domainName, googleClientId, alertEmail). |
| `lib/clubhub-stack.ts` | Composes the four constructs into one stack. |
| `lib/network.ts` | VPC — public + isolated subnets, no NAT. |
| `lib/database.ts` | RDS PostgreSQL 16 + generated Secrets Manager credentials. |
| `lib/media.ts` | Private S3 avatars bucket + CloudFront (OAC). |
| `lib/api.ts` | ECR image asset + Fargate service + ALB + TLS cert + Route 53 + cost budget. |
