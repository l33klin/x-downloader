#!/bin/bash

# Debug information
echo "Checking build directory..."
ls -la /app/build || echo "Build directory not found!"

echo "Checking server directory..."
ls -la /app/server

echo "Checking gallery-dl installation..."
gallery-dl --version || echo "gallery-dl not found or not working!"

# Create necessary directories with proper permissions
mkdir -p /app/server/uploads
mkdir -p /app/server/config

# Ensure directories have proper permissions for non-root users
chmod -R 777 /app/server/uploads
chmod -R 777 /app/server/config

# Check if cookies file exists and inform user
if [ ! -f "/app/server/config/cookies.txt" ]; then
    echo "Warning: cookies.txt file not found. Users will need to upload a cookies file."
fi

# Ensure download directory exists and has proper permissions
if [ -z "$DOWNLOAD_DIR" ]; then
    DOWNLOAD_DIR="/app/gallery-dl"
fi

mkdir -p "$DOWNLOAD_DIR"
chmod 777 "$DOWNLOAD_DIR"
echo "Download directory set to: $DOWNLOAD_DIR"

# Start the Node.js server
cd /app/server
node server.js
