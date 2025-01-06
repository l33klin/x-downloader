const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure CORS
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Store active downloads
const activeDownloads = new Map();

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Download endpoint
app.post('/api/download', (req, res) => {
    console.log('Received download request:', req.body);
    const { url } = req.body;
    
    if (!url) {
        console.log('URL is missing in request');
        return res.status(400).json({ error: 'URL is required' });
    }

    // Generate a unique ID for this download
    const downloadId = Date.now().toString();
    console.log('Starting download with ID:', downloadId, 'for URL:', url);

    // Start the gallery-dl process
    const process = spawn('gallery-dl', [url]);
    
    // Store the process
    activeDownloads.set(downloadId, process);

    // Handle process output
    process.stdout.on('data', (data) => {
        const message = data.toString();
        console.log('Download progress:', message);
        // Broadcast progress to all connected clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'progress',
                    downloadId,
                    message
                }));
            }
        });
    });

    process.stderr.on('data', (data) => {
        const message = data.toString();
        console.error('Download error:', message);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'error',
                    downloadId,
                    message
                }));
            }
        });
    });

    process.on('close', (code) => {
        console.log('Download process closed with code:', code);
        const status = code === 0 ? 'complete' : 'error';
        const message = code === 0 ? 'Download completed successfully' : `Download failed with exit code ${code}`;
        
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: status,
                    downloadId,
                    code,
                    message
                }));
            }
        });
        activeDownloads.delete(downloadId);
    });

    res.json({ downloadId });
});

// Cancel download endpoint
app.post('/api/cancel/:downloadId', (req, res) => {
    const { downloadId } = req.params;
    console.log('Attempting to cancel download:', downloadId);
    
    const process = activeDownloads.get(downloadId);
    
    if (process) {
        process.kill();
        activeDownloads.delete(downloadId);
        console.log('Download cancelled:', downloadId);
        
        // Notify clients about the cancellation
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'error',
                    downloadId,
                    message: 'Download cancelled by user'
                }));
            }
        });
        
        res.json({ message: 'Download cancelled' });
    } else {
        console.log('Download not found:', downloadId);
        res.status(404).json({ error: 'Download not found' });
    }
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
