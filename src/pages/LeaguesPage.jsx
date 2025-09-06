import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiListLeagues, apiJoinLeague, apiRespondToLeagueInvite } from '../api.js';
import CreateLeagueModal from '../components/CreateLeagueModal.jsx';
import './Leagues.css';
 
// League card component matching the prototype design
const LeagueCard = ({ league, onJoin, isPublic }) => (
  <div className="league-card card">
    <div className="league-card-header">
      <h3>{league.name}</h3>
      <span className={`privacy-badge ${league.privacy_type}`}>{league.privacy_type}</span>
    </div>
    <p className="league-card-description">{league.description || 'No description provided.'}</p>
    <div className="league-card-footer">
      <span>{league.member_count} Members</span>
      {isPublic ? (
        <button onClick={() => onJoin(league.league_id)} className="btn btn-secondary">Join</button>
      ) : (
        <Link to={`/leagues/${league.league_id}`} className="btn">View</Link>
      )}
    </div>
  </div>
);
 
// Invite card component matching the prototype design
const InviteCard = ({ league, onRespond }) => (
  <div className="league-card card">
    <div className="league-card-header">
      <h3>{league.name}</h3>
      <span className="privacy-badge private">Invitation</span>
    </div>
    <p className="league-card-description">You've been invited by <strong>{league.inviter_name || 'the creator'}</strong>.</p>
    <div className="league-card-footer">
      <span>{league.member_count} Members</span>
      <div className="invite-actions">
        <button onClick={() => onRespond(league.league_id, 'decline')} className="btn btn-tertiary btn-small">Decline</button>
        <button onClick={() => onRespond(league.league_id, 'accept')} className="btn btn-secondary btn-small">Accept</button>
      </div>
    </div>
  </div>
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
      const { my_leagues, public_leagues, pending_invites } = await apiListLeagues(playerData.player_id);
      setMyLeagues(my_leagues || []);
      setPublicLeagues(public_leagues || []);
      setPendingInvites(pending_invites || []);
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
          <div className="leagues-grid">
            {pendingInvites.map(league => (
              <InviteCard key={league.league_id} league={league} onRespond={handleInviteResponse} />
            ))}
          </div>
        </div>
      )}

      <div className="leagues-section">
        <h3>My Leagues</h3>
        <div className="leagues-grid">
          {myLeagues.length > 0 ? (
            myLeagues.map(league => <LeagueCard key={league.league_id} league={league} />)
          ) : (
            <p>You haven't joined any leagues yet.</p>
          )}
        </div>
      </div>

      <div className="leagues-section">
        <h3>Public Leagues</h3>
        <div className="leagues-grid">
          {publicLeagues.length > 0 ? (
            publicLeagues.map(league => (
              <LeagueCard key={league.league_id} league={league} onJoin={handleJoinLeague} isPublic />
            ))
          ) : (
            <p>No public leagues available to join right now.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaguesPage;