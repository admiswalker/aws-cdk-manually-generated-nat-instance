#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsCdkTplStack } from '../lib/aws-cdk-template-ver-single-stack-v2-stack';

const env = {
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
}

const app = new cdk.App();
const tpl_stack = new AwsCdkTplStack(app, 'AwsCdkTplStack', {
  env: env,
});
