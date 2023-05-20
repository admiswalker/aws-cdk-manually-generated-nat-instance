import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { InstanceType, NatInstanceImage, NatProvider } from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Stack, StackProps } from 'aws-cdk-lib';

interface AwsCdkTplStackProps extends StackProps {
}
export class AwsCdkTplStack extends Stack {
  constructor(scope: Construct, id: string, props?: AwsCdkTplStackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'vpc_for_ec2_and_ssm', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0,
      //natGateways: 1,
      //natGatewayProvider: nat_instance,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 27,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 27,
        },
      ],
    });

    // SSM
    const nat_iam_role = new iam.Role(this, 'iam_role_for_nat_ssm', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentAdminPolicy'),
      ],
    });

    // NAT
    const nat_config = ec2.UserData.forLinux({shebang: ''});
    nat_config.addCommands(fs.readFileSync('./lib/ec2_nat.yaml', 'utf8'));
    const nat_userData = new ec2.MultipartUserData();
    nat_userData.addPart(ec2.MultipartBody.fromUserData(nat_config, 'text/cloud-config; charset="utf8"'));

    const nat_sg = new ec2.SecurityGroup(this, 'NatSg', {
      allowAllOutbound: true,
      securityGroupName: 'Nat Sev Security Group',
      vpc: vpc,
    });
    
    const nat_instance = new ec2.Instance(this, 'NatInstance', {
      instanceType: new ec2.InstanceType('t3a.nano'), // 2 vCPU, 0.5 GB
//    machineImage: ec2.MachineImage.genericLinux({'us-west-2': 'ami-XXXXXXXXXXXXXXXXX'}),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
        edition: ec2.AmazonLinuxEdition.STANDARD,
        virtualization: ec2.AmazonLinuxVirt.HVM,
        storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      }),
      vpc: vpc,
//    blockDevices: [{
//	    deviceName: '/dev/sda1',
//	    volume: ec2.BlockDeviceVolume.ebs(30),
//    }],
      vpcSubnets: vpc.selectSubnets({
        subnetGroupName: 'Private',
      }),
      role: nat_iam_role,
      userData: nat_userData,
      securityGroup: nat_sg,
    });

    // SSM
    const ssm_iam_role = new iam.Role(this, 'iam_role_for_ssm', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentAdminPolicy'),
      ],
    });

    vpc.addInterfaceEndpoint('InterfaceEndpoint_ssm', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
    });
    vpc.addInterfaceEndpoint('InterfaceEndpoint_ec2_messages', {
      service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
    });
    vpc.addInterfaceEndpoint('InterfaceEndpoint_ssm_messages', {
      service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
    });

    // EC2
    const cloud_config = ec2.UserData.forLinux({shebang: ''})
    const user_data_script = fs.readFileSync('./lib/ec2_user-data.yaml', 'utf8');
    cloud_config.addCommands(user_data_script)
    const multipartUserData = new ec2.MultipartUserData();
    multipartUserData.addPart(ec2.MultipartBody.fromUserData(cloud_config, 'text/cloud-config; charset="utf8"'));

    const ec2_sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      allowAllOutbound: true,
      securityGroupName: 'EC2 Sev Security Group',
      vpc: vpc,
    });
    
    const ec2_instance = new ec2.Instance(this, 'General_purpose_ec2', {
      instanceType: new ec2.InstanceType('t3a.nano'), // 2 vCPU, 0.5 GB
//    machineImage: ec2.MachineImage.genericLinux({'us-west-2': 'ami-XXXXXXXXXXXXXXXXX'}),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX,
        edition: ec2.AmazonLinuxEdition.STANDARD,
        virtualization: ec2.AmazonLinuxVirt.HVM,
        storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      }),
      vpc: vpc,
//    blockDevices: [{
//	    deviceName: '/dev/sda1',
//	    volume: ec2.BlockDeviceVolume.ebs(30),
//    }],
      vpcSubnets: vpc.selectSubnets({
        subnetGroupName: 'Private',
      }),
      role: ssm_iam_role,
      userData: multipartUserData,
      securityGroup: ec2_sg,
    });

    nat_instance.connections.allowFrom(ec2_sg, ec2.Port.allTraffic());

    //---
  }
}