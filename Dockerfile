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

# Copy package.json & package-lock.json
COPY ./package*.json ./

# Install dependencies production
RUN npm install --production && \
    npm cache clean --force

# Copy seluruh source code termasuk src/
COPY --chown=nodejs:nodejs ./src ./src

# Buat direktori tambahan
RUN mkdir -p /app/logs /app/.wwebjs_auth /app/.wwebjs_cache && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 6666

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Jalankan file JS utama
CMD ["node", "index.js"]
