FROM 668064706315.dkr.ecr.eu-central-1.amazonaws.com/node:16-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY . .
RUN npm ci
RUN npm run babel

EXPOSE 3000

CMD [ "node", "./build/index.js" ]