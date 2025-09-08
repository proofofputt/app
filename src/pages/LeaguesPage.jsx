import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiListLeagues, apiRespondToLeagueInvite } from '../api.js';
import CreateLeagueModal from '../components/CreateLeagueModal.jsx';
import './Leagues.css';
 
// Helper function to format date and time
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateString));
  } catch (e) { 
    return 'N/A'; 
  }
};

// Helper function to format round duration
const formatRoundInterval = (hours) => {
  if (!hours) return 'N/A';
  if (hours < 24) {
    return `${hours} Hour${hours > 1 ? 's' : ''}`;
  }
  const days = hours / 24;
  return `${days} Day${days > 1 ? 's' : ''}`;
};

// New component for a row in the main leagues table
const LeagueTableRow = ({ league }) => {
  const rules = league.rules || {};
  const startDate = league.created_at || league.start_time;
  
  return (
    <tr>
      <td>
        <Link to={`/leagues/${league.league_id}`}>{league.name}</Link>
      </td>
      <td className="league-description-cell">{league.description || 'No description provided.'}</td>
      <td style={{ textAlign: 'center' }}>{league.member_count}</td>
      <td>
        <span className={`privacy-badge ${league.privacy_type}`}>{league.privacy_type}</span>
      </td>
      <td>
        <span className={`status-badge status-${league.status}`}>{league.status}</span>
      </td>
      <td>{formatDateTime(startDate)}</td>
      <td style={{ textAlign: 'center' }}>{rules.time_limit_minutes ? `${rules.time_limit_minutes} min` : 'N/A'}</td>
      <td style={{ textAlign: 'center' }}>{rules.num_rounds || 'N/A'}</td>
      <td>{formatRoundInterval(rules.round_duration_hours)}</td>
    </tr>
  );
};
 
// New component for a row in the invites table
const InviteTableRow = ({ league, onRespond }) => (
  <tr>
    <td>{league.name}</td>
    {/* Assuming inviter_name is available on the league object for invites */}
    <td>You've been invited by <strong>{league.inviter_name || 'the creator'}</strong>.</td>
    <td style={{ textAlign: 'center' }}>{league.member_count}</td>
    <td className="actions-cell">
      <div className="invite-actions">
        <button onClick={() => onRespond(league.league_id, 'decline')} className="btn btn-tertiary btn-small">Decline</button>
        <button onClick={() => onRespond(league.league_id, 'accept')} className="btn btn-secondary btn-small">Accept</button>
      </div>
    </td>
  </tr>
);

const LeaguesPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const navigate = useNavigate();
  const isSubscribed = playerData?.membership_tier === 'premium' || playerData?.membership_tier === 'regular';
  const [myLeagues, setMyLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchLeagues = useCallback(async () => {
    if (!playerData?.player_id) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await apiListLeagues(playerData.player_id);
      // Defensive programming - handle null/undefined responses
      const { my_leagues = [], public_leagues = [], pending_invites = [] } = response || {};
      setMyLeagues(my_leagues);
      setPublicLeagues(public_leagues);
      setPendingInvites(pending_invites);
    } catch (err) {
      // A 404 is not a "real" error in this context, it just means no leagues exist.
      if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
        setMyLeagues([]);
        setPublicLeagues([]);
        setPendingInvites([]);
      } else {
        setError(err.message || 'Failed to load leagues.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [playerData]);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);


  const handleInviteResponse = async (leagueId, action) => {
    try {
      await apiRespondToLeagueInvite(leagueId, playerData.player_id, action);
      showNotification(`Invitation ${action}d successfully.`);
      fetchLeagues(); // Refresh lists
    } catch (err) {
      showNotification(err.message || `Could not ${action} invite.`, true);
    }
  };

  const handleLeagueCreated = () => {
    setShowCreateModal(false);
    fetchLeagues();
    showNotification('League created successfully!');
  };

  const handleCreateLeagueClick = () => {
    if (isSubscribed) {
      setShowCreateModal(true);
    } else {
      showNotification("You can join leagues as a free user, but creating a league requires a full subscription.", true);
    }
  };

  if (isLoading) return <p style={{textAlign: 'center', padding: '2rem'}}>Loading leagues...</p>;
  if (error) return <p className="error-message" style={{textAlign: 'center', padding: '2rem'}}>{error}</p>;

  return (
    <div className="leagues-page">
      <div className="leagues-header">
        <h1>Leagues</h1>
        <button onClick={handleCreateLeagueClick} className="create-league-btn">+ Create League</button>
      </div>

      {showCreateModal && <CreateLeagueModal onClose={() => setShowCreateModal(false)} onLeagueCreated={handleLeagueCreated} />}

      {pendingInvites.length > 0 && (
        <div className="leagues-section">
          <h3>Pending Invitations</h3>
          <div className="leagues-table-container">
            <table className="leagues-table">
              <thead>
                <tr>
                  <th>League Name</th>
                  <th>Invitation From</th>
                  <th>Members</th>
                  <th className="actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map(league => <InviteTableRow key={league.league_id} league={league} onRespond={handleInviteResponse} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="leagues-section">
        <h3>My Leagues</h3>
        <div className="leagues-table-container">
          <table className="leagues-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Members</th>
                <th>Privacy</th>
                <th>Status</th>
                <th>Start Date/Time</th>
                <th>Round Time Limit</th>
                <th>Number of Rounds</th>
                <th>Round Interval</th>
              </tr>
            </thead>
            <tbody>
              {myLeagues.length > 0 ? (
                myLeagues.map(league => <LeagueTableRow key={league.league_id} league={league} />)
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>You haven't joined any leagues yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="leagues-section">
        <h3>Public Leagues</h3>
        <div className="leagues-table-container">
          <table className="leagues-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Members</th>
                <th>Privacy</th>
                <th>Status</th>
                <th>Start Date/Time</th>
                <th>Round Time Limit</th>
                <th>Number of Rounds</th>
                <th>Round Interval</th>
              </tr>
            </thead>
            <tbody>
              {publicLeagues.length > 0 ? (
                publicLeagues.map(league => <LeagueTableRow key={league.league_id} league={league} />)
              ) : (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>No public leagues to join right now.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaguesPage;