import React from 'react';

const FriendsList = ({ friends, onViewProfile, onChallenge, onRefresh }) => {
  const getActivityIcon = (status) => {
    switch (status) {
      case 'active': return '🟢';
      case 'recent': return '🟡';
      default: return '⚪';
    }
  };

  const getActivityText = (status, lastSession) => {
    switch (status) {
      case 'active': return 'Active this week';
      case 'recent': return 'Active this month';
      default: {
        if (lastSession) {
          const date = new Date(lastSession);
          return `Last seen ${date.toLocaleDateString()}`;
        }
        return 'Not active recently';
      }
    }
  };

  const formatPercentage = (value) => {
    return value ? `${value.toFixed(1)}%` : '0.0%';
  };

  const formatNumber = (value) => {
    return value ? value.toLocaleString() : '0';
  };

  if (!friends || friends.length === 0) {
    return (
      <div className="friends-list empty">
        <div className="empty-state">
          <h3>No Friends Yet</h3>
          <p>Sync your contacts or manually add friends to get started!</p>
          <button className="btn btn-primary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-list">
      <div className="list-header">
        <h3>Your Friends ({friends.length})</h3>
        <button className="btn btn-secondary" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      <div className="friends-grid">
        {friends.map((friend) => (
          <div key={friend.player_id} className="friend-card">
            <div className="friend-header">
              <div className="friend-name">
                <h4>{friend.name}</h4>
                <div className="activity-indicator">
                  <span className="activity-icon">
                    {getActivityIcon(friend.activity_status)}
                  </span>
                  <span className="activity-text">
                    {getActivityText(friend.activity_status, friend.stats?.last_session_date)}
                  </span>
                </div>
              </div>
              <div className="friendship-info">
                <span className="friendship-source">
                  {friend.friendship_source === 'contacts_sync' ? '📱' : '👤'}
                </span>
              </div>
            </div>

            {friend.stats && (
              <div className="friend-stats">
                <div className="stat-row">
                  <div className="stat">
                    <span className="stat-value">{formatPercentage(friend.stats.career_make_percentage)}</span>
                    <span className="stat-label">Accuracy</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatNumber(friend.stats.total_makes)}</span>
                    <span className="stat-label">Makes</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatNumber(friend.stats.best_streak_overall)}</span>
                    <span className="stat-label">Best Streak</span>
                  </div>
                </div>

                <div className="stat-row">
                  <div className="stat">
                    <span className="stat-value">{formatNumber(friend.stats.total_sessions)}</span>
                    <span className="stat-label">Sessions</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{formatNumber(friend.stats.ranking_points)}</span>
                    <span className="stat-label">Points</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{friend.stats.duels_won || 0}-{friend.stats.duels_played - friend.stats.duels_won || 0}</span>
                    <span className="stat-label">Duels</span>
                  </div>
                </div>
              </div>
            )}

            <div className="friend-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => onViewProfile(friend.player_id)}
              >
                View Profile
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => onChallenge(friend.player_id, friend.name)}
                disabled={friend.activity_status === 'inactive'}
              >
                Challenge
              </button>
            </div>

            <div className="challenge-status">
              {friend.activity_status === 'active' && (
                <span className="status-available">Available to challenge</span>
              )}
              {friend.activity_status === 'recent' && (
                <span className="status-maybe">May be available</span>
              )}
              {friend.activity_status === 'inactive' && (
                <span className="status-unavailable">Not active recently</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendsList;