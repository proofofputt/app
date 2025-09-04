import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetCareerStats, apiGetLatestSessions, apiGetLeaderboard } from '../api';
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
  const { playerData, playerTimezone } = useAuth();
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [careerStats, setCareerStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingLeaderboards, setIsLoadingLeaderboards] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
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

  // Load real player data
  useEffect(() => {
    const loadData = async () => {
      if (!playerData?.player_id) {
        setIsLoadingStats(false);
        setIsLoadingSessions(false);
        setIsLoadingLeaderboards(false);
        return;
      }

      setIsLoadingStats(true);
      setIsLoadingSessions(true);
      setIsLoadingLeaderboards(true);
      setActionError('');

      const results = await Promise.allSettled([
        apiGetCareerStats(playerData.player_id),
        apiGetLatestSessions(playerData.player_id, 5),
        // Fetch leaderboards individually using the V2 endpoint
        apiGetLeaderboard({ metric: 'total_makes' }),
        apiGetLeaderboard({ metric: 'best_streak' }),
        apiGetLeaderboard({ metric: 'makes_per_minute' }),
        apiGetLeaderboard({ metric: 'fastest_21' }),
      ]);

      const [
        statsResult, 
        sessionsResult, 
        topMakesResult,
        topStreaksResult,
        topMpmResult,
        fastest21Result
      ] = results;

      if (statsResult.status === 'fulfilled') {
        setCareerStats(statsResult.value);
      } else {
        const reason = statsResult.reason;
        console.error('Error loading career stats:', reason);
        if (reason?.message?.includes('404')) {
          setCareerStats({}); // Player has no stats yet, show default 0s.
        } else {
          setActionError('Failed to load career stats');
        }
      }
      setIsLoadingStats(false);

      if (sessionsResult.status === 'fulfilled') {
        setRecentSessions(sessionsResult.value || []);
      } else {
        // A 404 from the sessions endpoint is expected if the user has no sessions.
        // This is not an error we should show to the user.
        console.warn('Could not load recent sessions:', sessionsResult.reason);
        setRecentSessions([]);
      }
      setIsLoadingSessions(false);

      // Process leaderboard results
      const newLeaderboardData = {
        top_makes: topMakesResult.status === 'fulfilled' ? topMakesResult.value.leaderboard : [],
        top_streaks: topStreaksResult.status === 'fulfilled' ? topStreaksResult.value.leaderboard : [],
        top_makes_per_minute: topMpmResult.status === 'fulfilled' ? topMpmResult.value.leaderboard : [],
        fastest_21: fastest21Result.status === 'fulfilled' ? fastest21Result.value.leaderboard : [],
      };
      setLeaderboardData(newLeaderboardData);

      // Log any errors from leaderboard fetches
      results.slice(2).forEach(result => {
        if (result.status === 'rejected') {
          console.error('Error loading a leaderboard:', result.reason);
        }
      });
      setIsLoadingLeaderboards(false);
    };

    loadData();
  }, [playerData?.player_id]);

  const totalPutts = (careerStats?.total_putts || 0);
  const makePercentage = careerStats?.career_make_percentage ? `${careerStats.career_make_percentage}%` : 'N/A';

  const handleSyncDesktop = () => {
    // TODO: Implement desktop app sync functionality
    console.log('Syncing with desktop app...');
  };

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
          <StatCard title="Makes" value={isLoadingStats ? '...' : (careerStats?.total_makes || 0)} />
          <StatCard title="Misses" value={isLoadingStats ? '...' : (careerStats?.total_misses || 0)} />
          <StatCard title="Accuracy" value={isLoadingStats ? '...' : makePercentage} />
          <StatCard title="Fastest 21" value={isLoadingStats ? '...' : (careerStats?.fastest_21_makes_seconds ? `${careerStats.fastest_21_makes_seconds}s` : 'N/A')} />
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
                {isLoadingSessions ? (
                  <tr className="table-placeholder-row">
                    <td colSpan="10">Loading sessions...</td>
                  </tr>
                ) : recentSessions && recentSessions.length > 0 ? (
                  recentSessions.map((session) => (
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