FROM node:20-alpine

# Build tools needed for sharp, canvas, etc.
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p uploads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
