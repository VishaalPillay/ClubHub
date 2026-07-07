import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

import { Network } from "./network";
import { Database } from "./database";
import { Media } from "./media";
import { Api } from "./api";

export interface ClubHubStackProps extends cdk.StackProps {
  /** Custom domain (e.g. "clubhub.app"). When set, the API is served over HTTPS at api.<domain>. */
  readonly domainName?: string;
  /** Google OAuth web client ID — injected into the API container (not a secret). */
  readonly googleClientId?: string;
  /** Email address for the monthly cost budget notification. */
  readonly alertEmail?: string;
}

/**
 * The whole ClubHub deployment as ONE stack, composed from four focused Constructs.
 *
 * Why one stack, not four: separate stacks would have to share resources through
 * CloudFormation exports, which lock the exporting resource against change while it is
 * referenced (a common iteration headache). Constructs live in the same stack, so we can
 * wire them together with plain object references and no export/import friction — while the
 * code stays modular (one concern per file). If any part later needs its own lifecycle
 * (e.g. the database), promote that Construct to its own Stack then.
 */
export class ClubHubStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClubHubStackProps = {}) {
    super(scope, id, props);

    // 1) Private network: a VPC with public + isolated subnets, no NAT gateway.
    const network = new Network(this, "Network");

    // 2) Managed Postgres in the isolated subnets; credentials live in Secrets Manager.
    const database = new Database(this, "Database", { vpc: network.vpc });

    // 3) Private S3 bucket for avatars, fronted by CloudFront (OAC).
    const media = new Media(this, "Media");

    // 4) The app's JWT signing secret — generated once, never in code or git.
    const jwtSecret = new secretsmanager.Secret(this, "JwtSecret", {
      description: "ClubHub JWT signing key (JWT_SECRET_KEY).",
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });

    // 5) The API: a Fargate service behind an ALB, wired to the database, media, and secrets.
    new Api(this, "Api", {
      vpc: network.vpc,
      database,
      mediaBucket: media.bucket,
      mediaDistribution: media.distribution,
      jwtSecret,
      domainName: props.domainName,
      googleClientId: props.googleClientId,
      alertEmail: props.alertEmail,
    });
  }
}
