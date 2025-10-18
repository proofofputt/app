import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotification } from '../context/NotificationContext.jsx';
import './AdminPlayerProfilePage.css';

const AdminPlayerProfilePage = () => {
  const { playerId } = useParams();
  const navigate = useNavigate();
  const { playerData } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();

  const [player, setPlayer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (playerData?.player_id && playerData?.is_admin && playerId) {
      loadPlayerProfile();
    }
  }, [playerData?.player_id, playerData?.is_admin, playerId]);

  const loadPlayerProfile = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/users/${playerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setPlayer(data.player);
      } else {
        showNotification(data.message || 'Failed to load player profile', true);
      }
    } catch (error) {
      console.error('Error loading player profile:', error);
      showNotification('Failed to load player profile', true);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getTierBadgeClass = (tier) => {
    const tierMap = {
      free: 'tier-free',
      regular: 'tier-regular',
      premium: 'tier-premium'
    };
    return tierMap[tier] || 'tier-free';
  };

  // Redirect if not admin
  if (!playerData?.is_admin) {
    return (
      <div className="admin-player-profile-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="admin-player-profile-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading player profile...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="admin-player-profile-page">
        <div className="error-container">
          <h2>Player Not Found</h2>
          <p>The requested player profile could not be found.</p>
          <button onClick={() => navigate('/admin/users')} className="btn btn-primary">
            ← Back to Users
          </button>
        </div>
      </div>
    );
  }

  // Build referral chain array
  const referralChain = [];
  for (let i = 1; i <= 5; i++) {
    const levelData = {
      level: i,
      player_id: player[`l${i}_player_id`],
      display_name: player[`l${i}_display_name`],
      email: player[`l${i}_email`],
      joined_date: player[`l${i}_joined_date`],
      total_referrals: player[`l${i}_total_referrals`]
    };
    if (levelData.player_id) {
      referralChain.push(levelData);
    }
  }

  return (
    <div className="admin-player-profile-page">
      <div className="profile-header">
        <button onClick={() => navigate('/admin/users')} className="btn btn-secondary back-button">
          ← Back to Users
        </button>
        <h1>Player Profile: {player.display_name || player.email}</h1>
      </div>

      {/* Account Information Section */}
      <div className="profile-section">
        <h2>Account Information</h2>
        <div className="account-info-grid">
          <div className="info-item">
            <span className="info-label">Player ID</span>
            <span className="info-value">{player.player_id}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Email</span>
            <span className="info-value">{player.email}</span>
          </div>
          <div className="info-item">
            <span className="info-label">First Name</span>
            <span className="info-value">{player.first_name || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Last Name</span>
            <span className="info-value">{player.last_name || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Display Name</span>
            <span className="info-value">{player.display_name || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Phone</span>
            <span className="info-value">{player.phone || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Membership Tier</span>
            <span className="info-value">
              <span className={`tier-badge ${getTierBadgeClass(player.membership_tier)}`}>
                {player.membership_tier || 'free'}
              </span>
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Subscriber Status</span>
            <span className="info-value">{player.is_subscriber ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Timezone</span>
            <span className="info-value">{player.timezone || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Referral Code</span>
            <span className="info-value referral-code">{player.referral_code || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Total Referrals</span>
            <span className="info-value">{player.total_referrals || 0}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Total Sessions</span>
            <span className="info-value">{player.total_sessions || 0}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Account Created</span>
            <span className="info-value">{formatDate(player.created_at)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">First Session</span>
            <span className="info-value">{formatDate(player.first_session_date)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Last Session</span>
            <span className="info-value">{formatDate(player.last_session_date)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">HubSpot Sync</span>
            <span className="info-value">{player.hubspot_sync_status || 'pending'}</span>
          </div>
        </div>
      </div>

      {/* Referral Chain Section */}
      <div className="profile-section">
        <h2>Referral Chain (5 Levels)</h2>
        {referralChain.length > 0 ? (
          <div className="referral-chain">
            {referralChain.map((referrer, index) => (
              <div key={index} className="referral-level">
                <div className="level-indicator">
                  <span className="level-number">Level {referrer.level}</span>
                  {referrer.level === 1 && <span className="level-badge">Direct Referrer</span>}
                </div>
                <div className="referrer-card" onClick={() => navigate(`/admin/users/${referrer.player_id}`)}>
                  <div className="referrer-header">
                    <h3>{referrer.display_name}</h3>
                    <span className="referrer-id">ID: {referrer.player_id}</span>
                  </div>
                  <div className="referrer-details">
                    <div className="referrer-detail">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{referrer.email}</span>
                    </div>
                    <div className="referrer-detail">
                      <span className="detail-label">Joined:</span>
                      <span className="detail-value">{formatDate(referrer.joined_date)}</span>
                    </div>
                    <div className="referrer-detail">
                      <span className="detail-label">Total Referrals:</span>
                      <span className="detail-value">{referrer.total_referrals || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-referrals">
            <p>This player has no referral chain (organic signup or orphan account)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPlayerProfilePage;
