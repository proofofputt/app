import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import { apiListFriends, apiFriendsSocialActivity, apiCreateDuel, apiGetFriendRequests, apiRespondToFriendRequest } from '../api.js';
import FriendsList from '../components/FriendsList.jsx';
import FriendsLeaderboard from '../components/FriendsLeaderboard.jsx';
import FriendSearchModal from '../components/FriendSearchModal.jsx';
import './FriendsPage.css';

const MutualFriendsActivity = ({ activities, onViewDuel, onViewLeague, onJoinLeague }) => {
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'duel_completed': return '⚔️';
      case 'duel_created': return '🔥';
      case 'league_joined': return '🏆';
      case 'league_round_won': return '🥇';
      case 'league_completed': return '👑';
      case 'session_pb': return '🚀';
      default: return '📈';
    }
  };

  const getActivityText = (activity) => {
    // PRIVACY: Only use usernames in public activity displays - never email/phone
    switch (activity.type) {
      case 'duel_completed':
        return `${activity.winner_username} won a duel against ${activity.loser_username}`;
      case 'duel_created':
        return `${activity.player_username} created a duel with ${activity.opponent_username}`;
      case 'league_joined':
        return `${activity.player_username} joined ${activity.league_name}`;
      case 'league_round_won':
        return `${activity.player_username} won round ${activity.round_number} in ${activity.league_name}`;
      case 'league_completed':
        return `${activity.league_name} completed - ${activity.winner_username} won!`;
      case 'session_pb':
        return `${activity.player_username} set a personal best: ${activity.achievement}`;
      default:
        return activity.description;
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="mutual-friends-activity">
        <h3>Friends Activity</h3>
        <div className="empty-state">
          <p>No recent activity from your friends.</p>
          <p>Challenge them to duels or join leagues together!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mutual-friends-activity">
      <h3>Friends Activity</h3>
      <div className="activity-feed">
        {activities.map((activity, index) => (
          <div key={`${activity.type}-${activity.timestamp}-${index}`} className="activity-item">
            <div className="activity-icon">
              {getActivityIcon(activity.type)}
            </div>
            <div className="activity-content">
              <p className="activity-text">
                {getActivityText(activity)}
              </p>
              <div className="activity-meta">
                <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                {activity.duel_id && (
                  <button 
                    className="activity-link" 
                    onClick={() => onViewDuel(activity.duel_id)}
                  >
                    View Duel
                  </button>
                )}
                {activity.league_id && (
                  <>
                    <Link 
                      to={`/leagues/${activity.league_id}`} 
                      className="activity-link"
                    >
                      View League
                    </Link>
                    {activity.type === 'league_joined' && activity.can_join && (
                      <button 
                        className="activity-link join-league" 
                        onClick={() => onJoinLeague(activity.league_id, activity.league_name)}
                      >
                        Join League
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MutualFriendsCompetitions = ({ competitions, onChallenge, onJoinLeague }) => {
  if (!competitions || competitions.length === 0) {
    return (
      <div className="mutual-competitions">
        <h3>Mutual Friends Competitions</h3>
        <div className="empty-state">
          <p>No active competitions among your friends.</p>
          <p>Create duels or join leagues to compete together!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mutual-competitions">
      <h3>Active Competitions</h3>
      <div className="competitions-grid">
        {competitions.filter(comp => comp.type === 'duel').map(duel => (
          <div key={duel.id} className="competition-card duel-card">
            <div className="competition-header">
              <span className="competition-type">⚔️ Duel</span>
              <span className={`status-badge status-${duel.status}`}>{duel.status}</span>
            </div>
            <div className="competition-players">
              <span className="player">{duel.player1_username}</span>
              <span className="vs">vs</span>
              <span className="player">{duel.player2_username}</span>
            </div>
            {duel.status === 'completed' && (
              <div className="competition-result">
                <span className="winner">Winner: {duel.winner_username}</span>
                <span className="score">{duel.score}</span>
              </div>
            )}
            <div className="competition-actions">
              <Link to={`/duels`} className="btn btn-small">View Duels</Link>
            </div>
          </div>
        ))}

        {competitions.filter(comp => comp.type === 'league').map(league => (
          <div key={league.id} className="competition-card league-card">
            <div className="competition-header">
              <span className="competition-type">🏆 League</span>
              <span className={`status-badge status-${league.status}`}>{league.status}</span>
            </div>
            <div className="competition-info">
              <h4>{league.name}</h4>
              <p>{league.friend_count} of your friends competing</p>
              {league.current_leader_username && (
                <p className="current-leader">
                  Leading: {league.current_leader_username}
                </p>
              )}
            </div>
            <div className="competition-actions">
              <Link to={`/leagues/${league.id}`} className="btn btn-small">View League</Link>
              {league.can_join && (
                <button 
                  className="btn btn-secondary btn-small"
                  onClick={() => onJoinLeague(league.id, league.name)}
                >
                  Join
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FriendsPage = () => {
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [socialActivity, setSocialActivity] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFriendSearchModal, setShowFriendSearchModal] = useState(false);

  const fetchFriendsData = useCallback(async () => {
    if (!playerData?.player_id) return;
    
    setIsLoading(true);
    setError('');

    try {
      const [friendsResult, socialResult, requestsResult] = await Promise.allSettled([
        apiListFriends(playerData.player_id),
        apiFriendsSocialActivity(playerData.player_id),
        apiGetFriendRequests(playerData.player_id)
      ]);

      if (friendsResult.status === 'fulfilled') {
        setFriends(friendsResult.value.friends || []);
        setLeaderboard(friendsResult.value.friends || []);
      } else {
        console.warn('Could not load friends:', friendsResult.reason);
        setFriends([]);
        setLeaderboard([]);
      }

      if (socialResult.status === 'fulfilled') {
        setSocialActivity(socialResult.value.recent_activity || []);
        setCompetitions(socialResult.value.mutual_competitions || []);
      } else {
        console.warn('Could not load social activity:', socialResult.reason);
        setSocialActivity([]);
        setCompetitions([]);
      }

      if (requestsResult.status === 'fulfilled') {
        setFriendRequests(requestsResult.value.pending_requests || []);
      } else {
        console.warn('Could not load friend requests:', requestsResult.reason);
        setFriendRequests([]);
      }
    } catch (err) {
      setError('Failed to load friends data.');
      console.error('Friends data error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [playerData]);

  useEffect(() => {
    fetchFriendsData();
  }, [fetchFriendsData]);

  const handleViewProfile = useCallback((playerId) => {
    navigate(`/player/${playerId}/stats`);
  }, [navigate]);

  const handleChallenge = useCallback(async (playerId, playerName) => {
    try {
      const response = await apiCreateDuel(playerData.player_id, playerId, 15); // Default 15 minutes
      showNotification(`Duel challenge sent to ${playerName}!`);
      fetchFriendsData(); // Refresh to show new duel
    } catch (err) {
      showNotification(`Failed to challenge ${playerName}: ${err.message}`, true);
    }
  }, [playerData, showNotification, fetchFriendsData]);

  const handleJoinLeague = useCallback(async (leagueId, leagueName) => {
    navigate(`/leagues/${leagueId}`);
  }, [navigate]);

  const handleViewDuel = useCallback((duelId) => {
    navigate('/duels'); // Navigate to duels page - could be enhanced to show specific duel
  }, [navigate]);

  const handleFriendAdded = useCallback(() => {
    showNotification('Friend request sent!');
    fetchFriendsData(); // Refresh to show updated requests
  }, [showNotification, fetchFriendsData]);

  const handleFriendRequestResponse = useCallback(async (requestId, action, requesterUsername) => {
    try {
      await apiRespondToFriendRequest(playerData.player_id, requestId, action);
      showNotification(`Friend request ${action}ed${requesterUsername ? ` from ${requesterUsername}` : ''}!`);
      fetchFriendsData(); // Refresh to show updated lists
    } catch (err) {
      showNotification(`Failed to ${action} friend request: ${err.message}`, true);
    }
  }, [playerData, showNotification, fetchFriendsData]);

  if (isLoading) {
    return (
      <div className="friends-page">
        <div className="loading-state">
          <p>Loading your friends and social activity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="friends-page">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button className="btn" onClick={fetchFriendsData}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-page">
      <div className="page-header">
        <h1>Friends & Social</h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchFriendsData}>
            Refresh
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setShowFriendSearchModal(true)}
          >
            Add Friend
          </button>
          <Link to="/settings" className="btn btn-tertiary">
            Sync Contacts
          </Link>
        </div>
      </div>

      <div className="friends-tabs">
        <button 
          className={`tab-button ${activeTab === 'friends' ? 'active' : ''}`}
          onClick={() => setActiveTab('friends')}
        >
          Friends List ({friends.length})
          {friendRequests.length > 0 && (
            <span className="request-badge">{friendRequests.length}</span>
          )}
        </button>
        <button 
          className={`tab-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
        <button 
          className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
        <button 
          className={`tab-button ${activeTab === 'competitions' ? 'active' : ''}`}
          onClick={() => setActiveTab('competitions')}
        >
          Competitions
        </button>
      </div>

      <div className="friends-content">
        {activeTab === 'friends' && (
          <>
            {friendRequests.length > 0 && (
              <div className="friend-requests-section">
                <h3>Friend Requests ({friendRequests.length})</h3>
                <div className="friend-requests-list">
                  {friendRequests.map(request => (
                    <div key={request.request_id} className="friend-request-item">
                      <div className="request-info">
                        <h4>{request.requester_username}</h4>
                        <p>Wants to be your friend</p>
                        {request.mutual_friends > 0 && (
                          <small>{request.mutual_friends} mutual friends</small>
                        )}
                      </div>
                      <div className="request-actions">
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => handleFriendRequestResponse(request.request_id, 'decline', request.requester_username)}
                        >
                          Decline
                        </button>
                        <button 
                          className="btn btn-primary btn-small"
                          onClick={() => handleFriendRequestResponse(request.request_id, 'accept', request.requester_username)}
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <FriendsList
              friends={friends}
              onViewProfile={handleViewProfile}
              onChallenge={handleChallenge}
              onRefresh={fetchFriendsData}
            />
          </>
        )}

        {activeTab === 'leaderboard' && (
          <FriendsLeaderboard
            leaderboard={leaderboard}
            selfStats={playerData ? { stats: playerData } : null}
            onViewProfile={handleViewProfile}
            onChallenge={handleChallenge}
            onRefresh={fetchFriendsData}
          />
        )}

        {activeTab === 'activity' && (
          <MutualFriendsActivity
            activities={socialActivity}
            onViewDuel={handleViewDuel}
            onJoinLeague={handleJoinLeague}
          />
        )}

        {activeTab === 'competitions' && (
          <MutualFriendsCompetitions
            competitions={competitions}
            onChallenge={handleChallenge}
            onJoinLeague={handleJoinLeague}
          />
        )}
      </div>

      {/* Friend Search Modal */}
      <FriendSearchModal
        isOpen={showFriendSearchModal}
        onClose={() => setShowFriendSearchModal(false)}
        playerId={playerData?.player_id}
        onFriendAdded={handleFriendAdded}
      />
    </div>
  );
};

export default FriendsPage;