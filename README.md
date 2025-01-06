# X-Downloader

A web application for downloading media from X.com (formerly Twitter) using gallery-dl.

## Features

- Simple and modern UI built with React and Ant Design
- Real-time download progress updates via WebSocket
- Expandable command-line output logs
- Docker support for easy deployment

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
docker run -p 3001:3001 x-downloader
```

Access the application at http://localhost:3001

## Project Structure

- `/src` - Frontend React application
- `/server` - Backend Node.js server
- `/public` - Static files
- `Dockerfile` - Docker configuration
- `docker-start.sh` - Docker entry point script

## License

MIT
