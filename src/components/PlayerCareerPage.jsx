import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGetCareerStats, apiListDuels, apiListLeagues } from '@/api.js';
import { useAuth } from '@/context/AuthContext.jsx';
import './PlayerCareerPage.css';

const StatRow = ({ label, best, cumulative, isSubscribed, unit = '' }) => {
  const formatValue = (value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
    if (typeof value === 'number' && value % 1 !== 0) return `${value.toFixed(2)}${unit}`;
    return `${value}${unit}`;
  };

  return (
    <tr>
      <td>{label}</td>
      <td className={!isSubscribed ? 'blurred-stat' : ''}>{formatValue(best)}</td>
      <td className={!isSubscribed ? 'blurred-stat' : ''}>{formatValue(cumulative)}</td>
    </tr>
  );
};

const UpgradePrompt = () => (
  <div className="upgrade-prompt">
    <h3>Unlock Your Full Career Stats</h3>
    <p>Your stats are being tracked, but you need a full subscription to view your detailed history and trends.</p>
    <Link to="/settings" className="btn">Upgrade Now</Link>
  </div>
);

const PlayerCareerPage = () => {
  const { playerId } = useParams();
  const { playerData } = useAuth(); // Get current user's data
  const isSubscribed = playerData?.subscription_status === 'active';
  const [stats, setStats] = useState(null);
  const [duels, setDuels] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAllData = useCallback(async () => {
      setIsLoading(true);
      setError('');
      try {
        const [careerStats, playerDuels, playerLeagues] = await Promise.all([
          apiGetCareerStats(playerId),
          apiListDuels(playerId),
          apiListLeagues(playerId)
        ]);
        setStats(careerStats);
        setDuels(playerDuels);
        setLeagues(playerLeagues.my_leagues || []); // Assuming my_leagues is the relevant part
      } catch (err) {
        setError(err.message || 'Failed to fetch data.');
      } finally {
        setIsLoading(false);
      }
  }, [playerId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  if (isLoading) return <p>Loading career stats...</p>;
  if (error || !stats) return <p className="error-message">{error || 'Could not load stats for this player.'}</p>;

  const {
    player_name,
    consecutive = {},
    makes_overview = {},
    makes_detailed = {},
    misses_overview = {},
    misses_detailed = {}
  } = stats || {};
  const isViewingOwnProfile = playerData && playerData.player_id === parseInt(playerId);

  return (
    <div className="career-stats-page">
      <div className="page-header">
        <h2>Career Stats: {player_name}</h2>
      </div>
      {isViewingOwnProfile && !isSubscribed && <UpgradePrompt />}
      
      <div className="stats-split-grid">
        <table className="career-stats-table">
          <thead>
            <tr><th>Performance Overview</th><th>All-Time Best</th><th>All-Time Total</th></tr>
          </thead>
          <tbody>
            <StatRow label="Makes" best={stats.high_makes} cumulative={stats.sum_makes} isSubscribed={isSubscribed} />
            <StatRow label="Best Streak" best={stats.high_best_streak} cumulative="-" isSubscribed={isSubscribed} />
            <StatRow label="Fastest 21" best={stats.low_fastest_21} cumulative="-" isSubscribed={isSubscribed} unit="s" />
            <StatRow label="Most in 60s" best={stats.high_most_in_60} cumulative="-" isSubscribed={isSubscribed} />
            <StatRow label="Putts Per Minute" best={stats.high_ppm} cumulative={stats.avg_ppm} isSubscribed={isSubscribed} />
            <StatRow label="Makes Per Minute" best={stats.high_mpm} cumulative={stats.avg_mpm} isSubscribed={isSubscribed} />
            <StatRow label="Session Duration" best={stats.high_duration / 60} cumulative={stats.sum_duration / 60} isSubscribed={isSubscribed} unit="m" />
          </tbody>
        </table>

        <table className="career-stats-table">
          <thead>
            <tr><th>Consecutive Makes</th><th>All-Time Best</th><th>All-Time Total</th></tr>
          </thead>
          <tbody>
            {Object.entries(consecutive).map(([cat, data]) => (
              <StatRow key={cat} label={cat} best={data.high} cumulative={data.sum} isSubscribed={isSubscribed} />
            ))}
          </tbody>
        </table>

        <table className="career-stats-table">
          <thead>
            <tr><th>Makes by Category</th><th>All-Time Best</th><th>All-Time Total</th></tr>
          </thead>
          <tbody>
            <tr className="table-category-header"><td colSpan="3">Overview</td></tr>
            {Object.entries(makes_overview).sort(([,a],[,b]) => b.sum - a.sum).map(([cat, data]) => (
              <StatRow key={cat} label={cat} best={data.high} cumulative={data.sum} isSubscribed={isSubscribed} />
            ))}
            <tr className="table-category-header"><td colSpan="3">Detailed</td></tr>
            {Object.entries(makes_detailed).sort(([,a],[,b]) => b.sum - a.sum).map(([cat, data]) => (
              <StatRow key={cat} label={cat} best={data.high} cumulative={data.sum} isSubscribed={isSubscribed} />
            ))}
          </tbody>
        </table>

        <table className="career-stats-table">
          <thead>
            <tr><th>Misses by Category</th><th>All-Time Worst</th><th>All-Time Total</th></tr>
          </thead>
          <tbody>
            <tr className="table-category-header"><td colSpan="3">Overview</td></tr>
            {Object.entries(misses_overview).sort(([,a],[,b]) => b.sum - a.sum).map(([cat, data]) => (
              <StatRow key={cat} label={cat.replace(/_/g, ' ')} best={data.high} cumulative={data.sum} isSubscribed={isSubscribed} />
            ))}
            <tr className="table-category-header"><td colSpan="3">Detailed</td></tr>
            {Object.entries(misses_detailed).sort(([,a],[,b]) => b.sum - a.sum).map(([cat, data]) => (
              <StatRow key={cat} label={cat.replace(/_/g, ' ')} best={data.high} cumulative={data.sum} isSubscribed={isSubscribed} />
            ))}
          </tbody>
        </table>
      </div>

      {isSubscribed ? (
        <div className="summary-tables-grid">
          <div className="summary-table-container">
            <h3>Duels</h3>
            <table className="career-stats-table">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th>Status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {duels.filter(d => ['accepted', 'completed'].includes(d.status)).length > 0 ? (
                  duels
                    .filter(d => ['accepted', 'completed'].includes(d.status)) // Filter for active and completed
                    .map(duel => {
                      const isCreator = duel.creator_id === parseInt(playerId);
                      const opponentName = isCreator ? duel.invited_player_name : duel.creator_name;
                      const opponentId = isCreator ? duel.invited_player_id : duel.creator_id;
                      const myScore = isCreator ? duel.creator_makes : duel.invited_makes;
                      const opponentScore = isCreator ? duel.invited_makes : duel.creator_makes;
                      let resultText = '';
                      if (duel.status === 'completed') {
                        if (duel.winner_id === null) resultText = 'Draw';
                        else if (duel.winner_id === parseInt(playerId)) resultText = 'Won';
                        else resultText = 'Lost';
                      }

                      return (
                        <tr key={duel.duel_id}>
                          <td><Link to={`/player/${opponentId}/stats`}>{opponentName}</Link></td>
                          <td>
                            <span className={`status-badge status-${resultText.toLowerCase() || (duel.status === 'accepted' ? 'pending' : duel.status)}`}>
                              {resultText || 'Active'}
                            </span>
                          </td>
                          <td>{duel.status === 'completed' ? `${myScore ?? 'N/A'} - ${opponentScore ?? 'N/A'}` : '—'}</td>
                        </tr>
                      );
                    })
                ) : (
                  <tr><td colSpan="3" style={{ fontStyle: 'italic' }}>No active or completed duels found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="summary-table-container">
            <h3>Leagues</h3>
            <table className="career-stats-table">
              <thead>
                <tr>
                  <th>League Name</th>
                  <th>Status</th>
                  <th>Rank</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {leagues.filter(l => ['active', 'completed'].includes(l.status)).length > 0 ? (
                  leagues
                    .filter(l => ['active', 'completed'].includes(l.status)) // Filter for active and completed
                    .map(league => (
                    <tr key={league.league_id}>
                      <td><Link to={`/leagues/${league.league_id}`}>{league.name}</Link></td>
                      <td>
                        <span className={`status-badge ${league.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                          {league.status === 'active' && league.active_round_number ? `Round ${league.active_round_number}` : (league.status === 'completed' ? 'Complete' : 'Active')}
                        </span>
                      </td>
                      <td>{league.rank || 'N/A'}</td>
                      <td>{league.score || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" style={{ fontStyle: 'italic' }}>No active or completed leagues found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="summary-tables-grid">
          <div className="summary-table-container">
            <h3>Recent Duels</h3>
            <UpgradePrompt />
          </div>
          <div className="summary-table-container">
            <h3>My Leagues</h3>
            <UpgradePrompt />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerCareerPage;