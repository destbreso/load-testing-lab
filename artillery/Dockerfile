FROM node:20-alpine

# Instalar Artillery y el plugin de StatsD
RUN npm install -g artillery artillery-plugin-statsd

WORKDIR /artillery

ENTRYPOINT ["artillery"]
