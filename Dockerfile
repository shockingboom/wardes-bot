FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto-emoji \
    wqy-zenhei \
    tini \
    dumb-init

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY ./package*.json ./
RUN npm install --production && npm cache clean --force

COPY --chown=nodejs:nodejs . .

RUN mkdir -p /app/logs /app/.wwebjs_auth /app/.wwebjs_cache && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 6666

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "index.js"]
