import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DebugPlayerPage = () => {
  const { playerData } = useAuth();
  const [debugData, setDebugData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');

        const response = await fetch('https://app.proofofputt.com/api/debug/check-player', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch debug info');
        }

        setDebugData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (playerData) {
      fetchDebugInfo();
    }
  }, [playerData]);

  if (loading) {
    return <div style={{ padding: '20px', color: 'white' }}>Loading debug information...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '20px', color: 'white', fontFamily: 'monospace' }}>
      <h1>Player Debug Information</h1>
      <pre style={{
        backgroundColor: '#1a1a1a',
        padding: '20px',
        borderRadius: '8px',
        overflow: 'auto',
        maxHeight: '80vh'
      }}>
        {JSON.stringify(debugData, null, 2)}
      </pre>

      {debugData && !debugData.player_exists && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#ff4444',
          borderRadius: '8px'
        }}>
          <h2>⚠️ PROBLEM FOUND</h2>
          <p>Your player record (ID: {debugData.jwt_payload?.playerId}) does not exist in the players table!</p>
          <p>This is why you cannot create leagues - the foreign key constraint fails.</p>
        </div>
      )}

      {debugData && debugData.player_exists && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#44ff44',
          color: 'black',
          borderRadius: '8px'
        }}>
          <h2>✓ Player Record Found</h2>
          <p>Your player record exists in the database. If you still can't create leagues, there may be a different issue.</p>
        </div>
      )}
    </div>
  );
};

export default DebugPlayerPage;
