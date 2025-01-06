import React, { useState, useEffect, useCallback } from 'react';
import './Downloader.css';

const WS_URL = 'ws://localhost:3001';
const API_URL = 'http://localhost:3001/api';

interface DownloadStatus {
    downloadId: string;
    status: 'downloading' | 'completed' | 'error';
    message: string;
}

const Downloader: React.FC = () => {
    const [url, setUrl] = useState('');
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [downloads, setDownloads] = useState<DownloadStatus[]>([]);
    const [error, setError] = useState<string>('');

    // Initialize WebSocket connection
    useEffect(() => {
        const websocket = new WebSocket(WS_URL);
        
        websocket.onopen = () => {
            console.log('WebSocket Connected');
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data);
            setDownloads(prev => {
                const index = prev.findIndex(d => d.downloadId === data.downloadId);
                const newDownload: DownloadStatus = {
                    downloadId: data.downloadId,
                    status: data.type === 'complete' ? 'completed' : 
                           data.type === 'error' ? 'error' : 'downloading',
                    message: data.message || ''
                };

                if (index === -1) {
                    return [...prev, newDownload];
                }

                const newDownloads = [...prev];
                newDownloads[index] = newDownload;
                return newDownloads;
            });
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            setError('WebSocket connection error');
        };

        setWs(websocket);

        return () => {
            websocket.close();
        };
    }, []);

    const handleDownload = async () => {
        if (!url) return;

        console.log('Starting download for URL:', url);
        setError('');

        try {
            const response = await fetch(`${API_URL}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            console.log('Download response:', response);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Download failed to start');
            }

            const { downloadId } = await response.json();
            console.log('Download started with ID:', downloadId);
            
            setDownloads(prev => [...prev, {
                downloadId,
                status: 'downloading',
                message: 'Starting download...'
            }]);
            
            setUrl('');
        } catch (error) {
            console.error('Error starting download:', error);
            setError(error instanceof Error ? error.message : 'Failed to start download');
        }
    };

    const handleCancel = async (downloadId: string) => {
        try {
            const response = await fetch(`${API_URL}/cancel/${downloadId}`, {
                method: 'POST',
            });
            
            if (!response.ok) {
                throw new Error('Failed to cancel download');
            }
        } catch (error) {
            console.error('Error canceling download:', error);
            setError('Failed to cancel download');
        }
    };

    return (
        <div className="downloader">
            <div className="input-section">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Enter URL to download"
                    className="url-input"
                />
                <button onClick={handleDownload} disabled={!url}>
                    Download
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="downloads-list">
                {downloads.map((download) => (
                    <div key={download.downloadId} className={`download-item ${download.status}`}>
                        <div className="download-info">
                            <span className="status">{download.status}</span>
                            <pre className="message">{download.message}</pre>
                        </div>
                        {download.status === 'downloading' && (
                            <button 
                                onClick={() => handleCancel(download.downloadId)}
                                className="cancel-button"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Downloader;
