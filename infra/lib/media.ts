import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

/**
 * Avatar storage: a PRIVATE S3 bucket served through CloudFront.
 *
 * - The bucket blocks all public access and requires TLS. Nothing can read it directly.
 * - CloudFront uses Origin Access Control (OAC) to fetch from the bucket; CDK also writes the
 *   matching bucket policy, so CloudFront is the *only* reader. Users get avatars from the
 *   CloudFront domain (fast, cached, HTTPS); the bucket stays closed.
 * - CACHING_OPTIMIZED because the API writes content-hashed keys with immutable cache headers.
 * - The bucket is RETAINed on stack delete so user uploads aren't destroyed by a teardown.
 *
 * S3_PUBLIC_BASE_URL for the API = https://<distribution domain>. To use media.<domain>
 * instead, add `domainNames` + an ACM cert (in us-east-1) here later.
 */
export class Media extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, "AvatarsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // keep user data even if the stack is deleted
    });

    this.distribution = new cloudfront.Distribution(this, "MediaCdn", {
      comment: "ClubHub avatars",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
    });
  }
}
