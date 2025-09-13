import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiGetLeaderboard } from '../api';
import LeaderboardCard from '../components/LeaderboardCard';
import './PlayerVsPlayerPage.css';

const PlayerVsPlayerPage = () => {
  const { player1Id, player2Id } = useParams();
  const { playerData } = useAuth();
  const [comparisonData, setComparisonData] = useState(null);
  const [duelsLeaderboardData, setDuelsLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch comparison data based on URL parameters
  useEffect(() => {
    const fetchComparison = async () => {
      if (player1Id && player2Id) {
        setLoading(true);
        setError('');
        setComparisonData(null);
        try {
          const response = await fetch(`/api/compare?player1_id=${player1Id}&player2_id=${player2Id}`);
          if (!response.ok) throw new Error('Failed to fetch comparison data.');
          const data = await response.json();
          setComparisonData(data);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchComparison();
  }, [player1Id, player2Id]);

  // Fetch duels-only leaderboard between these two players
  useEffect(() => {
    const fetchDuelsLeaderboard = async () => {
      if (!player1Id || !player2Id) return;
      
      try {
        const results = await Promise.allSettled([
          apiGetLeaderboard({ 
            metric: 'total_makes', 
            context_type: 'custom', 
            player_ids: [parseInt(player1Id), parseInt(player2Id)]
          }),
          apiGetLeaderboard({ 
            metric: 'best_streak', 
            context_type: 'custom', 
            player_ids: [parseInt(player1Id), parseInt(player2Id)]
          }),
          apiGetLeaderboard({ 
            metric: 'makes_per_minute', 
            context_type: 'custom', 
            player_ids: [parseInt(player1Id), parseInt(player2Id)]
          }),
          apiGetLeaderboard({ 
            metric: 'fastest_21_makes_seconds', 
            context_type: 'custom', 
            player_ids: [parseInt(player1Id), parseInt(player2Id)]
          }),
        ]);

        const [topMakesResult, topStreaksResult, topMpmResult, fastest21Result] = results;

        const newDuelsLeaderboardData = {
          top_makes: topMakesResult.status === 'fulfilled' ? topMakesResult.value?.leaderboard ?? [] : [],
          top_streaks: topStreaksResult.status === 'fulfilled' ? topStreaksResult.value?.leaderboard ?? [] : [],
          top_makes_per_minute: topMpmResult.status === 'fulfilled' ? topMpmResult.value?.leaderboard ?? [] : [],
          fastest_21: fastest21Result.status === 'fulfilled' ? fastest21Result.value?.leaderboard ?? [] : [],
        };
        setDuelsLeaderboardData(newDuelsLeaderboardData);
      } catch (error) {
        console.error("Could not fetch duels leaderboard data:", error);
      }
    };

    fetchDuelsLeaderboard();
  }, [player1Id, player2Id]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const getDuelResult = (duel, playerId) => {
    if (duel.status !== 'completed') return '-';
    if (duel.creator_id === parseInt(playerId)) {
      return duel.creator_score || 0;
    } else {
      return duel.invited_player_score || 0;
    }
  };

  const getDuelStatus = (duel) => {
    if (duel.status === 'completed') return 'Completed';
    if (duel.status === 'active') return 'Active';
    if (duel.status === 'pending') return 'Pending';
    if (duel.status === 'expired') return 'Expired';
    return duel.status;
  };

  const renderPlayerCard = (playerStats) => (
    <div className="player-card">
      <h3>{playerStats.player_name}</h3>
      <div className="stat-item">
        <span className="stat-label">Total Makes</span>
        <span className="stat-value">{playerStats.sum_makes}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Best Streak</span>
        <span className="stat-value">{playerStats.high_best_streak}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Avg. Putts/Min</span>
        <span className="stat-value">{playerStats.avg_ppm.toFixed(2)}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">Avg. Accuracy</span>
        <span className="stat-value">{playerStats.avg_accuracy.toFixed(2)}%</span>
      </div>
    </div>
  );

  if (loading) {
    return <div className="pvp-page"><div className="pvp-loading">Loading player comparison...</div></div>;
  }

  if (error) {
    return <div className="pvp-page"><div className="pvp-error">{error}</div></div>;
  }

  if (!comparisonData) {
    return <div className="pvp-page"><div className="pvp-loading">Loading...</div></div>;
  }

  return (
    <div className="pvp-page">
      <h2>{comparisonData.player1_stats.player_name} vs {comparisonData.player2_stats.player_name}</h2>
      
      {/* Player Comparison Cards */}
      <div className="comparison-area">
        {renderPlayerCard(comparisonData.player1_stats)}
        <div className="h2h-results">
          <h4>Head-to-Head</h4>
          <div className="h2h-score">
            <span>{comparisonData.h2h.player1_wins} - {comparisonData.h2h.player2_wins}</span>
          </div>
          <span>({comparisonData.h2h.total_completed_duels} Completed Duels)</span>
        </div>
        {renderPlayerCard(comparisonData.player2_stats)}
      </div>

      {/* Duels-Only Leaderboard */}
      {duelsLeaderboardData && (
        <div className="duels-leaderboard-container">
          <h3>Head-to-Head Leaderboard</h3>
          <p>All-time high scores comparison between these two players</p>
          <div className="leaderboard-grid">
            <LeaderboardCard title="Most Makes" leaders={duelsLeaderboardData?.top_makes} />
            <LeaderboardCard title="Best Streak" leaders={duelsLeaderboardData?.top_streaks} />
            <LeaderboardCard title="Makes/Min" leaders={duelsLeaderboardData?.top_makes_per_minute} />
            <LeaderboardCard title="Fastest 21" leaders={duelsLeaderboardData?.fastest_21} />
          </div>
        </div>
      )}

      {/* Duel History Table */}
      <div className="duel-history-container">
        <h3>Duel History</h3>
        <div className="duel-table-wrapper">
          <table className="duel-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>{comparisonData.player1_stats.player_name}</th>
                <th>{comparisonData.player2_stats.player_name}</th>
                <th>Status</th>
                <th>Winner</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.duel_history && comparisonData.duel_history.length > 0 ? (
                comparisonData.duel_history.map((duel) => {
                  const player1Score = getDuelResult(duel, player1Id);
                  const player2Score = getDuelResult(duel, player2Id);
                  const winnerName = duel.winner_id === parseInt(player1Id) 
                    ? comparisonData.player1_stats.player_name
                    : duel.winner_id === parseInt(player2Id)
                    ? comparisonData.player2_stats.player_name
                    : '-';
                  
                  return (
                    <tr key={duel.duel_id}>
                      <td>{formatDate(duel.created_at)}</td>
                      <td className="score-cell">{player1Score}</td>
                      <td className="score-cell">{player2Score}</td>
                      <td>
                        <span className={`status-badge status-${duel.status}`}>
                          {getDuelStatus(duel)}
                        </span>
                      </td>
                      <td className="winner-cell">{winnerName}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">
                    No duels found between these players
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlayerVsPlayerPage;
