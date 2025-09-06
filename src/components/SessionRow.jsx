import React, { useState } from 'react';

const DetailCategory = ({ title, overview, detailed, allDetailed }) => {
  // Filter out overview entries with 0 count
  const filteredOverview = Object.entries(overview).filter(([, count]) => count > 0);
  
  // Use allDetailed if provided (for combined makes+misses), otherwise use detailed
  const detailedData = allDetailed || detailed;
  
  // Sort detailed entries by count, descending, and filter out zeros
  const filteredAndSortedDetailed = Object.entries(detailedData)
    .filter(([, count]) => count > 0)
    .sort(([, countA], [, countB]) => countB - countA);

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
      {filteredAndSortedDetailed.length > 0 ? (
        <ul>
          {filteredAndSortedDetailed.map(([key, value]) => (
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

const ConsecutiveCategory = ({ consecutiveData }) => {
  // For consecutive makes, always show all standard thresholds, even if zero
  const standardThresholds = ['3', '7', '10', '15', '21', '50', '100'];
  const data = consecutiveData || {};
  
  // Create entries for all standard thresholds, using data or 0
  const consecutiveEntries = standardThresholds.map(threshold => [
    threshold, 
    data[threshold] || 0
  ]);
  
  return (
    <div className="details-section">
      <h4>Consecutive Makes</h4>
      <ul>
        {consecutiveEntries.map(([threshold, count]) => (
          <li key={threshold}>
            <strong>{threshold}+ in a row:</strong> {count}
          </li>
        ))}
      </ul>
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
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleClick = () => {
    if (!isLocked) {
      onToggleExpand(session.session_id);
    }
  };

  // Parse session data - try multiple sources for backwards compatibility
  const sessionData = parseJsonData(session.data) || {};
  
  // Debug logging (can be removed in production)
  if (isExpanded && process.env.NODE_ENV === 'development') {
    console.log(`[SessionRow] Session ${session.session_id} expanded - analytics data:`, {
      makes_by_category: session.makes_by_category,
      misses_by_category: session.misses_by_category,
      consecutive_by_category: session.consecutive_by_category
    });
  }
  const makesByCategory = session.makes_by_category || parseJsonData(session.makes_by_category) || parseJsonData(sessionData.makes_by_category);
  const missesByCategoryFromDB = session.misses_by_category || parseJsonData(session.misses_by_category) || parseJsonData(sessionData.misses_by_category);
  const puttList = session.putt_list || parseJsonData(session.putt_list) || parseJsonData(sessionData.putt_list);

  // --- Use Makes Categories from API (new structure) ---
  const makesOverview = session.makes_overview || { TOP: 0, RIGHT: 0, LOW: 0, LEFT: 0 };
  const makesDetailed = makesByCategory || {};

  // --- Use Misses Categories from API (new structure) ---  
  const missesOverview = session.misses_overview || { RETURN: 0, CATCH: 0, TIMEOUT: 0, "QUICK PUTT": 0 };
  const missesDetailed = missesByCategoryFromDB || {};

  // --- Combine all detailed classifications (makes + misses) ---
  const allDetailed = { ...makesDetailed, ...missesDetailed };

  const hasDetailedData = Object.keys(makesDetailed).length > 0 || Object.keys(missesDetailed).length > 0 || 
    (session.makes_overview && Object.values(session.makes_overview).some(v => v > 0)) ||
    (session.misses_overview && Object.values(session.misses_overview).some(v => v > 0)) ||
    (sessionData && (Object.keys(sessionData.makes_overview || {}).length > 0 || 
     Object.keys(sessionData.misses_overview || {}).length > 0)) ||
    (sessionData && (sessionData.makes_by_category || sessionData.misses_by_category || sessionData.consecutive_by_category)) ||
    // Check session object directly for the analytics fields
    (session.makes_by_category || session.misses_by_category || session.consecutive_by_category);

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
        <td>{session.fastest_21_makes_seconds ? `${Math.round(session.fastest_21_makes_seconds)}s` : 'N/A'}</td>
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
                <div className="details-grid">
                  <DetailCategory
                    title="Makes By Category"
                    overview={makesOverview}
                    detailed={makesDetailed}
                    allDetailed={allDetailed}
                  />
                  <DetailCategory
                    title="Misses By Category"
                    overview={missesOverview}
                    detailed={missesDetailed}
                    allDetailed={allDetailed}
                  />
                  <ConsecutiveCategory
                    consecutiveData={session.consecutive_by_category || sessionData?.consecutive_by_category || parseJsonData(session.consecutive_by_category)}
                  />
                </div>
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