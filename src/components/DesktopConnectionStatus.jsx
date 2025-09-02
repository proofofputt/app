import React, { useState, useEffect } from 'react';
import './ConnectionStatus.css';
import { apiCheckDesktopStatus } from '@/api.js';

const DesktopConnectionStatus = ({ onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const status = await apiCheckDesktopStatus();
      setIsConnected(status.connected);
      onConnectionChange?.(status.connected);
      setLastCheck(new Date());
    } catch (error) {
      console.log('Desktop app not connected:', error.message);
      setIsConnected(false);
      onConnectionChange?.(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    // Check periodically in case desktop app is launched
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [onConnectionChange]);

  if (isConnected) {
    return null; // Don't show anything when connected
  }

  const handleDownload = () => {
    // Open GitHub releases page for desktop app downloads
    window.open('https://github.com/proofofputt/app/releases', '_blank');
  };

  const handleCheckConnection = async () => {
    await checkConnection();
    
    if (isConnected) {
      alert('Desktop app connected! Session controls are now available.');
    } else {
      alert('Desktop app not detected. Please ensure the desktop application is running and try again.');
    }
  };

  return (
    <div className="connection-status disconnected">
      <div className="status-header">
        <span className="status-indicator">🔴</span>
        <span>Desktop App Required</span>
      </div>
      <p>To start sessions and calibrate your camera, you need the desktop application.</p>
      
      <div className="action-buttons">
        <button onClick={handleDownload} className="btn btn-primary">
          Download Desktop App
        </button>
        <button 
          onClick={handleCheckConnection} 
          className="btn btn-secondary"
          disabled={isChecking}
        >
          {isChecking ? 'Checking...' : 'Check Connection'}
        </button>
      </div>
      
      <details className="help-details">
        <summary>Need help connecting?</summary>
        <ol>
          <li>Download and install the Proof of Putt desktop app</li>
          <li>Launch the desktop application</li>
          <li>The desktop app will open this web interface automatically</li>
          <li>Session controls will become available</li>
        </ol>
      </details>
    </div>
  );
};

export default DesktopConnectionStatus;