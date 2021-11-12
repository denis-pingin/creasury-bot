#!/usr/bin/env bash

region=eu-central-1
aws_account_id=668064706315
image=creasury-bot
tag=latest

docker tag ${image}:${tag} ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/${image}:${tag}
docker push ${aws_account_id}.dkr.ecr.${region}.amazonaws.com/${image}:${tag}