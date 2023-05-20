#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsCdkTemplateVerSingleStackV2Stack } from '../lib/aws-cdk-template-ver-single-stack-v2-stack';

const app = new cdk.App();
new AwsCdkTemplateVerSingleStackV2Stack(app, 'AwsCdkTemplateVerSingleStackV2Stack');
