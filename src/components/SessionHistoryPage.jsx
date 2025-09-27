import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiGetPlayerSessions, apiGetCareerStats } from '../api.js';
import SessionRow from '../components/SessionRow.jsx';
import Pagination from '../components/Pagination.jsx';
import './SessionHistoryPage.css';

const UpgradePrompt = () => (
  <div className="upgrade-prompt-sessions">
    <h3>Unlock Full Session History</h3>
    <p>A full subscription is required to view detailed history and trends for all your putting sessions.</p>
    <Link to="/settings" className="btn">Upgrade Now</Link>
  </div>
);

const SessionHistoryPage = () => {
  const { playerId } = useParams();
  const { playerData } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewedPlayer, setViewedPlayer] = useState(null);
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  const isViewingOwnProfile = playerData && playerData.player_id === parseInt(playerId);
  const isSubscribed = playerData?.membership_tier === 'premium' || playerData?.membership_tier === 'regular';

  const fetchSessionData = useCallback(async () => {
      if (!playerId) return;
      setIsLoading(true);
      setError('');

      const [statsResult, sessionsResult] = await Promise.allSettled([
        apiGetCareerStats(playerId),
        apiGetPlayerSessions(playerId, currentPage),
      ]);

      if (statsResult.status === 'fulfilled') {
        const statsData = statsResult.value;
        setViewedPlayer({ name: statsData.player_name, is_subscribed: statsData.is_subscribed });
      } else {
        console.error('Failed to load player stats:', statsResult.reason);
        setError(statsResult.reason.message || 'Failed to load player stats.');
      }

      if (sessionsResult.status === 'fulfilled') {
        const sessionData = sessionsResult.value;
        const sessions = sessionData.sessions || [];
        // Ensure sessions are sorted newest first (highest session_id to lowest)
        const sortedSessions = sessions.sort((a, b) => {
          // Primary sort: by created_at/updated_at date (newest first)
          const dateA = new Date(a.updated_at || a.created_at);
          const dateB = new Date(b.updated_at || b.created_at);
          if (dateB.getTime() !== dateA.getTime()) {
            return dateB.getTime() - dateA.getTime();
          }
          // Secondary sort: by session_id (higher numbers first for same date)
          return (b.session_id || '').localeCompare(a.session_id || '');
        });
        setSessions(sortedSessions);
        setTotalPages(sessionData.pagination?.total_pages || sessionData.total_pages || 1);
      } else {
        console.warn('Could not load session history (this is expected for new players):', sessionsResult.reason);
        setSessions([]);
        setTotalPages(1);
      }

      setIsLoading(false);
  }, [playerId, currentPage]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setExpandedSessionId(null); // Close any expanded session when changing pages
  };

  const handleToggleExpand = (sessionId) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  if (isLoading) return <p style={{ textAlign: 'center', padding: '2rem' }}>Loading session history...</p>;
  if (error) return <p className="error-message" style={{ textAlign: 'center', padding: '2rem' }}>{error}</p>;

  // For non-subscribers, show all sessions but only the LAST (most recent) session is unlocked
  const sessionsToShow = sessions;
  const shouldShowUpgradePrompt = !isSubscribed && sessions.length > 1;

  // Calculate daily session numbers for privacy-friendly display
  const calculateDailySessionNumbers = (sessions) => {
    const dailyCounters = {};
    const sessionDayNumbers = {};

    // Sort sessions by date (newest first, same as display order)
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.created_at || b.start_time) - new Date(a.created_at || a.start_time));

    sortedSessions.forEach(session => {
      const sessionDate = session.created_at || session.start_time;
      if (sessionDate) {
        const dateKey = new Date(sessionDate).toDateString(); // "Wed Sep 25 2024"
        dailyCounters[dateKey] = (dailyCounters[dateKey] || 0) + 1;
        sessionDayNumbers[session.session_id] = dailyCounters[dateKey];
      }
    });

    return sessionDayNumbers;
  };

  const dailySessionNumbers = calculateDailySessionNumbers(sessionsToShow);

  return (
    <div className="session-history-page">
      <div className="page-header">
        <h2>Session History for {viewedPlayer?.name || 'Player'}</h2>
      </div>

      <div className="session-list-container full-height">
        <div className="session-table-wrapper">
          <table className="session-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Details</th>
                <th>Session #</th><th>Type</th><th>Duration</th><th>Makes</th><th>Misses</th>
                <th>Best Streak</th><th>Fastest 21</th><th>PPM</th><th>MPM</th><th>Most in 60s</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessionsToShow.length > 0 ? (
                sessionsToShow.map((session, index) => (
                  <SessionRow
                    key={session.session_id}
                    session={session}
                    playerTimezone={playerData.timezone}
                    isLocked={!isSubscribed && !(currentPage === 1 && index === 0)}
                    isExpanded={expandedSessionId === session.session_id}
                    onToggleExpand={handleToggleExpand}
                    dailySessionNumber={dailySessionNumbers[session.session_id]}
                  />
                ))
              ) : (
                <tr className="table-placeholder-row"><td colSpan="11">No sessions recorded for this player.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Show upgrade prompt for non-subscribers if they have more than 1 session */}
      {shouldShowUpgradePrompt && isViewingOwnProfile && <UpgradePrompt />}
      
      {/* Show pagination if there are multiple pages of sessions */}
      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
};

export default SessionHistoryPage;