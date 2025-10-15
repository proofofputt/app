import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import LeagueAchievement from './LeagueAchievement.jsx';
import './AchievementCertificates.css';

// Achievement type configurations matching our system
const ACHIEVEMENT_CONFIG = {
  consecutive_makes: {
    title: 'Consecutive Excellence',
    icon: '🎯',
    description: 'consecutive putts made',
    category: 'Skill'
  },
  perfect_session: {
    title: 'Perfect Precision',
    icon: '💯',
    description: 'perfect putting session',
    category: 'Mastery'
  },
  career_milestone: {
    title: 'Career Achievement',
    icon: '🏆',
    description: 'career putts made',
    category: 'Dedication'
  },
  accuracy_milestone: {
    title: 'Accuracy Mastery',
    icon: '🎪',
    description: 'career accuracy achieved',
    category: 'Consistency'
  },
  session_milestone: {
    title: 'Session Dedication',
    icon: '📈',
    description: 'total sessions completed',
    category: 'Commitment'
  },
  competition_win: {
    title: 'Victory Champion',
    icon: '👑',
    description: 'competitive victory',
    category: 'Competition'
  }
};

const CertificateCard = ({ certificate }) => {
  const config = ACHIEVEMENT_CONFIG[certificate.achievement_type] || ACHIEVEMENT_CONFIG.consecutive_makes;
  const [showDetails, setShowDetails] = useState(false);

  const formatAchievementValue = () => {
    const value = certificate.achievement_value;
    const type = certificate.achievement_type;

    switch (type) {
      case 'consecutive_makes':
        return `${value}`;
      case 'perfect_session':
        return `${value}/${value}`;
      case 'career_milestone':
        return value.toLocaleString();
      case 'accuracy_milestone':
        return `${value}%`;
      case 'session_milestone':
        return value.toLocaleString();
      case 'competition_win':
        if (certificate.achievement_subtype === 'first_duel_victory') {
          return '1st Victory';
        } else if (certificate.achievement_subtype?.startsWith('league_championship_')) {
          const rank = certificate.achievement_subtype.split('_')[2];
          return `${rank === '1' ? '1st' : rank === '2' ? '2nd' : '3rd'} Place`;
        }
        return `Victory #${value}`;
      default:
        return value.toString();
    }
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'legendary': return '#FFD700'; // Gold
      case 'epic': return '#9f40ff'; // Purple
      case 'rare':
      default:
        return '#2D5A27'; // Masters Green
    }
  };

  const achievedDate = format(new Date(certificate.achieved_at), 'MMM dd, yyyy');
  const issuedDate = format(new Date(certificate.certificate_issued_at), 'MMM dd, yyyy');

  return (
    <div className="certificate-card" style={{ borderColor: getRarityColor(certificate.rarity_tier) }}>
      <div className="certificate-header">
        <div className="achievement-icon">{config.icon}</div>
        <div className="achievement-info">
          <h4 className="achievement-title">{config.title}</h4>
          <p className="achievement-category">{config.category}</p>
        </div>
        <div
          className="rarity-badge"
          style={{ backgroundColor: getRarityColor(certificate.rarity_tier) }}
        >
          {certificate.rarity_tier}
        </div>
      </div>

      <div className="certificate-body">
        <div className="achievement-value">
          {formatAchievementValue()}
        </div>
        <div className="achievement-description">
          {config.description}
        </div>

        <div className="certificate-dates">
          <div className="date-item">
            <span className="date-label">Achieved:</span>
            <span className="date-value">{achievedDate}</span>
          </div>
          <div className="date-item">
            <span className="date-label">Certified:</span>
            <span className="date-value">{issuedDate}</span>
          </div>
        </div>

        <div className="blockchain-info">
          <div className="blockchain-status">
            {certificate.is_verified ? (
              <span className="verified">✅ Blockchain Verified</span>
            ) : (
              <span className="pending">⏳ Processing...</span>
            )}
          </div>

          {certificate.is_verified && (
            <div className="blockchain-details">
              <div className="block-height">Block: {certificate.bitcoin_block_height}</div>
            </div>
          )}
        </div>

        <button
          className="details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '▼ Hide Details' : '▶ View Details'}
        </button>

        {showDetails && (
          <div className="certificate-details">
            <div className="detail-item">
              <span className="detail-label">Certificate ID:</span>
              <span className="detail-value cert-id">{certificate.certificate_id.slice(0, 8)}...</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Data Hash:</span>
              <span className="detail-value hash">{certificate.data_hash.slice(0, 16)}...</span>
            </div>
            {certificate.achievement_data?.session_date && (
              <div className="detail-item">
                <span className="detail-label">Session Date:</span>
                <span className="detail-value">
                  {format(new Date(certificate.achievement_data.session_date), 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
            )}

            {/* League Performance Summary for League Championships */}
            {certificate.achievement_subtype?.startsWith('league_championship_') &&
             certificate.achievement_data?.league_performance && (
              <div className="league-performance-container">
                <div className="league-performance-divider">
                  <span>League Performance Summary</span>
                </div>
                <div className="league-performance-data">
                  <div className="performance-metric">
                    <span className="metric-label">Rounds Completed:</span>
                    <span className="metric-value">{certificate.achievement_data.league_performance.number_of_rounds}</span>
                  </div>
                  <div className="performance-metric">
                    <span className="metric-label">Total Duration:</span>
                    <span className="metric-value">
                      {Math.floor(certificate.achievement_data.league_performance.total_duration / 60)}:
                      {Math.round(certificate.achievement_data.league_performance.total_duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="performance-metric">
                    <span className="metric-label">Makes/Misses:</span>
                    <span className="metric-value">
                      {certificate.achievement_data.league_performance.total_makes}/{certificate.achievement_data.league_performance.total_misses}
                    </span>
                  </div>
                  <div className="performance-metric">
                    <span className="metric-label">Accuracy:</span>
                    <span className="metric-value">{certificate.achievement_data.league_performance.accuracy}%</span>
                  </div>
                  <div className="performance-metric">
                    <span className="metric-label">Best Streak:</span>
                    <span className="metric-value">{certificate.achievement_data.league_performance.best_streak}</span>
                  </div>
                  <div className="performance-metric">
                    <span className="metric-label">PPM/MPM:</span>
                    <span className="metric-value">
                      {certificate.achievement_data.league_performance.putts_per_minute}/
                      {certificate.achievement_data.league_performance.makes_per_minute}
                    </span>
                  </div>
                  {certificate.achievement_data.league_performance.fastest_21 && (
                    <div className="performance-metric">
                      <span className="metric-label">Fastest 21:</span>
                      <span className="metric-value">{certificate.achievement_data.league_performance.fastest_21}s</span>
                    </div>
                  )}
                  <div className="performance-metric">
                    <span className="metric-label">Most in 60s:</span>
                    <span className="metric-value">{certificate.achievement_data.league_performance.most_in_60s}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const AchievementCertificates = ({ playerId, playerName, isSubscribed }) => {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const response = await fetch(`/api/certificates/${playerId}`);
        if (response.ok) {
          const data = await response.json();
          setCertificates(data.certificates || []);
        } else if (response.status === 404) {
          // No certificates yet - this is normal
          setCertificates([]);
        } else {
          throw new Error('Failed to fetch certificates');
        }
      } catch (err) {
        console.error('Error fetching certificates:', err);
        setError('Failed to load certificates');
      } finally {
        setLoading(false);
      }
    };

    if (playerId) {
      fetchCertificates();
    }
  }, [playerId]);

  if (!isSubscribed) {
    return (
      <div className="certificates-upgrade-prompt">
        <h3>🏆 Achievement Certificates</h3>
        <p>Unlock blockchain-verified certificates for your major achievements.</p>
        <div className="upgrade-info">
          <p>Premium members receive permanent, verifiable certificates for:</p>
          <ul>
            <li>📈 Session milestones (10, 21, 50, 100, 210, 420, 1000, 2100)</li>
            <li>🎯 Consecutive makes milestones (21, 42, 50, 77, 100)</li>
            <li>💯 Perfect putting sessions</li>
            <li>🏆 Career achievement milestones</li>
            <li>👑 Competition victories</li>
          </ul>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="certificates-loading">Loading certificates...</div>;
  }

  // Gracefully handle errors - show encouraging message instead
  if (error || certificates.length === 0) {
    return (
      <div className="certificates-empty">
        <h3>🏆 Achievement Certificates</h3>
        <p>Complete major achievements to earn blockchain-verified certificates!</p>
        <div className="upcoming-achievements">
          <h4>🎯 Get Started:</h4>
          <ul>
            <li>📈 Complete practice sessions to build your skills</li>
            <li>🥊 Challenge friends to duels and prove your abilities</li>
            <li>🎯 Make 21 consecutive putts for your first milestone</li>
            <li>💯 Complete a perfect session (10+ putts, 100% accuracy)</li>
            <li>🏆 Reach 1,000 career makes</li>
            <li>👑 Win your first duel</li>
          </ul>
          <p className="encouragement-text">
            Start practicing now to unlock your first achievement certificate!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="achievement-certificates">
      <div className="certificates-header">
        <h3>🏆 Achievement Certificates</h3>
        <div className="certificates-count">
          {certificates.length} Certificate{certificates.length !== 1 ? 's' : ''} Earned
        </div>
      </div>

      <div className="certificates-grid">
        {certificates.map(certificate => (
          <CertificateCard
            key={certificate.certificate_id}
            certificate={certificate}
          />
        ))}
      </div>

      <div className="certificates-footer">
        <p className="blockchain-note">
          🔗 All certificates are permanently recorded on the Bitcoin blockchain via OpenTimestamps
        </p>
      </div>
    </div>
  );
};

export default AchievementCertificates;