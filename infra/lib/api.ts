import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

import { Database } from "./database";

export interface ApiProps {
  readonly vpc: ec2.Vpc;
  readonly database: Database;
  readonly mediaBucket: s3.IBucket;
  readonly mediaDistribution: cloudfront.IDistribution;
  readonly jwtSecret: secretsmanager.ISecret;
  readonly domainName?: string;
  readonly googleClientId?: string;
  readonly alertEmail?: string;
}

/**
 * The FastAPI backend on ECS Fargate, behind an Application Load Balancer.
 *
 * Runtime shape:
 *   internet -> ALB (HTTPS, ACM cert) -> Fargate task (FastAPI :8000) -> RDS / S3 / Secrets
 *
 * Key decisions:
 *   - The container image is built from ../backend at deploy time (ContainerImage.fromAsset):
 *     `cdk deploy` builds it, pushes to the CDK-managed ECR, and rolls the service. No separate
 *     "push an image first" step — the first deploy just works. (For faster app-only deploys
 *     later you can switch to a dedicated ECR repo + `aws ecs update-service`.)
 *   - Fargate runs in PUBLIC subnets with a public IP but a security group that only accepts
 *     traffic from the ALB — this is what lets us skip the NAT gateway (see Network).
 *   - Config is env vars; the two real secrets (JWT key, DB password) are injected from
 *     Secrets Manager as discrete fields — never baked into the image or task-def plaintext.
 */
export class Api extends Construct {
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    const region = cdk.Stack.of(this).region;
    const { domainName } = props;
    const apiFqdn = domainName ? `api.${domainName}` : undefined;

    const cluster = new ecs.Cluster(this, "Cluster", { vpc: props.vpc });

    // Build the API image straight from the backend Dockerfile at deploy time.
    const image = ecs.ContainerImage.fromAsset(path.join(__dirname, "..", "..", "backend"));

    const logGroup = new logs.LogGroup(this, "ApiLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const dbSecret = props.database.secret;

    // Discrete secret fields — the entrypoint stitches these into DATABASE_URL at boot.
    const secrets: Record<string, ecs.Secret> = {
      JWT_SECRET_KEY: ecs.Secret.fromSecretsManager(props.jwtSecret),
      POSTGRES_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
      POSTGRES_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
      POSTGRES_USER: ecs.Secret.fromSecretsManager(dbSecret, "username"),
      POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
      POSTGRES_DB: ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
    };

    // Non-secret config. Over plain HTTP (no domain) the refresh cookie can't be Secure, so we
    // only turn COOKIE_SECURE on once we have HTTPS via a custom domain.
    const environment: Record<string, string> = {
      DEBUG: "false",
      COOKIE_SECURE: domainName ? "true" : "false",
      CORS_ORIGINS: domainName ? `https://app.${domainName}` : "http://localhost:3000",
      STORAGE_BACKEND: "s3",
      S3_BUCKET: props.mediaBucket.bucketName,
      S3_REGION: region,
      S3_PUBLIC_BASE_URL: `https://${props.mediaDistribution.distributionDomainName}`,
      GOOGLE_CLIENT_ID: props.googleClientId ?? "",
    };

    // HTTPS + Route53 only when a domain is supplied; otherwise plain HTTP on the ALB DNS name
    // (handy for a first bring-up — add the domain and redeploy to switch on TLS).
    let zone: route53.IHostedZone | undefined;
    let certificate: acm.Certificate | undefined;
    if (domainName) {
      zone = route53.HostedZone.fromLookup(this, "Zone", { domainName });
      certificate = new acm.Certificate(this, "ApiCert", {
        domainName: apiFqdn!,
        validation: acm.CertificateValidation.fromDns(zone),
      });
    }

    const httpsProps =
      domainName && certificate && zone
        ? {
            protocol: elbv2.ApplicationProtocol.HTTPS,
            certificate,
            domainName: apiFqdn,
            domainZone: zone,
            redirectHTTP: true,
            sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
          }
        : {};

    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service", {
      cluster,
      cpu: 256, // 0.25 vCPU — dev size; bump to 512 if Pillow image processing OOMs
      memoryLimitMiB: 512, // 0.5 GB — bump to 1024 alongside cpu:512 under load
      desiredCount: 1,
      // Single task: replace in place on deploy (a few seconds of downtime) rather than run a
      // second task. This deliberately avoids two tasks racing `alembic upgrade head` on boot.
      // For zero-downtime later: add a pre-traffic migration task, then set minHealthyPercent:100.
      minHealthyPercent: 0,
      publicLoadBalancer: true,
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // no NAT needed (see Network)
      circuitBreaker: { rollback: true }, // auto-roll-back a bad deploy
      healthCheckGracePeriod: cdk.Duration.seconds(120), // room for migrations on first boot
      taskImageOptions: {
        image,
        containerPort: 8000,
        environment,
        secrets,
        enableLogging: true,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: "clubhub-api", logGroup }),
      },
      ...httpsProps,
    });

    // The ALB decides which tasks are healthy by hitting /health (fast, DB-free endpoint).
    this.service.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200",
    });

    // Open the RDS security group to the Fargate service on the Postgres port (nothing else).
    props.database.instance.connections.allowDefaultPortFrom(
      this.service.service,
      "Fargate API to Postgres"
    );

    // Least privilege: the task role may PUT avatar objects, nothing more.
    props.mediaBucket.grantPut(this.service.taskDefinition.taskRole);

    // A monthly cost budget so credit burn is never a surprise (email alert at 80% of $40).
    if (props.alertEmail) {
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: 40, unit: "USD" },
          budgetName: `${cdk.Stack.of(this).stackName}-monthly`,
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              notificationType: "ACTUAL",
              threshold: 80,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [{ subscriptionType: "EMAIL", address: props.alertEmail }],
          },
        ],
      });
    }

    // Handy values printed after `cdk deploy`.
    new cdk.CfnOutput(this, "ApiUrl", {
      value: domainName
        ? `https://${apiFqdn}`
        : `http://${this.service.loadBalancer.loadBalancerDnsName}`,
      description: "Base URL of the API (set NEXT_PUBLIC_API_URL to this).",
    });
    new cdk.CfnOutput(this, "AlbDnsName", {
      value: this.service.loadBalancer.loadBalancerDnsName,
    });
    new cdk.CfnOutput(this, "MediaCdnDomain", {
      value: props.mediaDistribution.distributionDomainName,
      description: "Set S3_PUBLIC_BASE_URL to https://<this>.",
    });
    new cdk.CfnOutput(this, "MediaBucketName", { value: props.mediaBucket.bucketName });
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: props.database.instance.dbInstanceEndpointAddress,
    });
  }
}
