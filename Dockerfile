# Build stage for React frontend
FROM node:18 AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Final stage
FROM node:18-slim
WORKDIR /app

# Install gallery-dl
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    pip3 install gallery-dl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy server files
COPY server/package*.json ./server/
RUN cd server && npm install --production

COPY server/server.js ./server/

# Copy built frontend files
COPY --from=frontend-build /app/build ./public

# Copy start script
COPY docker-start.sh ./
RUN chmod +x docker-start.sh

EXPOSE 3001

CMD ["./docker-start.sh"]
