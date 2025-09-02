import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { apiGetPlayerSessions, apiGetCareerStats } from '@/api.js';
import SessionRow from '@/components/SessionRow.jsx';
import Pagination from '@/components/Pagination.jsx';
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
  const isSubscribed = playerData?.subscription_status === 'active';

  const fetchSessionData = useCallback(async () => {
      if (!playerId) return;
      setIsLoading(true);
      setError('');
      try {
        // Fetch player stats to get their name and subscription status
        const statsData = await apiGetCareerStats(playerId);
        setViewedPlayer({ name: statsData.player_name, is_subscribed: statsData.is_subscribed });

        // Always fetch session data - the subscription limiting will be handled in the UI
        const sessionData = await apiGetPlayerSessions(playerId, currentPage);
        setSessions(sessionData.sessions || []);
        setTotalPages(sessionData.total_pages || 1);
      } catch (err) {
        setError(err.message || 'Failed to load session history.');
      } finally {
        setIsLoading(false);
      }
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
                <th>Session Date</th><th>Duration</th><th>Makes</th><th>Misses</th>
                <th>Best Streak</th><th>Fastest 21</th><th>PPM</th><th>MPM</th><th>Most in 60s</th>
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
                  />
                ))
              ) : (
                <tr className="table-placeholder-row"><td colSpan="10">No sessions recorded for this player.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Show upgrade prompt for non-subscribers if they have more than 1 session */}
      {shouldShowUpgradePrompt && isViewingOwnProfile && <UpgradePrompt />}
      
      {/* Show pagination only for subscribers */}
      {isSubscribed && totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
      )}
    </div>
  );
};

export default SessionHistoryPage;