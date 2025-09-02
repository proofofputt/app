import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { apiListLeagues, apiJoinLeague, apiRespondToLeagueInvite } from '@/api.js';
import CreateLeagueModal from '@/components/CreateLeagueModal.jsx';
import './Leagues.css';
 
// New component for a row in the main leagues table
const LeagueTableRow = ({ league }) => (
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
    <td className="actions-cell">
      {league.can_join ? (
        <button onClick={() => league.onJoin(league.league_id)} className="btn btn-secondary btn-small">
          Join
        </button>
      ) : (
        <Link to={`/leagues/${league.league_id}`} className="btn btn-small">View</Link>
      )}
    </td>
  </tr>
);
 
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
  const isSubscribed = playerData?.subscription_status === 'active';
  const [myLeagues, setMyLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchLeagues = useCallback(async () => {
    if (!playerData?.player_id) return;
    setIsLoading(true);
    try {
      const { my_leagues, public_leagues, pending_invites } = await apiListLeagues(playerData.player_id);
      setMyLeagues(my_leagues || []);
      setPublicLeagues(public_leagues || []);
      setPendingInvites(pending_invites || []);
    } catch (err) {
      setError(err.message || 'Failed to load leagues.');
    } finally {
      setIsLoading(false);
    }
  }, [playerData]);

  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  const handleJoinLeague = async (leagueId) => {
    try {
      await apiJoinLeague(leagueId, playerData.player_id);
      showNotification('Successfully joined league!');
      fetchLeagues(); // Refresh the lists after joining
    } catch (err) {
      setError(err.message || 'Could not join league.');
    }
  };

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
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {myLeagues.length > 0 ? (
                myLeagues.map(league => <LeagueTableRow key={league.league_id} league={league} />)
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>You haven't joined any leagues yet.</td>
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
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {publicLeagues.length > 0 ? (
                publicLeagues.map(league => <LeagueTableRow key={league.league_id} league={{...league, can_join: true, onJoin: handleJoinLeague}} />)
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>No public leagues to join right now.</td>
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