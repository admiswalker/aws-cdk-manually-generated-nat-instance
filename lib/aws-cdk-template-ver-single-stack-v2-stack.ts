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

    //---
    // VPC
    /*
    const vpc = new ec2.Vpc(this, 'AwsCdkTplStackVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0,
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
    //*/
    //*
    const vpc = new ec2.Vpc(this, 'AwsCdkTplStackVPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0,
      subnetConfiguration: [],
    });
    cdk.Tags.of(vpc).add('Name', this.constructor.name+'/VPC');
    //---
    // IGW
    const igw = new ec2.CfnInternetGateway(this, "IGW", {
      tags: [{ key: "Name", value: "IGW" }]
    });
    const igwAttach = new ec2.CfnVPCGatewayAttachment(this, "IGW-attach", {
      vpcId: vpc.vpcId,
      internetGatewayId: igw.ref
    });
    //---
    // public subnets
    //*
    const publicSN1 = new ec2.CfnSubnet(this, 'publicSN1', {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.0.0/24',
      availabilityZone: this.availabilityZones[0],
      tags: [{key: 'Name', value: this.constructor.name+'/publicSN1'}]
    });
    const publicSN1_RT = new ec2.CfnRouteTable(this, "publicSN1_RT", {
      vpcId: vpc.vpcId,
      tags: [{ key: "Name", value: "publicSN1-RT" }]
    });
    const publicSN1_IGW_R = new ec2.CfnRoute(this, "publicSN1-R-IGW", {
      routeTableId: publicSN1_RT.ref,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: igw.ref
    });
    const publicSN1_association = new ec2.CfnSubnetRouteTableAssociation(this, "publicSN1-RT-association", {
      routeTableId: publicSN1_RT.ref,
      subnetId: publicSN1.ref
    });
    //---
    // private subnet
    //*
    const privateSN1 = new ec2.CfnSubnet(this, 'privateSN1', {
      vpcId: vpc.vpcId,
      cidrBlock: '10.0.1.0/24',
      availabilityZone: this.availabilityZones[0],
      tags: [{key: 'Name', value: this.constructor.name+'/privateSN1'}]
    });
    const privateSN1_RT = new ec2.CfnRouteTable(this, "privateSN1-RT", {
      vpcId: vpc.vpcId,
      tags: [{ key: "Name", value: "privateSN1-RT" }]
    });
    const privateSN1_association = new ec2.CfnSubnetRouteTableAssociation(this, "privateSN1-RT-association", {
      routeTableId: privateSN1_RT.ref,
      subnetId: privateSN1.ref
    });
    //---

    //*
    // SSM
    const nat_iam_role = new iam.Role(this, 'iam_role_for_nat_ssm', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentAdminPolicy'),
      ],
    });

    // EC2 SG
    const ec2_sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      allowAllOutbound: true,
      securityGroupName: 'EC2 Sev Security Group',
      vpc: vpc,
    });

    // NAT SG
    const nat_sg = new ec2.SecurityGroup(this, 'NatSg', {
      allowAllOutbound: true,
      securityGroupName: 'Nat Sev Security Group',
      vpc: vpc,
    });
    nat_sg.addIngressRule(ec2_sg, ec2.Port.allTraffic(), 'from EC2 SG');

    // NAT Instance
    const nat_machineImageId = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      kernel: ec2.AmazonLinuxKernel.KERNEL5_X,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    }).getImage(this).imageId;
    const nat_CfnInstance = new ec2.CfnInstance(this, 'NatInstance', {
      blockDeviceMappings: [{
        deviceName: '/dev/sdf',
        ebs: {
          deleteOnTermination: true,
          encrypted: true,
          volumeSize: 8,
          //volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3, // ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.EbsDeviceVolumeType.html
          volumeType: ec2.EbsDeviceVolumeType.STANDARD, // ref: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.EbsDeviceVolumeType.html
        }
      }],
      //imageId: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      //imageId: ec2.MachineImage.latestAmazonLinux({generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2}),
      imageId: nat_machineImageId,
      instanceType: 't3a.nano', // 2 vCPU, 0.5 GB
      securityGroupIds: [nat_sg.securityGroupId],
      sourceDestCheck: false, // Required for NAT Instance
      subnetId: publicSN1.attrSubnetId, // vpc.publicSubnets[0].subnetId,
      //subnetId: vpc.publicSubnets[0].subnetId,
      userData: cdk.Fn.base64(fs.readFileSync('./lib/ec2_nat.yaml', 'utf8')),
      tags: [{
        "key": "Name",
        "value": this.constructor.name+"/NatInstance"
      }]
    });
    const nat_instanceId = nat_CfnInstance.ref;

    // add to Private subnet Route Table
    const privateSN1_NAT_R = new ec2.CfnRoute(this, "privateSN1-RT-NAT", {
      routeTableId: privateSN1_RT.ref,
      destinationCidrBlock: "0.0.0.0/0",
      instanceId: nat_instanceId, //natGatewayId:,
    });
/*
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

    // EC2 Instance
    const cloud_config = ec2.UserData.forLinux({shebang: ''})
    const user_data_script = fs.readFileSync('./lib/ec2_user-data.yaml', 'utf8');
    cloud_config.addCommands(user_data_script)
    const multipartUserData = new ec2.MultipartUserData();
    multipartUserData.addPart(ec2.MultipartBody.fromUserData(cloud_config, 'text/cloud-config; charset="utf8"'));
    
//    const ec2_sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
//      allowAllOutbound: true,
//      securityGroupName: 'EC2 Sev Security Group',
//      vpc: vpc,
//    });
    
    const ec2_instance = new ec2.Instance(this, 'General_purpose_ec2', {
      instanceType: new ec2.InstanceType('t3a.nano'), // 2 vCPU, 0.5 GB
//    machineImage: ec2.MachineImage.genericLinux({'us-west-2': 'ami-XXXXXXXXXXXXXXXXX'}),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        edition: ec2.AmazonLinuxEdition.STANDARD,
        virtualization: ec2.AmazonLinuxVirt.HVM,
        storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      }),
      vpc: vpc,
//    blockDevices: [{
//	    deviceName: '/dev/sda1',
//	    volume: ec2.BlockDeviceVolume.ebs(30),
//    }],
      vpcSubnets: vpc.selectSubnets({subnets: privateSubnet1}), //vpc.selectSubnets({subnetGroupName: 'Private',}),
      //vpcSubnets: vpc.selectSubnets({subnetGroupName: 'Private',}),
      role: ssm_iam_role,
      userData: multipartUserData,
      securityGroup: ec2_sg,
    });

    //nat_instance.connections.allowFrom(ec2_sg, ec2.Port.allTraffic());
    //*/

    //---
  }
}
