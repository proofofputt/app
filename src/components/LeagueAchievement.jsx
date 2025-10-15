import React, { useState, useEffect } from 'react';
import './LeagueAchievement.css';

/**
 * League Achievement Component
 *
 * Displays aggregated performance data for a player across all league rounds.
 * Shows total time, makes, misses, and best stats across all rounds.
 * Used in certificate details and league detail pages.
 */
const LeagueAchievement = ({ playerId, leagueId, leagueData = null }) => {
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLeaguePerformance = async () => {
      try {
        setLoading(true);
        setError('');

        // If leagueData is provided, calculate from that
        if (leagueData && leagueData.rounds && leagueData.members) {
          const playerMember = leagueData.members.find(m => m.player_id === parseInt(playerId));
          if (!playerMember) {
            setError('Player not found in league');
            return;
          }

          // Calculate aggregated performance from all rounds
          const aggregatedData = calculatePerformanceFromLeagueData(leagueData, parseInt(playerId));
          setPerformanceData(aggregatedData);
        } else {
          // Fetch performance data from API
          const response = await fetch(`/api/league-performance/${leagueId}/${playerId}`);
          if (response.ok) {
            const data = await response.json();
            setPerformanceData(data.performance);
          } else if (response.status === 404) {
            setPerformanceData(null); // No performance data yet
          } else {
            throw new Error('Failed to fetch league performance');
          }
        }
      } catch (err) {
        console.error('Error fetching league performance:', err);
        setError('Failed to load performance data');
      } finally {
        setLoading(false);
      }
    };

    if (playerId && leagueId) {
      fetchLeaguePerformance();
    }
  }, [playerId, leagueId, leagueData]);

  const calculatePerformanceFromLeagueData = (leagueData, targetPlayerId) => {
    const playerRounds = [];

    // Extract player's sessions from all rounds
    leagueData.rounds.forEach(round => {
      if (round.sessions) {
        const playerSession = round.sessions.find(s => s.player_id === targetPlayerId);
        if (playerSession && playerSession.data) {
          playerRounds.push({
            round_number: round.round_number,
            session_data: playerSession.data,
            submitted_at: playerSession.submitted_at
          });
        }
      }
    });

    if (playerRounds.length === 0) {
      return null;
    }

    // Calculate totals and best stats
    let totalMakes = 0;
    let totalMisses = 0;
    let totalDuration = 0;
    let bestStreak = 0;
    let fastest21 = null;
    let mostIn60s = 0;

    playerRounds.forEach(round => {
      const data = round.session_data;
      totalMakes += data.total_makes || 0;
      totalMisses += data.total_misses || 0;
      totalDuration += data.session_duration_seconds || 0;

      // Best stats across all rounds
      bestStreak = Math.max(bestStreak, data.best_streak || 0);
      if (data.fastest_21_makes && (fastest21 === null || data.fastest_21_makes < fastest21)) {
        fastest21 = data.fastest_21_makes;
      }
      mostIn60s = Math.max(mostIn60s, data.most_makes_in_60_seconds || 0);
    });

    const totalPutts = totalMakes + totalMisses;
    const accuracy = totalPutts > 0 ? (totalMakes / totalPutts * 100) : 0;

    // Calculate rates based on total time and performance
    const ppm = totalDuration > 0 ? (totalPutts / (totalDuration / 60)) : 0;
    const mpm = totalDuration > 0 ? (totalMakes / (totalDuration / 60)) : 0;

    // Expected total time based on round time limit and number of rounds
    const roundTimeLimit = leagueData.settings?.time_limit_seconds || 300; // 5 minutes default
    const expectedTotalDuration = roundTimeLimit * playerRounds.length;

    return {
      number_of_rounds: playerRounds.length,
      total_makes: totalMakes,
      total_misses: totalMisses,
      total_putts: totalPutts,
      accuracy: parseFloat(accuracy.toFixed(2)),
      total_duration: totalDuration,
      expected_duration: expectedTotalDuration,
      best_streak: bestStreak,
      fastest_21: fastest21,
      most_in_60s: mostIn60s,
      putts_per_minute: parseFloat(ppm.toFixed(2)),
      makes_per_minute: parseFloat(mpm.toFixed(2)),
      round_time_limit: roundTimeLimit
    };
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const totalSeconds = Math.round(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="league-achievement">
        <div className="performance-loading">Loading performance summary...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="league-achievement">
        <div className="performance-error">⚠️ {error}</div>
      </div>
    );
  }

  if (!performanceData) {
    return (
      <div className="league-achievement">
        <div className="no-performance-data">
          <p>No league performance data available yet.</p>
          <small>Complete some league rounds to see your summary!</small>
        </div>
      </div>
    );
  }

  return (
    <div className="league-achievement">
      <div className="performance-header">
        <h4>League Performance Overview</h4>
        <div className="rounds-completed">
          {performanceData.number_of_rounds} Round{performanceData.number_of_rounds !== 1 ? 's' : ''} Completed
        </div>
      </div>

      <div className="performance-stats-grid">
        {/* Basic Performance Stats */}
        <div className="stat-group">
          <h5>Overall Performance</h5>
          <div className="stat-row">
            <span className="stat-label">Duration:</span>
            <span className="stat-value">{formatDuration(performanceData.total_duration)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Makes:</span>
            <span className="stat-value">{performanceData.total_makes}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Misses:</span>
            <span className="stat-value">{performanceData.total_misses}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Accuracy:</span>
            <span className="stat-value">{performanceData.accuracy}%</span>
          </div>
        </div>

        {/* Best Performance Stats */}
        <div className="stat-group">
          <h5>Best Stats</h5>
          <div className="stat-row">
            <span className="stat-label">Best Streak:</span>
            <span className="stat-value">{performanceData.best_streak}</span>
          </div>
          {performanceData.fastest_21 && (
            <div className="stat-row">
              <span className="stat-label">Fastest 21:</span>
              <span className="stat-value">{performanceData.fastest_21}s</span>
            </div>
          )}
          <div className="stat-row">
            <span className="stat-label">Most in 60s:</span>
            <span className="stat-value">{performanceData.most_in_60s}</span>
          </div>
        </div>

        {/* Rate Statistics */}
        <div className="stat-group">
          <h5>Performance Rates</h5>
          <div className="stat-row">
            <span className="stat-label">PPM:</span>
            <span className="stat-value">{performanceData.putts_per_minute}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">MPM:</span>
            <span className="stat-value">{performanceData.makes_per_minute}</span>
          </div>
        </div>
      </div>

      <div className="performance-note">
        <small>
          * Duration and rates calculated across all {performanceData.number_of_rounds} completed rounds
          {performanceData.round_time_limit &&
            ` (${performanceData.round_time_limit / 60}min per round)`
          }
        </small>
      </div>
    </div>
  );
};

export default LeagueAchievement;