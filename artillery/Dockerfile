FROM node:22-alpine

# Artillery at a fixed version, so a rebuild gives the same runner. Its
# metrics go to Telegraf through the publish-metrics plugin bundled with it.
RUN npm install -g artillery@2.0.34

WORKDIR /artillery

ENTRYPOINT ["artillery"]
