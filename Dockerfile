FROM node:16-alpine
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . .
RUN npm ci
EXPOSE 3000
CMD [ "babel-node", "./src/index.js" ]