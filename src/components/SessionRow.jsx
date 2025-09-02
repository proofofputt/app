import React from 'react';

const DetailCategory = ({ title, overview, detailed }) => {
  const overviewEntries = Object.entries(overview);
  const sortedOverview = overviewEntries.sort(([, countA], [, countB]) => countB - countA);
  const sortedDetailed = Object.entries(detailed).sort(([, countA], [, countB]) => countB - countA);

  return (
    <div className="details-section">
      <h4>{title}</h4>

      <h5>Overview</h5>
      {sortedOverview.length > 0 ? (
        <ul>
          {sortedOverview.map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {value}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontStyle: 'italic', opacity: 0.7 }}>None</p>
      )}

      <h5 style={{ marginTop: '1rem' }}>Detailed Classification</h5>
      {sortedDetailed.length > 0 ? (
        <ul>
          {sortedDetailed.map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {value}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontStyle: 'italic', opacity: 0.7 }}>None</p>
      )}
    </div>
  );
};

const SessionRow = ({ session, playerTimezone, isLocked, isExpanded, onToggleExpand }) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'N/A';
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleClick = () => {
    if (!isLocked) {
      onToggleExpand(session.session_id);
    }
  };

  return (
    <>
      <tr className={`session-row ${isExpanded ? 'is-expanded-parent' : ''} ${isLocked ? 'is-locked' : ''}`}>
        <td>
          <button 
            className="expand-button"
            onClick={handleToggleClick}
            disabled={isLocked}
            title={isLocked ? "Upgrade to view details" : (isExpanded ? "Hide details" : "Show details")}
          >
            {isLocked ? '🔒' : (isExpanded ? '▼' : '▶')}
          </button>
        </td>
        <td>{formatDate(session.created_at)}</td>
        <td>{formatDuration(session.duration)}</td>
        <td>{session.total_makes || 0}</td>
        <td>{session.total_misses || 0}</td>
        <td>{session.best_streak || 0}</td>
        <td>{session.fastest_21_makes ? `${session.fastest_21_makes.toFixed(1)}s` : 'N/A'}</td>
        <td>{session.putts_per_minute ? session.putts_per_minute.toFixed(1) : 'N/A'}</td>
        <td>{session.makes_per_minute ? session.makes_per_minute.toFixed(1) : 'N/A'}</td>
        <td>{session.most_makes_in_60_seconds || 0}</td>
      </tr>
      {isExpanded && (
        <tr className="session-details-row">
          <td colSpan="10">
            <div className="session-details">
              <h3>Session Details</h3>
              
              <div className="details-grid">
                <DetailCategory
                  title="Makes"
                  overview={session.makes_overview || {}}
                  detailed={session.makes_by_category || {}}
                />
                <DetailCategory
                  title="Misses"
                  overview={session.misses_overview || {}}
                  detailed={session.misses_by_category || {}}
                />
              </div>

              <div className="consecutive-stats">
                <h4>Consecutive Makes</h4>
                <div className="consecutive-grid">
                  {Object.entries(session.consecutive_by_category || {}).map(([threshold, count]) => (
                    <div key={threshold} className="consecutive-item">
                      <span className="consecutive-label">{threshold}+ in a row:</span>
                      <span className="consecutive-value">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default SessionRow;