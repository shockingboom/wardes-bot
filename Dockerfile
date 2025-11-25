FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    dumb-init

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm install --production && npm cache clean --force

COPY . .

RUN mkdir -p /data

USER node

EXPOSE 6666

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "index.js"]
