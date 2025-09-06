import React, { useState } from 'react';

const DetailCategory = ({ title, overview, detailed }) => {
  // Filter out overview entries with 0 count (from early prototype logic)
  const filteredOverview = Object.entries(overview).filter(([, count]) => count > 0);
  // Sort detailed entries by count, descending.
  const sortedDetailed = Object.entries(detailed).sort(([, countA], [, countB]) => countB - countA);

  return (
    <div className="details-section">
      <h4>{title}</h4>

      <h5>Overview</h5>
      {filteredOverview.length > 0 ? (
        <ul>
          {filteredOverview.map(([key, value]) => (
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
  // Safely parse JSON data from the session
  const parseJsonData = (jsonString) => {
    if (!jsonString) return null;
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch (e) {
      console.error("Failed to parse session JSON data:", e);
      return null;
    }
  };
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date)) {
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

  // Parse session data - try multiple sources for backwards compatibility
  const sessionData = parseJsonData(session.data) || {};
  const makesByCategory = parseJsonData(session.makes_by_category) || parseJsonData(sessionData.makes_by_category);
  const missesByCategoryFromDB = parseJsonData(session.misses_by_category) || parseJsonData(sessionData.misses_by_category);
  const puttList = parseJsonData(session.putt_list) || parseJsonData(sessionData.putt_list);

  // --- Use Makes Categories from API (new structure) or calculate from detailed data (backwards compatibility) ---
  const makesOverview = session.makes_overview || { TOP: 0, RIGHT: 0, LOW: 0, LEFT: 0 };
  const makesDetailed = {};
  if (makesByCategory) {
    for (const [classification, count] of Object.entries(makesByCategory)) {
      makesDetailed[classification] = count;
      // Update overview if not provided by API
      if (!session.makes_overview) {
        if (classification.includes('TOP')) makesOverview.TOP += count;
        if (classification.includes('RIGHT')) makesOverview.RIGHT += count;
        if (classification.includes('LOW')) makesOverview.LOW += count;
        if (classification.includes('LEFT')) makesOverview.LEFT += count;
      }
    }
  }

  // --- Use Misses Categories from API (new structure) or calculate from detailed data (backwards compatibility) ---
  const missesOverview = session.misses_overview || missesByCategoryFromDB || { RETURN: 0, CATCH: 0, TIMEOUT: 0 };
  const missesDetailed = {};
  if (puttList) {
    const missPutts = puttList.filter(p => p['Putt Classification'] === 'MISS');
    for (const putt of missPutts) {
      // The detailed classification from the putt list includes "MISS - " which we can remove for cleaner display
      const detail = putt['Putt Detailed Classification']?.replace('MISS - ', '') || 'Unknown';
      missesDetailed[detail] = (missesDetailed[detail] || 0) + 1;
    }
  }

  const hasDetailedData = Object.keys(makesDetailed).length > 0 || Object.keys(missesDetailed).length > 0 || 
    (session.makes_overview && Object.values(session.makes_overview).some(v => v > 0)) ||
    (session.misses_overview && Object.values(session.misses_overview).some(v => v > 0)) ||
    (sessionData && (Object.keys(sessionData.makes_overview || {}).length > 0 || 
     Object.keys(sessionData.misses_overview || {}).length > 0));

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
        <td>{formatDuration(session.session_duration ?? session.duration)}</td>
        <td>{session.makes ?? session.total_makes ?? 0}</td>
        <td>{session.misses ?? session.total_misses ?? 0}</td>
        <td>{session.best_streak || 0}</td>
        <td>{session.fastest_21_makes_seconds ? `${session.fastest_21_makes_seconds.toFixed(1)}s` : 'N/A'}</td>
        <td>{session.putts_per_minute?.toFixed(1) ?? 'N/A'}</td>
        <td>{session.makes_per_minute?.toFixed(1) ?? 'N/A'}</td>
        <td>{session.most_makes_in_60_seconds || 0}</td>
      </tr>
      {isExpanded && (
        <tr className="session-details-row">
          <td colSpan="10">
            <div className="session-details">
              <h3>Session Details</h3>
              {hasDetailedData ? (
                <>
                  <div className="details-grid">
                    <DetailCategory
                      title="Makes By Category"
                      overview={makesOverview}
                      detailed={makesDetailed}
                    />
                    <DetailCategory
                      title="Misses By Category"
                      overview={missesOverview}
                      detailed={missesDetailed}
                    />
                  </div>

                  {(session.consecutive_by_category || sessionData?.consecutive_by_category || parseJsonData(session.consecutive_by_category)) && (
                    <div className="consecutive-stats">
                      <h4>Consecutive Makes</h4>
                      <div className="consecutive-grid">
                        {Object.entries(session.consecutive_by_category || sessionData?.consecutive_by_category || parseJsonData(session.consecutive_by_category) || {}).map(([threshold, count]) => (
                          <div key={threshold} className="consecutive-item">
                            <span className="consecutive-label">{threshold}+ in a row:</span>
                            <span className="consecutive-value">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="placeholder-text">Detailed analytics are not available for this session. Upload new sessions from the desktop app to see make/miss breakdowns by location.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default SessionRow;