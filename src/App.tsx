import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Progress, Card, message, Alert } from 'antd';
import { InputRef } from 'antd/es/input';
import { DownloadOutlined, CaretRightOutlined } from '@ant-design/icons';
import './App.css';

interface DownloadRecord {
  id: string;
  url: string;
  status: 'downloading' | 'completed' | 'error';
  progress: number;
  timestamp: string;
  message?: string;
  logs: string[];
  isLogExpanded: boolean;
}

interface CookieStatus {
  valid: boolean;
  message: string;
}

const API_URL = '/api';
const WS_URL = `ws://${window.location.host}`;

function App() {
  const [url, setUrl] = useState('');
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  // We don't need to track the file state as it can cause issues with file inputs
  // const [file, setFile] = useState<File | null>(null);
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState<number>(0); // Add a key to force re-render of file input

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Check cookies status on component mount and set up periodic checks
  useEffect(() => {
    // Check immediately on load
    checkCookiesStatus();

    // Set up periodic checks every 5 minutes
    const intervalId = setInterval(checkCookiesStatus, 5 * 60 * 1000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  const checkCookiesStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/check-cookies`);
      const data = await response.json();
      setCookieStatus(data);

      // Only show warning on initial load, not during re-checks
      if (!data.valid && !cookieStatus) {
        message.warning(data.message);
      }
      return data; // Return the status for use in other functions
    } catch (error) {
      console.error('Error checking cookies status:', error);
      const errorStatus = {
        valid: false,
        message: 'Failed to check cookies status. Please ensure the server is running.'
      };
      setCookieStatus(errorStatus);
      return errorStatus;
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('WebSocket Connected');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);

      setRecords(prev => prev.map(record => {
        if (record.id === data.downloadId) {
          const newStatus = data.type === 'complete' ? 'completed' :
                          data.type === 'error' ? 'error' : 'downloading';

          // Add message to logs for both progress and error messages
          const newLogs = [...record.logs];
          if (data.message && (data.type === 'progress' || data.type === 'error')) {
            newLogs.push(data.message);
          }

          return {
            ...record,
            status: newStatus,
            message: data.message,
            progress: data.type === 'complete' ? 100 :
                     data.type === 'error' ? 100 : record.progress,
            logs: newLogs,
            // Keep logs expanded on error, otherwise follow current state
            isLogExpanded: newStatus === 'error' ? true :
                          data.type === 'complete' ? false : record.isLogExpanded
          };
        }
        return record;
      }));
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      message.error('Connection error occurred');
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      // Implement reconnection logic here
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const handleDownload = async () => {
    if (!url.includes('x.com')) {
      message.error('Please enter a valid X.com URL');
      return;
    }

    // Check cookies status before downloading
    if (cookieStatus && !cookieStatus.valid) {
      message.error(cookieStatus.message);
      return;
    }

    const newRecord: DownloadRecord = {
      id: Date.now().toString(),
      url,
      status: 'downloading',
      progress: 0,
      timestamp: new Date().toLocaleString(),
      logs: [],
      isLogExpanded: true
    };

    setRecords(prev => [newRecord, ...prev]);
    setUrl('');

    try {
      const response = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed to start');
      }

      const { downloadId } = await response.json();

      // Update the record with the server-provided ID
      setRecords(prev => prev.map(record =>
        record.id === newRecord.id
          ? { ...record, id: downloadId }
          : record
      ));

    } catch (error) {
      console.error('Error starting download:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start download';
      message.error(errorMessage);

      setRecords(prev => prev.map(record =>
        record.id === newRecord.id
          ? {
              ...record,
              status: 'error',
              message: errorMessage,
              progress: 100,
              isLogExpanded: true,
              logs: [...record.logs, `Failed to start download: ${errorMessage}`]
            }
          : record
      ));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const selectedFile = event.target.files[0];
        // Don't set file state to avoid issues with file input
        // setFile(selectedFile);

        const formData = new FormData();
        formData.append('cookies', selectedFile);

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/update-cookies`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                // Re-check cookies status after update
                const newStatus = await checkCookiesStatus();
                // Show appropriate message based on validation result
                if (newStatus && newStatus.valid) {
                    message.success('Cookies file updated and validated successfully. You can now download media.');
                } else {
                    message.warning('Cookies file updated but validation failed. Please try another cookies file.');
                }
            } else {
                message.error('Failed to update cookies file.');
            }
        } catch (error) {
            console.error('Error uploading cookies file:', error);
            message.error('An error occurred while uploading the file.');
        } finally {
            setLoading(false);
            // Increment the key to force React to re-render the file input
            // This is the most reliable way to reset a file input in React
            setFileInputKey(prevKey => prevKey + 1);
            console.log('File input reset by incrementing key');
        }
    }
  };

  const toggleLogs = (recordId: string) => {
    setRecords(prev => prev.map(record =>
      record.id === recordId
        ? { ...record, isLogExpanded: !record.isLogExpanded }
        : record
    ));
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>X-Downloader</h1>
        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <Button
            type="primary"
            onClick={handleButtonClick}
            loading={loading}
          >
            Upload Cookies File
          </Button>
          <input
            key={fileInputKey} // Add key to force re-render when it changes
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="text/plain"
            style={{ display: 'none' }}
          />
        </div>
      </header>
      <main className="App-main">
        {cookieStatus && !cookieStatus.valid && (
          <Alert
            message="Cookies Required"
            description={cookieStatus.message}
            type="warning"
            showIcon
            action={
              <Button size="small" type="primary" onClick={handleButtonClick}>
                Upload Cookies
              </Button>
            }
            style={{ marginBottom: '20px' }}
          />
        )}

        {/* 根据需求，当cookies有效时不显示状态提示 */}

        <Card className="download-card">
          <div className="input-section">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter X.com URL"
              size="large"
              className="url-input"
            />
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              disabled={!url || (cookieStatus !== null && !cookieStatus.valid)}
              size="large"
            >
              Download
            </Button>
          </div>
        </Card>

        <div className="history-section">
          <h2>Download History</h2>
          <List
            className="download-list"
            dataSource={records}
            renderItem={(record) => (
              <Card className="download-item">
                <div className="record-content">
                  <div className="record-info">
                    <div className="url">{record.url}</div>
                    <div className="timestamp">{record.timestamp}</div>
                    <div className="progress-section">
                      <Progress
                        percent={record.progress}
                        status={record.status === 'error' ? 'exception' :
                               record.status === 'completed' ? 'success' : 'active'}
                        strokeColor={record.status === 'error' ? '#ff4d4f' : undefined}
                      />
                      <div className={`download-status ${record.status}`}>
                        {record.status}
                      </div>
                    </div>
                    {record.logs.length > 0 && (
                      <div className="logs-section">
                        <Button
                          type="text"
                          icon={<CaretRightOutlined rotate={record.isLogExpanded ? 90 : 0} />}
                          onClick={() => toggleLogs(record.id)}
                          className="toggle-logs-btn"
                        >
                          {record.isLogExpanded ? 'Hide Logs' : 'Show Logs'}
                        </Button>
                        {record.isLogExpanded && (
                          <div className={`logs-content ${record.status === 'error' ? 'error' : ''}`}>
                            {record.logs.map((log, index) => (
                              <div key={index} className="log-line">
                                {log}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {record.message && (
                      <div className={`download-message ${record.status === 'error' ? 'error' : ''}`}>
                        {record.message}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
