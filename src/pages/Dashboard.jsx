import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import './Dashboard.css';

const Dashboard = () => {
  const { auth } = useAuth();
  const [recentSessions, setRecentSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState('');
  const [stats, setStats] = useState({ makes: 0, misses: 0, accuracy: 'N/A', fastest21: 'N/A' });
  const [leaderboards, setLeaderboards] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.player?.player_id) {
        // Don't fetch if we don't have the player ID yet.
        // The error message will be shown if the fetch fails.
        return;
      }
      try {
        // This is a guess of the API endpoint, adjust if necessary
        const sessionsRes = await api.get(`/sessions/player/${auth.player.player_id}/recent`);
        setRecentSessions(sessionsRes.data);
        setSessionsError('');
      } catch (err) {
        console.error('Failed to load recent sessions:', err);
        setSessionsError('Failed to load recent sessions');
      }

      // Other fetches for stats, leaderboards etc. would go here
    };

    fetchDashboardData();
  }, [auth.player]);

  return (
    <main className="dashboard-main">
      <div className="dashboard-actions">
        <button className="btn btn-secondary" title="View and manage friends & contacts">
          CONTACTS
        </button>
        <button className="btn btn-tertiary" title="Sync with desktop app">
          SYNC
        </button>
        {sessionsError && <p className="error-message">{sessionsError}</p>}
      </div>

      <div className="stats-summary-bar">
        <h2>All-Time Stats</h2>
      </div>
      <div className="dashboard-grid">
        <div className="stats-card">
          <h3>Makes</h3>
          <p className="stat-value">{stats.makes}</p>
        </div>
        <div className="stats-card">
          <h3>Misses</h3>
          <p className="stat-value">{stats.misses}</p>
        </div>
        <div className="stats-card">
          <h3>Accuracy</h3>
          <p className="stat-value">{stats.accuracy}</p>
        </div>
        <div className="stats-card">
          <h3>Fastest 21</h3>
          <p className="stat-value">{stats.fastest21}</p>
        </div>
      </div>

      <div className="session-list-container ">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Session History</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link to={`/player/${auth.player?.player_id}/stats`} className="btn btn-secondary">Career Stats</Link>
            <Link to={`/player/${auth.player?.player_id}/sessions`} className="btn btn-secondary">Full History</Link>
          </div>
        </div>
        <div className="session-table-wrapper">
          <table className="session-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Details</th>
                <th>Session Date</th>
                <th>Duration</th>
                <th>Makes</th>
                <th>Misses</th>
                <th>Best Streak</th>
                <th>Fastest 21</th>
                <th>PPM</th>
                <th>MPM</th>
                <th>Most in 60s</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.length > 0 ? (
                recentSessions.map(session => (
                  <tr key={session.id}>{/* ... session data ... */}</tr>
                ))
              ) : (
                <tr className="table-placeholder-row">
                  <td colSpan="10">No sessions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="leaderboard-container">
        <div className="leaderboard-summary-bar">
          <h2>Leaderboard</h2>
        </div>
        <div className="leaderboard-grid">
          <p>Loading leaderboards...</p>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;