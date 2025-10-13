import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { apiGetPlayerSessions } from '../api';
import SessionRow from './SessionRow';
import Pagination from './Pagination';
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
  const [actionError, setActionError] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [paginatedSessions, setPaginatedSessions] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const tableWrapperRef = useRef(null);
  const sessionsPerPage = 21;

  // This effect manages the height of the session table container
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    if (expandedSessionId) {
      const header = wrapper.querySelector('.session-table thead');
      const parentRow = wrapper.querySelector('.session-table tr.is-expanded-parent');
      const detailsRow = wrapper.querySelector('.session-table .session-details-row');

      if (header && parentRow && detailsRow) {
        // Calculate available space in the wrapper and use most of it for the expanded view
        const wrapperHeight = wrapper.clientHeight;
        const headerHeight = header.offsetHeight;
        const parentRowHeight = parentRow.offsetHeight;
        const bottomMargin = 40; // Leave some margin at the bottom

        // Set a generous height that uses most of the available space
        const expandedHeight = wrapperHeight - bottomMargin;
        wrapper.style.maxHeight = `${expandedHeight}px`;
        wrapper.scrollTop = parentRow.offsetTop - headerHeight;
      }
    } else {
      wrapper.style.maxHeight = null;
    }
  }, [expandedSessionId]);

  // Handle scroll events to hide stats when scrolling
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    const handleScroll = () => {
      // Show stats only when scrolled back to the top (within 10px threshold)
      if (wrapper.scrollTop <= 10) {
        setIsScrolling(false);
      } else {
        setIsScrolling(true);
      }
    };

    wrapper.addEventListener('scroll', handleScroll);

    return () => {
      wrapper.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleToggleExpand = (sessionId) => {
    setExpandedSessionId(prevId => (prevId === sessionId ? null : sessionId));
  };


  const handleRefreshClick = () => {
    setActionError('');
    refreshData(playerData.player_id);
    loadPaginatedSessions(currentPage);
    showNotification('Data refreshed!');
  };

  const loadPaginatedSessions = async (page) => {
    if (!playerData?.player_id) return;
    
    setSessionsLoading(true);
    try {
      const sessionData = await apiGetPlayerSessions(playerData.player_id, page, sessionsPerPage);

      // Calculate daily session numbers for privacy-friendly display
      if (sessionData && sessionData.sessions) {
        const calculateDailySessionNumbers = (sessions) => {
          const dailyCounters = {};
          const sessionDayNumbers = {};

          // Sort sessions by date (newest first, same as display order)
          const sortedSessions = [...sessions].sort((a, b) => new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time));

          // First pass: count sessions per date
          const sessionsByDate = {};
          sortedSessions.forEach(session => {
            const sessionDate = session.created_at || session.start_time;
            if (sessionDate) {
              const dateKey = new Date(sessionDate).toDateString();
              if (!sessionsByDate[dateKey]) {
                sessionsByDate[dateKey] = [];
              }
              sessionsByDate[dateKey].push(session);
            }
          });

          // Second pass: assign numbers with newest = highest number
          Object.keys(sessionsByDate).forEach(dateKey => {
            const sessionsForDate = sessionsByDate[dateKey];
            const totalForDate = sessionsForDate.length;

            sessionsForDate.forEach((session, index) => {
              // Newest session gets highest number (totalForDate), oldest gets 1
              sessionDayNumbers[session.session_id] = totalForDate - index;
            });
          });

          return sessionDayNumbers;
        };

        const dailySessionNumbers = calculateDailySessionNumbers(sessionData.sessions);
        sessionData.dailySessionNumbers = dailySessionNumbers;

        // Sort sessions by date (newest first), then by session number (highest first) within each date
        sessionData.sessions.sort((a, b) => {
          const dateA = new Date(a.created_at || a.start_time);
          const dateB = new Date(b.created_at || b.start_time);

          // First sort by date (newest first)
          if (dateA.toDateString() !== dateB.toDateString()) {
            return dateB - dateA;
          }

          // If same date, sort by session number (highest/newest first)
          const numA = dailySessionNumbers[a.session_id] || 0;
          const numB = dailySessionNumbers[b.session_id] || 0;
          return numB - numA;
        });
      }

      setPaginatedSessions(sessionData);
    } catch (error) {
      console.error('Failed to load paginated sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadPaginatedSessions(newPage);
    setExpandedSessionId(null);
  };

  // Load paginated sessions when component mounts or player changes
  useEffect(() => {
    if (playerData?.player_id) {
      loadPaginatedSessions(1);
      setCurrentPage(1);
    }
  }, [playerData?.player_id]);


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

  const { stats } = playerData;

  const totalPutts = (stats.total_makes || 0) + (stats.total_misses || 0);
  const makePercentage = totalPutts > 0 ? ((stats.total_makes / totalPutts) * 100).toFixed(1) + '%' : 'N/A';

  // Hide stats when session is expanded or scrolling
  const shouldHideStats = expandedSessionId !== null || isScrolling;

  return (
    <>
      <main className="dashboard-main">

        {!shouldHideStats && (
          <>
            <div className="stats-summary-bar">
              <h2>All-Time Stats</h2>
            </div>
            <div className="dashboard-grid">
              <StatCard title="Makes" value={stats.total_makes} />
              <StatCard title="Misses" value={stats.total_misses} />
              <StatCard title="Accuracy" value={makePercentage} />
              <StatCard title="Fastest 21" value={stats.fastest_21_makes ? `${stats.fastest_21_makes.toFixed(2)}s` : 'N/A'} />
            </div>
          </>
        )}
        
        <div className={`session-list-container ${expandedSessionId ? 'is-expanded' : ''} ${shouldHideStats ? 'stats-hidden' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Session History</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleRefreshClick}
                className="btn btn-tertiary"
                title="Refresh data"
              >
                REFRESH
              </button>
              <Link to={`/player/${playerData?.player_id}/stats`} className="btn btn-secondary">Career Stats</Link>
            </div>
          </div>
          <div className="session-table-wrapper" ref={tableWrapperRef}>
            <table className="session-table">
              <thead>
                <tr><th style={{ width: '1%', textAlign: 'left', whiteSpace: 'nowrap' }}>Details</th><th style={{ textAlign: 'center' }}>Session #</th><th style={{ textAlign: 'center', minWidth: '150px' }}>Type</th><th style={{ textAlign: 'center' }}>Duration</th><th style={{ textAlign: 'center' }}>Makes</th><th style={{ textAlign: 'center' }}>Misses</th><th style={{ textAlign: 'center' }}>Streak</th><th style={{ textAlign: 'center' }}>Fastest 21</th><th style={{ textAlign: 'center' }}>PPM</th><th style={{ textAlign: 'center' }}>MPM</th><th style={{ textAlign: 'center' }}>Max 60s</th></tr>
              </thead>
              <tbody>
                {sessionsLoading ? (
                  <tr className="table-placeholder-row">
                    <td colSpan="11">Loading sessions...</td>
                  </tr>
                ) : paginatedSessions && paginatedSessions.sessions && paginatedSessions.sessions.length > 0 ? (
                  paginatedSessions.sessions.map((session, index) => (
                    <SessionRow
                      key={session.session_id}
                      session={session}
                      playerTimezone={playerTimezone}
                      isLocked={false}
                      isExpanded={expandedSessionId === session.session_id}
                      onToggleExpand={handleToggleExpand}
                      dailySessionNumber={paginatedSessions.dailySessionNumbers?.[session.session_id]}
                    />
                  ))
                ) : (
                  <tr className="table-placeholder-row">
                      <td colSpan="11">No sessions recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls - outside session-list-container on main background */}
        {paginatedSessions && paginatedSessions.pagination && (
          <Pagination
            currentPage={currentPage}
            totalPages={paginatedSessions.pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}

      </main>

    </>
  );
}

export default Dashboard;