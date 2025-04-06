# Build stage for React frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app

# Install dependencies including devDependencies
COPY package*.json ./
RUN npm install --quiet

# Copy source and build
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Server dependencies stage
FROM node:18-alpine AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm install --quiet --only=production

# Final stage
FROM python:3.9-slim
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production \
    DOWNLOAD_DIR="/app/gallery-dl"

# Install Node.js
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install gallery-dl
RUN pip install --no-cache-dir gallery-dl

# Create necessary directories
RUN mkdir -p /app/server/config /app/server/uploads /app/gallery-dl

# Copy server files
COPY --from=server-build /app/node_modules /app/server/node_modules
COPY server/server.js /app/server/

# Copy frontend files
COPY --from=frontend-build /app/build /app/build

# Copy config files
COPY server/config/gallery-dl.conf /app/server/config/
# Note: cookies.txt will be uploaded by the user

# Copy start script
COPY docker-start.sh ./
RUN chmod +x docker-start.sh

EXPOSE 3000

CMD ["./docker-start.sh"]
