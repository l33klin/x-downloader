import React, { useState, useEffect } from 'react';
import { Input, Button, List, Progress, Card, message, Collapse } from 'antd';
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

const API_URL = '/api';
const WS_URL = `ws://${window.location.host}`;

function App() {
  const [url, setUrl] = useState('');
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

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
        throw new Error('Download failed to start');
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
      message.error('Failed to start download');
      
      setRecords(prev => prev.map(record => 
        record.id === newRecord.id 
          ? { 
              ...record, 
              status: 'error', 
              message: 'Failed to start download',
              progress: 100,
              isLogExpanded: true,
              logs: [...record.logs, 'Failed to start download: Network error']
            }
          : record
      ));
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
      </header>
      <main className="App-main">
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
              disabled={!url}
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
