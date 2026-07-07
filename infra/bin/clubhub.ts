#!/usr/bin/env node
/**
 * CDK app entry point.
 *
 * This file is what `cdk` runs (see cdk.json -> "app"). It creates the CDK App,
 * reads deploy-time inputs from context (`-c key=value` on the CLI), and
 * instantiates the single ClubHubStack.
 *
 * Inputs (all optional; sensible behavior when omitted):
 *   -c domainName=clubhub.app     custom domain; enables HTTPS + Route53 for api.<domain>
 *   -c googleClientId=...         Google OAuth web client ID (also set on the frontend)
 *   -c alertEmail=you@example.com email for the monthly cost budget alarm
 *
 * The account/region come from your AWS credentials/profile (CDK_DEFAULT_*),
 * defaulting the region to ap-south-1 (Mumbai).
 */
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ClubHubStack } from "../lib/clubhub-stack";

const app = new cdk.App();

new ClubHubStack(app, "ClubHubStack", {
  // A concrete account+region is required for HostedZone.fromLookup (custom-domain path).
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1",
  },
  domainName: app.node.tryGetContext("domainName"),
  googleClientId: app.node.tryGetContext("googleClientId"),
  alertEmail: app.node.tryGetContext("alertEmail"),
  description: "ClubHub — Mode A (Fargate API + RDS + S3/CloudFront media).",
});
