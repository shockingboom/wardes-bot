FROM node:20-alpine

# Install dependencies untuk runtime (Chromium dan font)
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

# Set environment variables untuk Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/

# Buat user non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package.json dan package-lock.json
COPY ./package*.json ./

# Install hanya dependencies production
RUN npm install --production && \
    npm cache clean --force

# Copy seluruh source code JS
COPY --chown=nodejs:nodejs . .

# Buat direktori tambahan
RUN mkdir -p /app/logs /app/.wwebjs_auth /app/.wwebjs_cache && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 6666

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start aplikasi langsung dari JS
CMD ["node", "src/index.js"]
