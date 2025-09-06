import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import './DuelHistoryStats.css';

const DuelHistoryStats = ({ duels, currentUserId, playerData }) => {
  const duelStats = useMemo(() => {
    if (!duels || duels.length === 0) {
      return {
        total: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winPercentage: 0,
        recentOpponents: [],
        bestStreak: 0,
        currentStreak: 0,
        averageSessionStats: {},
        headToHeadRecords: new Map()
      };
    }

    const completedDuels = duels.filter(d => d.status === 'completed');
    
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let currentStreak = 0;
    let bestStreak = 0;
    let streakType = null; // 'win' or 'loss'
    let tempStreak = 0;
    let tempStreakType = null;
    
    const opponentMap = new Map();
    const headToHeadRecords = new Map();
    const sessionStats = [];

    // Process duels in chronological order for streak calculation
    const sortedDuels = [...completedDuels].sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at));
    
    sortedDuels.forEach((duel) => {
      const isWin = duel.winner_id === currentUserId;
      const isDraw = !duel.winner_id;
      const opponentId = duel.creator_id === currentUserId ? duel.invited_player_id : duel.creator_id;
      const opponentName = duel.creator_id === currentUserId ? duel.invited_player_name : duel.creator_name;
      
      // Win/Loss/Draw counting
      if (isWin) wins++;
      else if (isDraw) draws++;
      else losses++;

      // Track opponents
      if (!opponentMap.has(opponentId)) {
        opponentMap.set(opponentId, {
          id: opponentId,
          name: opponentName,
          duels: 0,
          wins: 0,
          losses: 0,
          draws: 0
        });
      }
      
      const opponentRecord = opponentMap.get(opponentId);
      opponentRecord.duels++;
      if (isWin) opponentRecord.wins++;
      else if (isDraw) opponentRecord.draws++;
      else opponentRecord.losses++;

      // Head-to-head records for the map
      const recordKey = `${Math.min(currentUserId, opponentId)}-${Math.max(currentUserId, opponentId)}`;
      if (!headToHeadRecords.has(recordKey)) {
        headToHeadRecords.set(recordKey, {
          opponentId,
          opponentName,
          wins: 0,
          losses: 0,
          draws: 0,
          total: 0
        });
      }
      const h2hRecord = headToHeadRecords.get(recordKey);
      h2hRecord.total++;
      if (isWin) h2hRecord.wins++;
      else if (isDraw) h2hRecord.draws++;
      else h2hRecord.losses++;

      // Streak calculation
      const currentResult = isWin ? 'win' : (isDraw ? 'draw' : 'loss');
      
      if (currentResult === tempStreakType || (currentResult === 'draw' && tempStreakType === null)) {
        tempStreak++;
      } else if (currentResult !== 'draw') {
        if (tempStreakType && tempStreak > bestStreak) {
          bestStreak = tempStreak;
        }
        tempStreak = 1;
        tempStreakType = currentResult;
      }
      
      // Current streak is the last streak if it's still ongoing
      currentStreak = tempStreak;
      streakType = tempStreakType;

      // Collect session stats
      const isCreator = duel.creator_id === currentUserId;
      const userSessionData = isCreator ? duel.creator_session_data : duel.invited_session_data;
      if (userSessionData) {
        sessionStats.push(userSessionData);
      }
    });

    // Finalize best streak
    if (tempStreak > bestStreak) {
      bestStreak = tempStreak;
    }

    // Calculate average session stats
    const averageSessionStats = calculateAverageStats(sessionStats);
    
    // Get recent opponents (last 10 unique opponents)
    const recentOpponents = Array.from(opponentMap.values())
      .sort((a, b) => b.duels - a.duels)
      .slice(0, 10);

    const total = completedDuels.length;
    const winPercentage = total > 0 ? (wins / total) * 100 : 0;

    return {
      total,
      wins,
      losses,
      draws,
      winPercentage,
      recentOpponents,
      bestStreak: bestStreak || 0,
      currentStreak: currentStreak || 0,
      currentStreakType: streakType,
      averageSessionStats,
      headToHeadRecords
    };
  }, [duels, currentUserId]);

  const calculateAverageStats = (sessionStats) => {
    if (sessionStats.length === 0) return {};
    
    const totals = sessionStats.reduce((acc, session) => ({
      total_putts: (acc.total_putts || 0) + (session.total_putts || 0),
      total_makes: (acc.total_makes || 0) + (session.total_makes || 0),
      best_streak: Math.max(acc.best_streak || 0, session.best_streak || 0),
      session_duration: (acc.session_duration || 0) + (session.session_duration || 0)
    }), {});

    const count = sessionStats.length;
    return {
      avgPutts: (totals.total_putts / count).toFixed(1),
      avgMakes: (totals.total_makes / count).toFixed(1),
      avgMakePercentage: totals.total_putts > 0 ? ((totals.total_makes / totals.total_putts) * 100).toFixed(1) : '0.0',
      bestStreak: totals.best_streak,
      avgDuration: (totals.session_duration / count).toFixed(0)
    };
  };

  const formatStreak = (streak, type) => {
    if (streak === 0) return 'No active streak';
    const streakText = streak === 1 ? 'duel' : 'duels';
    return `${streak} ${streakText} ${type === 'win' ? 'won' : 'lost'}`;
  };

  if (duelStats.total === 0) {
    return (
      <div className="duel-history-stats">
        <div className="no-stats-message">
          <h3>No Completed Duels</h3>
          <p>Start competing with other players to see your duel statistics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="duel-history-stats">
      <div className="stats-header">
        <h3>Duel Statistics</h3>
        <div className="total-duels">
          {duelStats.total} completed duel{duelStats.total !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="stats-grid">
        {/* Win/Loss Record */}
        <div className="stat-card win-loss-record">
          <h4>Record</h4>
          <div className="record-display">
            <div className="record-numbers">
              <span className="wins">{duelStats.wins}W</span>
              <span className="losses">{duelStats.losses}L</span>
              {duelStats.draws > 0 && <span className="draws">{duelStats.draws}D</span>}
            </div>
            <div className="win-percentage">
              {duelStats.winPercentage.toFixed(1)}% win rate
            </div>
          </div>
        </div>

        {/* Streaks */}
        <div className="stat-card streaks">
          <h4>Streaks</h4>
          <div className="streak-info">
            <div className="current-streak">
              <strong>Current:</strong> {formatStreak(duelStats.currentStreak, duelStats.currentStreakType)}
            </div>
            <div className="best-streak">
              <strong>Best:</strong> {duelStats.bestStreak} duel{duelStats.bestStreak !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Average Performance */}
        {Object.keys(duelStats.averageSessionStats).length > 0 && (
          <div className="stat-card avg-performance">
            <h4>Average Performance</h4>
            <div className="performance-stats">
              <div className="stat-row">
                <span>Putts per duel:</span>
                <span>{duelStats.averageSessionStats.avgPutts}</span>
              </div>
              <div className="stat-row">
                <span>Makes per duel:</span>
                <span>{duelStats.averageSessionStats.avgMakes}</span>
              </div>
              <div className="stat-row">
                <span>Make percentage:</span>
                <span>{duelStats.averageSessionStats.avgMakePercentage}%</span>
              </div>
              <div className="stat-row">
                <span>Session duration:</span>
                <span>{duelStats.averageSessionStats.avgDuration}s</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Frequent Opponents */}
      {duelStats.recentOpponents.length > 0 && (
        <div className="frequent-opponents">
          <h4>Frequent Opponents</h4>
          <div className="opponents-list">
            {duelStats.recentOpponents.map((opponent) => (
              <div key={opponent.id} className="opponent-record">
                <div className="opponent-info">
                  <Link to={`/player/${opponent.id}/stats`} className="opponent-name">
                    {opponent.name}
                  </Link>
                  <span className="duel-count">{opponent.duels} duel{opponent.duels !== 1 ? 's' : ''}</span>
                </div>
                <div className="head-to-head">
                  <span className="h2h-record">
                    {opponent.wins}-{opponent.losses}
                    {opponent.draws > 0 && `-${opponent.draws}`}
                  </span>
                  <span className="h2h-percentage">
                    ({opponent.duels > 0 ? ((opponent.wins / opponent.duels) * 100).toFixed(0) : 0}% win rate)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DuelHistoryStats;