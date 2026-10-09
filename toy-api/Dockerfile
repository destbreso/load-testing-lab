FROM node:22-alpine

WORKDIR /app

# Install exactly the versions in the lockfile
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY src ./src

CMD ["node", "src/index.js"]
