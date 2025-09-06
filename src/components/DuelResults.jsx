import React from 'react';
import { Link } from 'react-router-dom';
import './DuelResults.css';

const DuelResults = ({ duel, currentUserId }) => {
  if (!duel) return null;

  const isCreator = duel.creator_id === currentUserId;
  const currentPlayer = isCreator ? 
    { id: duel.creator_id, name: duel.creator_name, session: duel.creator_session_data } :
    { id: duel.invited_player_id, name: duel.invited_player_name, session: duel.invited_session_data };
  
  const opponent = isCreator ? 
    { id: duel.invited_player_id, name: duel.invited_player_name, session: duel.invited_session_data } :
    { id: duel.creator_id, name: duel.creator_name, session: duel.creator_session_data };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatStat = (value, suffix = '') => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number' && value % 1 !== 0) {
      return `${value.toFixed(2)}${suffix}`;
    }
    return `${value}${suffix}`;
  };

  const getWinnerDisplay = () => {
    if (duel.status !== 'completed') return null;
    
    if (!duel.winner_id) return 'Draw';
    
    if (duel.winner_id === currentUserId) {
      return <span className="winner-you">You Won!</span>;
    } else {
      return <span className="winner-opponent">{opponent.name} Won</span>;
    }
  };

  const StatComparison = ({ label, currentValue, opponentValue, format = 'number', higher = 'better' }) => {
    const current = currentValue || 0;
    const opp = opponentValue || 0;
    
    let currentBetter = false;
    let opponentBetter = false;
    
    if (higher === 'better') {
      currentBetter = current > opp;
      opponentBetter = opp > current;
    } else {
      currentBetter = current < opp;
      opponentBetter = opp < current;
    }

    const formatValue = (val) => {
      if (format === 'percentage') return `${formatStat(val * 100, '%')}`;
      if (format === 'time') return `${formatStat(val, 's')}`;
      return formatStat(val);
    };

    return (
      <div className="stat-comparison">
        <div className="stat-label">{label}</div>
        <div className="stat-values">
          <div className={`stat-value ${currentBetter ? 'better' : ''}`}>
            {formatValue(current)}
          </div>
          <div className="stat-vs">vs</div>
          <div className={`stat-value ${opponentBetter ? 'better' : ''}`}>
            {formatValue(opp)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="duel-results">
      <div className="duel-results-header">
        <div className="duel-title">
          <h3>
            <Link to={`/player/${currentPlayer.id}/stats`}>{currentPlayer.name}</Link>
            {' vs '}
            <Link to={`/player/${opponent.id}/stats`}>{opponent.name}</Link>
          </h3>
        </div>
        <div className="duel-meta">
          <div className="duel-date">
            <strong>Created:</strong> {formatDate(duel.created_at)}
          </div>
          {duel.completed_at && (
            <div className="duel-completed">
              <strong>Completed:</strong> {formatDate(duel.completed_at)}
            </div>
          )}
          <div className="duel-status">
            <span className={`status-badge status-${duel.status}`}>{duel.status}</span>
          </div>
        </div>
      </div>

      {duel.status === 'completed' && (
        <div className="duel-results-body">
          <div className="winner-announcement">
            {getWinnerDisplay()}
          </div>

          {currentPlayer.session && opponent.session && (
            <div className="performance-comparison">
              <h4>Performance Comparison</h4>
              <div className="player-headers">
                <div className="player-header current">
                  <Link to={`/player/${currentPlayer.id}/stats`}>{currentPlayer.name}</Link>
                </div>
                <div className="vs-divider">vs</div>
                <div className="player-header opponent">
                  <Link to={`/player/${opponent.id}/stats`}>{opponent.name}</Link>
                </div>
              </div>

              <div className="stats-grid">
                <StatComparison
                  label="Total Putts"
                  currentValue={currentPlayer.session.total_putts}
                  opponentValue={opponent.session.total_putts}
                  higher="higher"
                />
                <StatComparison
                  label="Makes"
                  currentValue={currentPlayer.session.total_makes}
                  opponentValue={opponent.session.total_makes}
                />
                <StatComparison
                  label="Make Percentage"
                  currentValue={currentPlayer.session.total_putts > 0 ? currentPlayer.session.total_makes / currentPlayer.session.total_putts : 0}
                  opponentValue={opponent.session.total_putts > 0 ? opponent.session.total_makes / opponent.session.total_putts : 0}
                  format="percentage"
                />
                <StatComparison
                  label="Best Streak"
                  currentValue={currentPlayer.session.best_streak}
                  opponentValue={opponent.session.best_streak}
                />
                <StatComparison
                  label="Session Duration"
                  currentValue={currentPlayer.session.session_duration}
                  opponentValue={opponent.session.session_duration}
                  format="time"
                  higher="lower"
                />
              </div>

              {(currentPlayer.session.detailed_makes || opponent.session.detailed_makes) && (
                <div className="detailed-breakdown">
                  <h5>Location Breakdown</h5>
                  <div className="breakdown-comparison">
                    <div className="breakdown-section">
                      <h6>{currentPlayer.name}</h6>
                      {currentPlayer.session.detailed_makes && Object.entries(currentPlayer.session.detailed_makes)
                        .filter(([, count]) => count > 0)
                        .sort(([, countA], [, countB]) => countB - countA)
                        .map(([location, count]) => (
                          <div key={location} className="breakdown-item">
                            <span className="location">{location}:</span>
                            <span className="count">{count} makes</span>
                          </div>
                        ))}
                    </div>
                    <div className="breakdown-section">
                      <h6>{opponent.name}</h6>
                      {opponent.session.detailed_makes && Object.entries(opponent.session.detailed_makes)
                        .filter(([, count]) => count > 0)
                        .sort(([, countA], [, countB]) => countB - countA)
                        .map(([location, count]) => (
                          <div key={location} className="breakdown-item">
                            <span className="location">{location}:</span>
                            <span className="count">{count} makes</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {duel.status === 'active' && (
        <div className="duel-results-body">
          <div className="active-duel-info">
            <p>This duel is currently active. Results will be shown once both players have submitted their sessions.</p>
            {currentPlayer.session && !opponent.session && (
              <p className="submission-status">✅ You have submitted your session. Waiting for {opponent.name}...</p>
            )}
            {!currentPlayer.session && opponent.session && (
              <p className="submission-status">⏳ {opponent.name} has submitted. Your turn to submit a session!</p>
            )}
            {!currentPlayer.session && !opponent.session && (
              <p className="submission-status">⏳ Waiting for both players to submit sessions.</p>
            )}
          </div>
        </div>
      )}

      {['pending', 'declined', 'expired'].includes(duel.status) && (
        <div className="duel-results-body">
          <div className="inactive-duel-info">
            <p>
              {duel.status === 'pending' && 'This duel invitation is still pending.'}
              {duel.status === 'declined' && 'This duel invitation was declined.'}
              {duel.status === 'expired' && 'This duel has expired.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DuelResults;