#!/usr/bin/env bash

region=eu-central-1
aws_account_id=668064706315

aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${region}.amazonaws.com