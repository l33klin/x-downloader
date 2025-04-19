# X-Downloader

A web application for downloading media from X.com (formerly Twitter) using gallery-dl.

## Features

- Simple and modern UI built with React and Ant Design
- Real-time download progress updates via WebSocket
- Expandable command-line output logs
- Docker support for easy deployment
- Cookie-based authentication for X.com downloads

## Prerequisites

- Node.js 18 or higher
- Python 3.x (for gallery-dl)
- gallery-dl (`pip install gallery-dl`)

## Development Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Start the development server:
```bash
# Terminal 1: Start frontend
npm start

# Terminal 2: Start backend
cd server
node server.js
```

The application will be available at http://localhost:3000

## Docker Deployment

Build and run using Docker:

```bash
# Build the image
docker build -t x-downloader .

# Run the container
docker run -p 3000:3000 x-downloader

# Run the container with a non-root user
docker run -p 3000:3000 --user $(id -u):$(id -g) x-downloader
```

### Cookies Authentication

The application requires a valid cookies file from your browser to authenticate with X.com. When you first start the application, you will be prompted to upload a cookies file. This file is not persisted between container restarts, so you will need to upload it again each time you restart the container.

To get a cookies file:
1. Log in to X.com in your browser
2. Use a browser extension like "Cookie-Editor" to export your cookies as a text file
3. Upload this file through the application interface

### Mounting Download Directory

By default, gallery-dl saves downloaded files inside the container. To persist these files on your local machine, you can mount a volume:

```bash
# Run with a mounted volume for downloads
docker run -p 3000:3000 -v $(pwd)/downloads:/app/gallery-dl x-downloader

# Alternatively, you can specify a custom download directory using environment variable
docker run -p 3000:3000 -e DOWNLOAD_DIR=/app/custom-downloads -v $(pwd)/downloads:/app/custom-downloads x-downloader
```

This will map the `downloads` directory in your current location to the `/app/gallery-dl` directory inside the container, where downloaded files will be stored.

### Running with Non-Root Users

The container is configured to work with non-root users. You can run the container with your current user ID and group ID:

```bash
# Run with your current user ID and group ID
docker run -p 3000:3000 --user $(id -u):$(id -g) x-downloader

# Run with your current user and a mounted volume
docker run -p 3000:3000 --user $(id -u):$(id -g) -v $(pwd)/downloads:/app/gallery-dl x-downloader
```

This ensures that all files created by the container will be owned by your user, and the application will have the necessary permissions to function correctly.

**Note for Windows users:** When using Command Prompt or PowerShell, replace `$(pwd)` with the absolute path or use `%cd%` (CMD) or `${PWD}` (PowerShell):

```bash
# Command Prompt
docker run -p 3000:3000 -v %cd%\downloads:/app/gallery-dl x-downloader

# PowerShell
docker run -p 3000:3000 -v ${PWD}\downloads:/app/gallery-dl x-downloader

# With custom download directory (PowerShell)
docker run -p 3000:3000 -e DOWNLOAD_DIR=/app/custom-downloads -v ${PWD}\downloads:/app/custom-downloads x-downloader
```

### Using Custom Configuration

If you have a custom gallery-dl configuration file, you can mount it as well:

```bash
# Run with mounted downloads directory and custom configuration
docker run -p 3000:3000 \
  -v $(pwd)/downloads:/app/gallery-dl \
  -v $(pwd)/gallery-dl.conf:/app/server/config/gallery-dl.conf \
  x-downloader
```

Access the application at http://localhost:3000

## Project Structure

- `/src` - Frontend React application
- `/server` - Backend Node.js server
- `/public` - Static files
- `/gallery-dl` - Default download directory for media files
- `/server/config` - Configuration files including cookies
- `Dockerfile` - Docker configuration
- `docker-start.sh` - Docker entry point script

## License

MIT
