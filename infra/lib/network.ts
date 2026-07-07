import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

/**
 * The VPC (private network) everything else runs inside.
 *
 * Layout — 2 Availability Zones, two subnet tiers, and NO NAT gateway:
 *   - PUBLIC subnets: reachable from the internet via an Internet Gateway. The ALB lives
 *     here, and (to avoid paying for NAT) so does the Fargate task — but the task's security
 *     group only accepts traffic from the ALB, so it is not actually exposed.
 *   - PRIVATE_ISOLATED subnets: no route to the internet at all. RDS lives here, so the
 *     database simply cannot be reached from outside the VPC.
 *
 * Why no NAT gateway: a NAT (~$33/mo each) exists to give *private* subnets outbound
 * internet access. We don't need it: the DB never calls out, and the API reaches ECR / S3 /
 * Google's token endpoint through the Internet Gateway because it sits in a public subnet.
 */
export class Network extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
  }
}
