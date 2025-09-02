import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { useNotification } from '@/context/NotificationContext.jsx';
import { apiGetLeagueDetails, apiJoinLeague, apiInviteToLeague, apiStartSession } from '@/api.js';
import EditLeagueModal from './EditLeagueModal.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import InlineInviteForm from './InlineInviteForm.jsx';
import './Leagues.css'; // Reusing the same CSS file

const LeagueDetailPage = () => {
  const { leagueId } = useParams();
  const { playerData, playerTimezone } = useAuth();
  const { showTemporaryNotification: showNotification } = useNotification();
  const [league, setLeague] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sortOrder, setSortOrder] = useState({ type: 'default', id: null });
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const fetchLeagueDetails = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiGetLeagueDetails(leagueId, playerData.player_id);
      setLeague(data);
    } catch (err) {
      setError(err.message || 'Failed to load league details.');
      showNotification(err.message || 'Failed to load league details.', true);
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, playerData, showNotification]);

  useEffect(() => {
    fetchLeagueDetails();
  }, [fetchLeagueDetails]);

  const handleLeagueUpdated = useCallback(async () => {
    setShowEditModal(false);
    await fetchLeagueDetails(); // Refetch details to show updated schedule
    showNotification("League settings updated successfully.");
  }, [fetchLeagueDetails, showNotification]);

  const handleJoinLeague = useCallback(async () => {
    try {
      setIsJoining(true);
      await apiJoinLeague(leagueId, playerData.player_id);
      showNotification('Successfully joined the league!');
      fetchLeagueDetails(); // Refresh the lists after joining
    } catch (err) {
      showNotification(err.message || 'Failed to join league.', true);
    } finally {
      setIsJoining(false);
    }
  }, [leagueId, playerData, fetchLeagueDetails, showNotification]);

  const handleStartLeagueSession = useCallback(async (roundId) => {
    try {
      // The first argument is playerId, second is duelId (null), third is leagueRoundId
      const response = await apiStartSession(playerData.player_id, null, roundId);
      showNotification(response.message);
    } catch (err) {
      showNotification(`Failed to start league session: ${err.message}`, true);
    }
  }, [playerData, showNotification]);

  const handleInvitePlayer = useCallback(async (inviteeId) => {
    try {
      const response = await apiInviteToLeague(leagueId, playerData.player_id, inviteeId);
      showNotification(response.message);
    } catch (err) {
      showNotification(err.message, true);
    } finally {
      // Optionally refresh league details to show new members if invite is auto-accepted
      fetchLeagueDetails();
    }
  }, [leagueId, playerData, fetchLeagueDetails, showNotification]);

  const formatStat = useCallback((value, suffix = '') => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number' && value % 1 !== 0) {
      return `${value.toFixed(2)}${suffix}`;
    }
    return `${value}${suffix}`;
  }, []);

  const formatRoundDuration = useCallback((hours) => {
    if (!hours) return 'N/A';
    if (hours < 24) {
      return `${hours} Hour${hours > 1 ? 's' : ''}`;
    }
    const days = hours / 24;
    return `${days} Day${days > 1 ? 's' : ''}`;
  }, []);

  const formatDateTime = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: playerTimezone,
      }).format(new Date(dateString));
    } catch (e) { return dateString; }
  }, [playerTimezone]);

  // --- Data Transformation for Pivot Table ---
  const pointsByPlayer = useMemo(() => {
    if (!league) return new Map();
    const points = new Map(league.members.map(m => [m.player_id, 0]));
    league.rounds.forEach(round => {
      if (round.status === 'completed') {
        round.submissions.forEach(sub => {
          if (points.has(sub.player_id) && sub.points_awarded) {
            const currentPoints = points.get(sub.player_id);
            points.set(sub.player_id, currentPoints + sub.points_awarded);
          }
        });
      }
    });
    return points;
  }, [league]);

  const ranks = useMemo(() => {
    if (!league) return new Map();
    const totals = league.members.map(({ player_id: id }) => ({
      player_id: id,
      total_points: pointsByPlayer.get(id) || 0
    })).sort((a, b) => b.total_points - a.total_points);

    const ranksMap = new Map();
    let currentRank = 0;
    let lastPoints = -1;
    totals.forEach((playerTotal, index) => {
      if (playerTotal.total_points !== lastPoints) {
        currentRank = index + 1;
        lastPoints = playerTotal.total_points;
      }
      ranksMap.set(playerTotal.player_id, currentRank);
    });
    return ranksMap;
  }, [league, pointsByPlayer]);

  const handleSort = useCallback((type, id = null) => {
    setSortOrder({ type, id });
  }, []);

  const resetSort = useCallback(() => setSortOrder({ type: 'default' }), []);

  const sortedMembers = useMemo(() => {
    if (!league) return [];
    let sorted = [...league.members];

    switch (sortOrder.type) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'rank':
        sorted.sort((a, b) => (ranks.get(a.player_id) || Infinity) - (ranks.get(b.player_id) || Infinity));
        break;
      case 'points':
        sorted.sort((a, b) => (pointsByPlayer.get(b.player_id) || 0) - (pointsByPlayer.get(a.player_id) || 0));
        break;
      case 'round':
        const roundToSort = league.rounds.find(r => r.round_id === sortOrder.id);
        if (roundToSort) {
          const scores = new Map(roundToSort.submissions.map(s => [s.player_id, s.score]));
          sorted.sort((a, b) => (scores.get(b.player_id) ?? -1) - (scores.get(a.player_id) ?? -1));
        }
        break;
      case 'default':
      default:
        // No sort applied, members remain in their original order from the API
        break;
    }

    return sorted;
  }, [league, sortOrder, ranks, pointsByPlayer]);

  const activeRound = useMemo(() => {
    if (!league) return null;
    return league.rounds.find(r => r.status === 'active');
  }, [league]);

  // Early return for loading and error states to prevent crashes
  if (isLoading) return <div className="container"><p>Loading league details...</p></div>;
  if (error) return <div className="container"><p className="error-message">{error}</p></div>;
  if (!league) return <div className="container"><p>League not found.</p></div>;

  const isMember = league.members.some(m => m.player_id === playerData.player_id);
  const canInvite = league.creator_id === playerData.player_id ||
    (isMember && league.privacy_type === 'public') ||
    (isMember && league.settings.allow_player_invites); // Use the new setting
  const canJoin = !isMember &&
    league.privacy_type === 'public' &&
    (league.status === 'registering' || (league.status === 'active' && league.settings.allow_late_joiners));

  // Client-side check to handle display status if backend hasn't updated yet
  const isRoundOver = (round) => new Date(round.end_time) < new Date();
  const lastRound = league.rounds && league.rounds.length > 0 ? league.rounds[league.rounds.length - 1] : null;
  const isLeagueOver = lastRound && isRoundOver(lastRound);
  const displayLeagueStatus = league.status !== 'completed' && isLeagueOver ? 'completed' : league.status;
  
  const canEdit = league.creator_id === playerData.player_id && league.status === 'registering';

  const playerHasSubmittedForRound = (round) => {
    return round.submissions.some(s => s.player_id === playerData.player_id);
  };

  return (
    <div className="league-detail-page">
      {/* {notification && <div className="notification">{notification}</div>} */}
      {showEditModal && <EditLeagueModal league={league} onClose={() => setShowEditModal(false)} onLeagueUpdated={handleLeagueUpdated} />}
      <div className="page-header">
        <h2>{league.name}</h2>
        {activeRound && <CountdownTimer endTime={activeRound.end_time} />}
      </div>

      <div className="card league-info-card">
        <div className="section-header">
          <h3>League Description</h3>
          {canEdit && <button className="btn-tertiary btn-small" onClick={() => setShowEditModal(true)}>Edit League</button>}
        </div>
        <p className="league-description">{league.description || "No description provided."}</p>
        <div className="league-info-grid">
          <table className="league-info-table">
            <thead>
              <tr>
                <th colSpan="2">League Rules</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Status</td>
                <td><span className={`status-badge status-${displayLeagueStatus}`}>{displayLeagueStatus}</span></td>
              </tr>
              <tr>
                <td>Privacy</td>
                <td>{league.privacy_type}</td>
              </tr>
              <tr>
                <td>Starts</td>
                <td>{formatDateTime(league.start_time)}</td>
              </tr>
            </tbody>
          </table>
          <table className="league-info-table">
            <thead>
              <tr>
                <th colSpan="2">Schedule & Settings</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Time Limit</td>
                <td>{formatStat(league.settings.time_limit_minutes)} mins</td>
              </tr>
              <tr>
                <td>Rounds</td>
                <td>{league.settings.num_rounds}</td>
              </tr>
              <tr>
                <td>Round Schedule</td>
                <td>{formatRoundDuration(league.settings.round_duration_hours)}</td>
              </tr>
              <tr>
                <td>Late Join</td>
                <td>{league.settings.allow_late_joiners ? 'Allowed' : 'Not Allowed'}</td>
              </tr>
              <tr>
                <td>Player Invites</td>
                <td>{league.settings.allow_player_invites ? 'Allowed' : 'Not Allowed'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <h3>Results</h3>
          {sortOrder.type !== 'default' && <button className="btn-tertiary btn-small" onClick={resetSort}>Reset Sort</button>}
        </div>
        <div className="league-table-wrapper">
          <table className="league-pivot-table">
            <thead>
              <tr>
                <th className="sort-column"><button className="sort-button" onClick={() => handleSort('name')}>sort</button></th>
                <th className="player-name-header">Player Name</th>
                {sortedMembers.map(member => (
                  <th key={member.player_id} className="player-name">
                    <div><Link to={`/player/${member.player_id}/stats`}>{member.name}</Link></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {league.rounds.map((round) => {
                const hasSubmitted = playerHasSubmittedForRound(round);
                const displayStatus = round.status === 'active' && isRoundOver(round) ? 'completed' : round.status;
                const roundSubmissions = new Map(round.submissions.map(s => [s.player_id, s]));
                return (
                  <tr key={round.round_id}>
                    <td className="sort-column"><button className="sort-button" onClick={() => handleSort('round', round.round_id)}>sort</button></td>
                    <td className="round-label-cell">
                      <span>Round {round.round_number}</span>
                      <div className="round-status-group">
                        {displayStatus === 'scheduled' && (
                          <>
                            <span className="round-start-time-label">{formatDateTime(round.start_time)}</span>
                            <span className={`status-badge status-${displayStatus}`}>{displayStatus}</span>
                          </>
                        )}
                        {displayStatus === 'active' && (
                          <>
                            <CountdownTimer endTime={round.end_time} />
                            {isMember ? (
                              !hasSubmitted ? (
                                <button onClick={() => handleStartLeagueSession(round.round_id)} className="btn btn-small">Start</button>
                              ) : (
                                <span className="status-badge status-completed">Submitted</span>
                              )
                            ) : (
                              <span className="status-badge status-active">Active</span>
                            )}
                          </>
                        )}
                        {displayStatus === 'completed' && <span className={`status-badge status-completed`}>completed</span>}
                      </div>
                    </td>
                    {sortedMembers.map(member => {
                      const submission = roundSubmissions.get(member.player_id);
                      return <td key={member.player_id}>{submission ? submission.score : '—'}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="summary-row">
                <td className="sort-column"><button className="sort-button" onClick={() => handleSort('points')}>sort</button></td>
                <td className="round-label-cell">Total Points</td>
                {sortedMembers.map(member => <td key={member.player_id}><strong>{pointsByPlayer.get(member.player_id)}</strong></td>)}
              </tr>
              <tr className="summary-row">
                <td className="sort-column"><button className="sort-button" onClick={() => handleSort('rank')}>sort</button></td>
                <td className="round-label-cell">Rank</td>
                {sortedMembers.map(member => <td key={member.player_id}><strong>{ranks.get(member.player_id)}</strong></td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="section-header">
          <h3>Members ({league.members.length})</h3>
          <div className="member-actions">
            {canJoin && (
              <button
                className="btn"
                onClick={handleJoinLeague}
                disabled={isJoining}
              >
                {isJoining ? 'Joining...' : 'Join League'}
              </button>
            )}
            {canInvite && <InlineInviteForm onInvite={handleInvitePlayer} />} 
          </div>
        </div>
        <ul className="member-list">
          {sortedMembers.map(member => (
            <li key={member.player_id}>
              <Link to={`/player/${member.player_id}/stats`}>{member.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LeagueDetailPage;