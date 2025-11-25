FROM node:18-slim

# Install dependencies required by Chromium
RUN apt-get update && apt-get install -y \
  wget \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgdk-pixbuf2.0-0 \
  libnspr4 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  libgbm1 \
  libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

# Workdir dan copy app
WORKDIR /usr/src/app
COPY . .

# Install dependencies
RUN npm install

# Start app
CMD ["npm", "start"]
