import React, { useState, useEffect } from 'react';

const PlayerProfile = ({ playerId, requestingPlayerId, onClose, onChallenge }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    loadProfile();
  }, [playerId, requestingPlayerId]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/profile/${playerId}?requesting_player_id=${requestingPlayerId}`);
      
      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value) => {
    return value ? `${value.toFixed(1)}%` : '0.0%';
  };

  const formatNumber = (value) => {
    return value ? value.toLocaleString() : '0';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getActivityStatus = (status, daysAgo) => {
    switch (status) {
      case 'active':
        return { icon: '🟢', text: 'Active this week', color: 'var(--primary-color)' };
      case 'recent':
        return { icon: '🟡', text: `Active ${daysAgo} days ago`, color: '#FFC107' };
      default:
        return { 
          icon: '⚪', 
          text: daysAgo ? `Last seen ${daysAgo} days ago` : 'Not active recently', 
          color: '#9E9E9E' 
        };
    }
  };

  if (loading) {
    return (
      <div className="player-profile loading">
        <div className="profile-header">
          <button className="contacts-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="loading-content">Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="player-profile error">
        <div className="profile-header">
          <button className="contacts-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="error-content">
          <p>{error || 'Profile not found'}</p>
          <button className="btn btn-primary" onClick={loadProfile}>Retry</button>
        </div>
      </div>
    );
  }

  const activityStatus = getActivityStatus(
    profile.activity.status, 
    profile.activity.days_since_last_session
  );

  return (
    <div className="player-profile">
      <div className="profile-header">
        <h2>{profile.player_info.name}'s Profile</h2>
        <button className="contacts-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="profile-content">
        {/* Basic Info & Activity */}
        <div className="profile-section basic-info">
          <div className="player-avatar">
            <div className="avatar-placeholder">
              {profile.player_info.name.charAt(0).toUpperCase()}
            </div>
            <div className="activity-badge" style={{ color: activityStatus.color }}>
              <span className="activity-icon">{activityStatus.icon}</span>
              <span className="activity-text">{activityStatus.text}</span>
            </div>
          </div>

          <div className="player-details">
            <h3>{profile.player_info.name}</h3>
            <div className="detail-row">
              <span>Member since:</span>
              <span>{new Date(profile.player_info.created_at).toLocaleDateString()}</span>
            </div>
            <div className="detail-row">
              <span>Account age:</span>
              <span>{profile.player_info.account_age_days} days</span>
            </div>
            <div className="detail-row">
              <span>Membership:</span>
              <span className="membership-tier">{profile.player_info.membership_tier}</span>
            </div>
            {profile.social.friends_count > 0 && (
              <div className="detail-row">
                <span>Friends:</span>
                <span>{profile.social.friends_count} total</span>
              </div>
            )}
            {profile.social.mutual_friends_count > 0 && (
              <div className="detail-row">
                <span>Mutual friends:</span>
                <span>{profile.social.mutual_friends_count}</span>
              </div>
            )}
          </div>
        </div>

        {/* Career Stats */}
        <div className="profile-section career-stats">
          <h4>Career Statistics</h4>
          <div className="stats-grid">
            <div className="stat-card highlight">
              <span className="stat-value">{formatPercentage(profile.career_stats.career_make_percentage)}</span>
              <span className="stat-label">Accuracy</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(profile.career_stats.total_makes)}</span>
              <span className="stat-label">Total Makes</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(profile.career_stats.total_putts)}</span>
              <span className="stat-label">Total Putts</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(profile.career_stats.best_streak_overall)}</span>
              <span className="stat-label">Best Streak</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatNumber(profile.career_stats.total_sessions)}</span>
              <span className="stat-label">Sessions</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{profile.career_stats.total_practice_time_hours.toFixed(1)}h</span>
              <span className="stat-label">Practice Time</span>
            </div>
          </div>
        </div>

        {/* Personal Bests */}
        <div className="profile-section personal-bests">
          <h4>Personal Bests</h4>
          <div className="bests-grid">
            <div className="best-item">
              <span className="best-label">Most putts in session:</span>
              <span className="best-value">{formatNumber(profile.career_stats.most_putts_session)}</span>
            </div>
            <div className="best-item">
              <span className="best-label">Most makes in session:</span>
              <span className="best-value">{formatNumber(profile.career_stats.most_makes_session)}</span>
            </div>
            {profile.career_stats.fastest_21_makes_seconds && (
              <div className="best-item">
                <span className="best-label">Fastest 21 makes:</span>
                <span className="best-value">{formatDuration(profile.career_stats.fastest_21_makes_seconds)}</span>
              </div>
            )}
            <div className="best-item">
              <span className="best-label">Average per session:</span>
              <span className="best-value">{profile.career_stats.average_session_putts} putts</span>
            </div>
          </div>
        </div>

        {/* Duel Stats */}
        {profile.duel_stats.duels_played > 0 && (
          <div className="profile-section duel-stats">
            <h4>Duel Statistics</h4>
            <div className="duel-grid">
              <div className="duel-stat">
                <span className="duel-value">{profile.duel_stats.duels_won}-{profile.duel_stats.duels_lost}</span>
                <span className="duel-label">Win-Loss</span>
              </div>
              <div className="duel-stat">
                <span className="duel-value">{formatPercentage(profile.duel_stats.duel_win_percentage)}</span>
                <span className="duel-label">Win Rate</span>
              </div>
              <div className="duel-stat">
                <span className="duel-value">{formatNumber(profile.duel_stats.duels_played)}</span>
                <span className="duel-label">Total Duels</span>
              </div>
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {profile.recent_sessions && profile.recent_sessions.length > 0 && (
          <div className="profile-section recent-sessions">
            <h4>Recent Sessions</h4>
            <div className="sessions-list">
              {profile.recent_sessions.slice(0, 3).map((session, index) => (
                <div key={session.session_id} className="session-item">
                  <div className="session-date">
                    {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="session-stats">
                    <span>{session.total_makes}/{session.total_putts} ({formatPercentage(session.make_percentage)})</span>
                    <span>Streak: {session.best_streak}</span>
                    <span>{formatDuration(session.duration_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="profile-actions">
          {profile.privacy.can_challenge && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                onChallenge(profile.player_info.player_id, profile.player_info.name);
                onClose();
              }}
            >
              Challenge to Duel
            </button>
          )}
          {profile.privacy.can_add_friend && (
            <button 
              className="btn btn-secondary"
              onClick={() => alert('Add friend functionality coming soon!')}
            >
              Add Friend
            </button>
          )}
        </div>

        {/* Rankings */}
        {profile.career_stats.global_rank && (
          <div className="profile-section rankings">
            <h4>Rankings</h4>
            <div className="rank-info">
              <span>Global Rank: #{profile.career_stats.global_rank}</span>
              {profile.career_stats.ranking_points > 0 && (
                <span>Ranking Points: {formatNumber(profile.career_stats.ranking_points)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerProfile;