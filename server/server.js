const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const fs = require('fs');

// Define global constants
const DEFAULT_DOWNLOAD_DIR = path.join(__dirname, '../gallery-dl');
const CONFIG_DIR = path.join(__dirname, 'config');
const GALLERY_DL_CONFIG = path.join(CONFIG_DIR, 'gallery-dl.conf');

// Get environment variables safely
const getEnv = (name, defaultValue) => {
    return typeof process !== 'undefined' && process.env && process.env[name]
        ? process.env[name]
        : defaultValue;
};

// Set download directory from environment or default
const DOWNLOAD_DIR = getEnv('DOWNLOAD_DIR', DEFAULT_DOWNLOAD_DIR);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure CORS
app.use(cors());
app.use(express.json());

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, '../build')));

// Create necessary directories if they don't exist

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create config directory
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Create download directory
if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Store active downloads
const activeDownloads = new Map();
// Define cookies path
const cookiesPath = path.join(__dirname, 'config', 'cookies.txt');

// Function to check if cookies file exists and is valid
const checkCookies = () => {
    // Check if cookies file exists
    if (!fs.existsSync(cookiesPath)) {
        return {
            valid: false,
            message: 'Cookies file not found. Please upload a cookies file from your browser to enable downloads.'
        };
    }

    // Check if cookies file is empty
    const stats = fs.statSync(cookiesPath);
    if (stats.size === 0) {
        return {
            valid: false,
            message: 'Cookies file is empty. Please upload a valid cookies file from your browser.'
        };
    }

    // Check if cookies file is too old (older than 30 days)
    const fileAge = (new Date() - stats.mtime) / (1000 * 60 * 60 * 24); // Age in days
    if (fileAge > 30) {
        return {
            valid: false,
            message: `Cookies file may be expired (${Math.floor(fileAge)} days old). Consider uploading a fresh cookies file.`
        };
    }

    return { valid: true, message: 'Cookies file is valid.' };
};
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

    // Check cookies before proceeding
    const cookieStatus = checkCookies();
    if (!cookieStatus.valid) {
        console.log('Cookie validation failed:', cookieStatus.message);
        return res.status(400).json({ error: cookieStatus.message });
    }

    // Generate a unique ID for this download
    const downloadId = Date.now().toString();
    console.log('Starting download with ID:', downloadId, 'for URL:', url);

    // Use the pre-defined download directory
    const downloadDir = DOWNLOAD_DIR;

    // Create download directory if it doesn't exist (double-check)
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }

    // Start the gallery-dl process with configuration file
    const process = spawn('gallery-dl', [
        url,
        '--verbose',
        '--config', GALLERY_DL_CONFIG,
        '-d', downloadDir  // Specify download directory
    ]);

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

    process.on('error', (error) => {
        console.error('Process error:', error);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'error',
                    downloadId,
                    message: 'Download process error: ' + error.message
                }));
            }
        });
        activeDownloads.delete(downloadId);
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

// Endpoint to check cookies status
app.get('/api/check-cookies', (req, res) => {
    const cookieStatus = checkCookies();
    res.json(cookieStatus);
});

// Endpoint to update cookies file
const upload = multer({ dest: 'uploads/' });
app.post('/api/update-cookies', upload.single('cookies'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the uploaded file and write it to the cookies path
    fs.readFile(req.file.path, (readErr, data) => {
        if (readErr) {
            console.error('Error reading uploaded file:', readErr);
            return res.status(500).json({ error: 'Failed to read uploaded file' });
        }

        // Write the cookies file
        fs.writeFile(cookiesPath, data, (writeErr) => {
            if (writeErr) {
                console.error('Error writing cookies file:', writeErr);
                return res.status(500).json({ error: 'Failed to update cookies file' });
            }

            // Clean up the uploaded file
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting temporary file:', unlinkErr);
                }
                res.status(200).json({ message: 'Cookies file updated successfully' });
            });
        });
    });
});

// Serve the React app for all other routes
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../build/index.html');
    // Check if the file exists before sending it
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error(`Error: index.html not found at ${indexPath}`);
        res.status(500).send('Server Error: Frontend files not found');
    }
});

const PORT = getEnv('PORT', 3000);
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
