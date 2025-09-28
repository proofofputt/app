import React, { useState } from 'react';

const DetailCategory = ({ title, overview, detailed, allDetailed }) => {
  // Filter out overview entries with 0 count
  const filteredOverview = Object.entries(overview).filter(([, count]) => count > 0);
  
  // Use only detailed data specific to this category (no mixed data)
  const detailedData = detailed;
  
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
  const standardThresholds = ['3', '7', '10', '15', '21', '42', '50', '77', '100'];
  
  // Parse the data if it's a JSON string
  let data = {};
  if (consecutiveData) {
    if (typeof consecutiveData === 'string') {
      try {
        data = JSON.parse(consecutiveData);
      } catch (e) {
        console.error('Failed to parse consecutive data:', e);
        data = {};
      }
    } else if (typeof consecutiveData === 'object') {
      data = consecutiveData;
    }
  }
  
  // Create entries for all standard thresholds, using data or 0
  const consecutiveEntries = standardThresholds.map(threshold => [
    threshold, 
    data[threshold] || 0
  ]);
  
  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && Object.keys(data).length > 0) {
    console.log('[ConsecutiveCategory] Parsed data:', data);
    console.log('[ConsecutiveCategory] Entries:', consecutiveEntries);
  }
  
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

const SessionRow = ({ session, playerTimezone, isLocked, dailySessionNumber }) => {
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
    const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return dailySessionNumber ? `${dateFormatted} #${dailySessionNumber}` : dateFormatted;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const totalSeconds = Math.round(seconds);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };



  return (
    <tr className={`session-row ${isLocked ? 'is-locked' : ''}`}>
      <td style={{ textAlign: 'center' }}>
        {isLocked ? '🔒' : ''}
      </td>
      <td style={{ textAlign: 'center' }}>{formatDate(session.created_at || session.start_time)}</td>
      <td style={{ textAlign: 'center' }}>{
        session.competition ? (
          session.competition.type === 'duel' ? (
            <span className="competition-badge duel-badge" title={`Duel vs ${session.competition.opponent_name}`}>
              Duel
            </span>
          ) : (
            <span className="competition-badge league-badge" title={`${session.competition.league_name} Round ${session.competition.round_number}`}>
              League
            </span>
          )
        ) : (
          <span className="competition-badge practice-badge">
            Practice
          </span>
        )
      }</td>
      <td style={{ textAlign: 'center' }}>{formatDuration(session.session_duration ?? session.duration)}</td>
      <td style={{ textAlign: 'center' }}>{session.makes ?? session.total_makes ?? 0}</td>
      <td style={{ textAlign: 'center' }}>{session.misses ?? session.total_misses ?? 0}</td>
      <td style={{ textAlign: 'center' }}>{session.best_streak || 0}</td>
      <td style={{ textAlign: 'center' }}>{session.fastest_21_makes ? `${Math.round(session.fastest_21_makes)}s` : 'N/A'}</td>
      <td style={{ textAlign: 'center' }}>{session.putts_per_minute?.toFixed(1) ?? 'N/A'}</td>
      <td style={{ textAlign: 'center' }}>{session.makes_per_minute?.toFixed(1) ?? 'N/A'}</td>
      <td style={{ textAlign: 'center' }}>{session.most_makes_in_60_seconds || 0}</td>
    </tr>
  );
};

export default SessionRow;