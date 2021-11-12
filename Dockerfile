FROM 668064706315.dkr.ecr.eu-central-1.amazonaws.com/node:16-alpine
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN npm ci
RUN npm run babel
COPY build/ ./
COPY package.json .
COPY package-lock.json .
COPY .env .
EXPOSE 3000
CMD [ "node", "index.js" ]