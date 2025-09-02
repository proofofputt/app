import React, { useState } from 'react';

const FriendsLeaderboard = ({ leaderboard, selfStats, onViewProfile, onChallenge, onRefresh }) => {
  const [sortBy, setSortBy] = useState('ranking_points');

  const sortOptions = {
    'ranking_points': 'Ranking Points',
    'make_percentage': 'Accuracy %',
    'total_makes': 'Total Makes',
    'best_streak': 'Best Streak',
    'total_sessions': 'Sessions',
    'duel_wins': 'Duel Wins',
    'recent_activity': 'Recent Activity'
  };

  const formatPercentage = (value) => {
    return value ? `${value.toFixed(1)}%` : '0.0%';
  };

  const formatNumber = (value) => {
    return value ? value.toLocaleString() : '0';
  };

  const getActivityIcon = (status) => {
    switch (status) {
      case 'active': return '🟢';
      case 'recent': return '🟡';
      default: return '⚪';
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getSortValue = (friend, sortKey) => {
    switch (sortKey) {
      case 'ranking_points': return friend.stats.ranking_points || 0;
      case 'make_percentage': return friend.stats.career_make_percentage || 0;
      case 'total_makes': return friend.stats.total_makes || 0;
      case 'best_streak': return friend.stats.best_streak_overall || 0;
      case 'total_sessions': return friend.stats.total_sessions || 0;
      case 'duel_wins': return friend.stats.duels_won || 0;
      case 'recent_activity': return friend.stats.last_session_date ? new Date(friend.stats.last_session_date).getTime() : 0;
      default: return 0;
    }
  };

  const sortedLeaderboard = [...(leaderboard || [])].sort((a, b) => {
    const aValue = getSortValue(a, sortBy);
    const bValue = getSortValue(b, sortBy);
    return bValue - aValue; // Descending order
  });

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="friends-leaderboard empty">
        <div className="empty-state">
          <h3>No Friends for Leaderboard</h3>
          <p>Add friends to see competitive rankings!</p>
          <button className="btn btn-primary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-leaderboard">
      <div className="leaderboard-header">
        <h3>Friends Leaderboard</h3>
        <div className="sort-controls">
          <label htmlFor="sort-select">Sort by:</label>
          <select 
            id="sort-select"
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            {Object.entries(sortOptions).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      {selfStats && (
        <div className="self-stats-card">
          <h4>Your Stats</h4>
          <div className="self-stats-grid">
            <div className="self-stat">
              <span className="stat-value">{formatPercentage(selfStats.stats.career_make_percentage)}</span>
              <span className="stat-label">Accuracy</span>
            </div>
            <div className="self-stat">
              <span className="stat-value">{formatNumber(selfStats.stats.total_makes)}</span>
              <span className="stat-label">Makes</span>
            </div>
            <div className="self-stat">
              <span className="stat-value">{formatNumber(selfStats.stats.best_streak_overall)}</span>
              <span className="stat-label">Best Streak</span>
            </div>
            <div className="self-stat">
              <span className="stat-value">{formatNumber(selfStats.stats.ranking_points)}</span>
              <span className="stat-label">Points</span>
            </div>
          </div>
        </div>
      )}

      <div className="leaderboard-list">
        {sortedLeaderboard.map((friend, index) => {
          const rank = index + 1;
          const highlightValue = getSortValue(friend, sortBy);
          
          return (
            <div key={friend.player_id} className="leaderboard-item">
              <div className="rank-section">
                <div className="rank-number">
                  {getRankIcon(rank)}
                </div>
                <div className="activity-indicator">
                  {getActivityIcon(friend.activity?.status)}
                </div>
              </div>

              <div className="player-info">
                <h4 className="player-name">{friend.name}</h4>
                <div className="highlight-stat">
                  <span className="highlight-value">
                    {sortBy === 'make_percentage' && formatPercentage(highlightValue)}
                    {sortBy === 'ranking_points' && `${formatNumber(highlightValue)} pts`}
                    {sortBy === 'total_makes' && `${formatNumber(highlightValue)} makes`}
                    {sortBy === 'best_streak' && `${formatNumber(highlightValue)} streak`}
                    {sortBy === 'total_sessions' && `${formatNumber(highlightValue)} sessions`}
                    {sortBy === 'duel_wins' && `${formatNumber(highlightValue)} wins`}
                    {sortBy === 'recent_activity' && (
                      friend.stats.last_session_date ? 
                        new Date(friend.stats.last_session_date).toLocaleDateString() : 
                        'No sessions'
                    )}
                  </span>
                  <span className="highlight-label">{sortOptions[sortBy]}</span>
                </div>
              </div>

              <div className="quick-stats">
                <div className="quick-stat">
                  <span>{formatPercentage(friend.stats.career_make_percentage)}</span>
                  <small>Accuracy</small>
                </div>
                <div className="quick-stat">
                  <span>{formatNumber(friend.stats.best_streak_overall)}</span>
                  <small>Streak</small>
                </div>
                <div className="quick-stat">
                  <span>{friend.stats.duels_won || 0}-{(friend.stats.duels_played || 0) - (friend.stats.duels_won || 0)}</span>
                  <small>Duels</small>
                </div>
              </div>

              <div className="leaderboard-actions">
                <button 
                  className="btn-view-profile-small"
                  onClick={() => onViewProfile(friend.player_id)}
                  title="View Profile"
                >
                  👤
                </button>
                <button 
                  className="btn-challenge-small"
                  onClick={() => onChallenge(friend.player_id, friend.name)}
                  disabled={friend.activity?.status === 'inactive'}
                  title="Challenge to Duel"
                >
                  ⚔️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="leaderboard-footer">
        <p>Showing {sortedLeaderboard.length} friends • Sorted by {sortOptions[sortBy]}</p>
        <button className="btn btn-secondary" onClick={() => alert('Global leaderboard coming soon!')}>
          View Global Leaderboard
        </button>
      </div>
    </div>
  );
};

export default FriendsLeaderboard;