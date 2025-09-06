import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { apiGetLeaderboard } from '../api';
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
  const { playerData, playerTimezone, refreshData, isLoading } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
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

  // Load leaderboard data
  useEffect(() => {
    const fetchLeaderboards = async () => {
      try {
        const results = await Promise.allSettled([
          apiGetLeaderboard({ metric: 'total_makes' }),
          apiGetLeaderboard({ metric: 'best_streak' }),
          apiGetLeaderboard({ metric: 'makes_per_minute' }),
          apiGetLeaderboard({ metric: 'fastest_21_makes_seconds' }),
        ]);

        const [topMakesResult, topStreaksResult, topMpmResult, fastest21Result] = results;

        const newLeaderboardData = {
          top_makes: topMakesResult.status === 'fulfilled' ? topMakesResult.value?.leaderboard ?? [] : [],
          top_streaks: topStreaksResult.status === 'fulfilled' ? topStreaksResult.value?.leaderboard ?? [] : [],
          top_makes_per_minute: topMpmResult.status === 'fulfilled' ? topMpmResult.value?.leaderboard ?? [] : [],
          fastest_21: fastest21Result.status === 'fulfilled' ? fastest21Result.value?.leaderboard ?? [] : [],
        };
        setLeaderboardData(newLeaderboardData);
      } catch (error) {
        console.error("Could not fetch leaderboard data:", error);
      }
    };

    fetchLeaderboards();
  }, []); // Run once on mount

  const handleRefreshClick = () => {
    setActionError('');
    refreshData(playerData.player_id);
    showNotification('Data refreshed!');
  };

  const handleSyncDesktop = () => {
    // TODO: Implement desktop app sync functionality
    console.log('Syncing with desktop app...');
  };

  if (isLoading) {
    return <p>Loading player data...</p>;
  }

  if (!playerData) {
    return (
      <div>
        <p>Unable to load player data. Please try refreshing the page.</p>
        <button onClick={() => window.location.reload()}>Refresh Page</button>
      </div>
    );
  }

  if (!playerData.stats) {
    console.error('Player data missing stats:', playerData);
    return (
      <div>
        <p>Player data is incomplete (missing stats). This might be a temporary issue.</p>
        <button onClick={() => refreshData(playerData.player_id)}>Retry Loading Data</button>
        <details style={{marginTop: '10px', fontSize: '12px'}}>
          <summary>Debug Info</summary>
          <pre>{JSON.stringify(playerData, null, 2)}</pre>
        </details>
      </div>
    );
  }

  const { stats, sessions } = playerData;
  
  const totalPutts = (stats.total_makes || 0) + (stats.total_misses || 0);
  const makePercentage = totalPutts > 0 ? ((stats.total_makes / totalPutts) * 100).toFixed(1) + '%' : 'N/A';

  return (
    <>
      <main className="dashboard-main">
        <div className="dashboard-actions">
          <button 
            onClick={() => setIsContactsModalOpen(true)}
            className="btn btn-secondary"
            title="View and manage friends & contacts"
          >
            CONTACTS
          </button>
          <button 
            onClick={handleRefreshClick}
            className="btn btn-tertiary"
            title="Refresh data"
          >
            REFRESH
          </button>
          <button 
            onClick={handleSyncDesktop}
            className="btn btn-tertiary"
            title="Sync with desktop app"
          >
            SYNC
          </button>
          {actionError && <p className="error-message">{actionError}</p>}
        </div>

        <div className="stats-summary-bar">
          <h2>All-Time Stats</h2>
        </div>
        <div className="dashboard-grid">
          <StatCard title="Makes" value={stats.total_makes} />
          <StatCard title="Misses" value={stats.total_misses} />
          <StatCard title="Accuracy" value={makePercentage} />
          <StatCard title="Fastest 21" value={stats.fastest_21_makes ? `${stats.fastest_21_makes.toFixed(2)}s` : 'N/A'} />
        </div>
        
        <div className={`session-list-container ${expandedSessionId ? 'is-expanded' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Session History</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to={`/player/${playerData?.player_id}/stats`} className="btn btn-secondary">Career Stats</Link>
              <Link to={`/player/${playerData?.player_id}/sessions`} className="btn btn-secondary">Full History</Link>
            </div>
          </div>
          <div className="session-table-wrapper" ref={tableWrapperRef}>
            <table className="session-table">
              <thead>
                <tr><th style={{ width: '120px' }}>Details</th><th>Session Date</th><th>Duration</th><th>Makes</th><th>Misses</th><th>Best Streak</th><th>Fastest 21</th><th>PPM</th><th>MPM</th><th>Most in 60s</th></tr>
              </thead>
              <tbody>
                {sessions && sessions.length > 0 ? (
                  sessions.map((session, index) => (
                    <SessionRow
                      key={session.session_id}
                      session={session}
                      playerTimezone={playerTimezone}
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
              <LeaderboardCard title="Most Makes" leaders={leaderboardData?.top_makes} />
              <LeaderboardCard title="Best Streak" leaders={leaderboardData?.top_streaks} />
              <LeaderboardCard title="Makes/Min" leaders={leaderboardData?.top_makes_per_minute} />
              <LeaderboardCard title="Fastest 21" leaders={leaderboardData?.fastest_21} />
          </div>
        </div>
      </main>

      {isContactsModalOpen && (
        <ContactsModal 
          isOpen={isContactsModalOpen}
          onClose={() => setIsContactsModalOpen(false)}
        />
      )}
    </>
  );
}

export default Dashboard;