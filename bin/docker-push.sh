#!/usr/bin/env bash

region=eu-central-1
aws_account_id=668064706315
repository=creasury
tag=latest

docker tag creasury-bot:${tag} ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/${repository}:${tag}
docker push ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/${repository}:${tag}