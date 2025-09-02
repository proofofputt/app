import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ContactsModal from './ContactsModal';
import SessionRow from './SessionRow';
import LeaderboardCard from './LeaderboardCard';
import './Dashboard.css';

const StatCard = ({ title, value }) => (
  <div className="stats-card">
    <h3>{title}</h3>
    <p className="stat-value">{value ?? 'N/A'}</p>
  </div>
);

function Dashboard() {
  const { playerData, logout } = useAuth();
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const tableWrapperRef = useRef(null);

  // This effect manages the height of the session table container
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    if (expandedSessionId) {
      const header = wrapper.querySelector('.session-table thead');
      const parentRow = wrapper.querySelector('.session-table tr.is-expanded-parent');
      const detailsRow = wrapper.querySelector('.session-table .session-details-row');

      if (header && parentRow && detailsRow) {
        const requiredHeight = header.offsetHeight + parentRow.offsetHeight + detailsRow.offsetHeight + 2;
        wrapper.style.maxHeight = `${requiredHeight}px`;
        wrapper.scrollTop = parentRow.offsetTop - header.offsetHeight;
      }
    } else {
      wrapper.style.maxHeight = null;
    }
  }, [expandedSessionId]);

  const handleToggleExpand = (sessionId) => {
    setExpandedSessionId(prevId => (prevId === sessionId ? null : sessionId));
  };

  // Mock data for now - will be replaced with real API calls
  const mockStats = {
    total_makes: 150,
    total_misses: 50,
    fastest_21_makes: 45.2
  };

  const mockSessions = [
    {
      session_id: 1,
      created_at: new Date().toISOString(),
      duration: 300,
      total_makes: 25,
      total_misses: 8,
      best_streak: 12,
      fastest_21_makes: 45.2,
      putts_per_minute: 6.6,
      makes_per_minute: 5.0,
      most_makes_in_60_seconds: 15
    }
  ];

  const totalPutts = (mockStats.total_makes || 0) + (mockStats.total_misses || 0);
  const makePercentage = totalPutts > 0 ? ((mockStats.total_makes / totalPutts) * 100).toFixed(1) + '%' : 'N/A';

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Proof of Putt</h1>
          <div className="header-actions">
            <span className="welcome-text">Welcome, {playerData?.name}!</span>
            <button 
              onClick={() => setIsContactsModalOpen(true)}
              className="btn btn-secondary"
              title="View and manage friends & contacts"
            >
              CONTACTS
            </button>
            <button 
              onClick={logout}
              className="btn btn-outline"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-actions">
          <button className="btn btn-orange">Start New Session</button>
          <button className="btn btn-secondary">Calibrate Camera</button>
          <button className="btn btn-tertiary">Refresh Data</button>
          {actionError && <p className="error-message">{actionError}</p>}
        </div>

        <div className="stats-summary-bar">
          <h2>All-Time Stats</h2>
        </div>
        <div className="dashboard-grid">
          <StatCard title="Makes" value={mockStats.total_makes} />
          <StatCard title="Misses" value={mockStats.total_misses} />
          <StatCard title="Accuracy" value={makePercentage} />
          <StatCard title="Fastest 21" value={mockStats.fastest_21_makes ? `${mockStats.fastest_21_makes.toFixed(2)}s` : 'N/A'} />
        </div>
        
        <div className={`session-list-container ${expandedSessionId ? 'is-expanded' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Session History</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to={`/player/${playerData?.id}/stats`} className="btn btn-secondary">Career Stats</Link>
              <Link to={`/player/${playerData?.id}/sessions`} className="btn btn-secondary">Full History</Link>
            </div>
          </div>
          <div className="session-table-wrapper" ref={tableWrapperRef}>
            <table className="session-table">
              <thead>
                <tr><th style={{ width: '120px' }}>Details</th><th>Session Date</th><th>Duration</th><th>Makes</th><th>Misses</th><th>Best Streak</th><th>Fastest 21</th><th>PPM</th><th>MPM</th><th>Most in 60s</th></tr>
              </thead>
              <tbody>
                {mockSessions && mockSessions.length > 0 ? (
                  mockSessions.map((session) => (
                    <SessionRow
                      key={session.session_id}
                      session={session}
                      playerTimezone="UTC"
                      isLocked={false}
                      isExpanded={expandedSessionId === session.session_id}
                      onToggleExpand={handleToggleExpand}
                    />
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
              {leaderboardData ? (
                  <>
                      <LeaderboardCard title="Most Makes" leaders={leaderboardData.top_makes} />
                      <LeaderboardCard title="Best Streak" leaders={leaderboardData.top_streaks} />
                      <LeaderboardCard title="Makes/Min" leaders={leaderboardData.top_makes_per_minute} />
                      <LeaderboardCard title="Fastest 21" leaders={leaderboardData.fastest_21} />
                  </>
              ) : (
                  <p>Loading leaderboards...</p>
              )}
          </div>
        </div>
      </main>

      {isContactsModalOpen && (
        <ContactsModal 
          isOpen={isContactsModalOpen}
          onClose={() => setIsContactsModalOpen(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;