import { createHash } from 'crypto';
import notificationService from '../api/services/notification.js';

/**
 * Achievement Detection System for Proof of Putt
 *
 * Detects major achievements from session data and queues them for
 * blockchain certificate generation through OpenTimestamps.
 *
 * Achievement Types:
 * - consecutive_makes: 3, 7, 10, 15, 21, 42, 50, 77, 100 consecutive makes
 * - perfect_session: 100% accuracy with minimum attempts
 * - career_milestone: 1000, 5000, 10000, 25000, 50000 career makes
 * - accuracy_milestone: 80%, 90%, 95% accuracy over career with minimums
 * - competition_win: First duel victory, league championship
 */

/**
 * Check if a player already has a certificate for a specific achievement
 */
async function hasExistingCertificate(client, playerId, achievementType, achievementValue) {
  try {
    const result = await client.query(
      'SELECT has_achievement_certificate($1, $2, $3)',
      [playerId, achievementType, achievementValue]
    );
    return result.rows[0].has_achievement_certificate || false;
  } catch (error) {
    console.error('[achievement-detector] Error checking existing certificate:', error);
    return false;
  }
}

/**
 * Queue an achievement for certificate processing
 */
async function queueAchievement(client, playerId, achievementType, achievementValue, achievementData, sessionId = null) {
  try {
    console.log(`[achievement-detector] Queuing achievement: ${achievementType}=${achievementValue} for player ${playerId}`);

    const result = await client.query(
      'SELECT queue_achievement_certificate($1, $2, $3, $4, $5, NOW())',
      [playerId, achievementType, achievementValue, JSON.stringify(achievementData), sessionId]
    );

    const queueId = result.rows[0].queue_achievement_certificate;
    if (queueId) {
      console.log(`[achievement-detector] Achievement queued successfully with ID: ${queueId}`);
      return queueId;
    } else {
      console.log(`[achievement-detector] Achievement already exists or queued for player ${playerId}`);
      return null;
    }
  } catch (error) {
    console.error('[achievement-detector] Error queuing achievement:', error);
    throw error;
  }
}

/**
 * Send achievement notification to player
 */
async function sendAchievementNotification(playerId, achievementData) {
  try {
    await notificationService.createAchievementNotification({
      playerId,
      achievementName: achievementData.description || achievementData.achievement_type,
      description: achievementData.description || `Achievement unlocked: ${achievementData.milestone_value}`
    });
    console.log(`[achievement-detector] Notification sent for achievement: ${achievementData.achievement_type}`);
  } catch (error) {
    console.error('[achievement-detector] Failed to send achievement notification:', error);
    // Non-blocking: continue even if notification fails
  }
}

/**
 * Get current career stats for a player
 */
async function getCareerStats(client, playerId) {
  try {
    const result = await client.query(
      'SELECT total_sessions, total_putts, total_makes, total_misses, make_percentage, best_streak FROM player_stats WHERE player_id = $1',
      [playerId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    } else {
      // Return default stats if no record exists yet
      return {
        total_sessions: 0,
        total_putts: 0,
        total_makes: 0,
        total_misses: 0,
        make_percentage: 0,
        best_streak: 0
      };
    }
  } catch (error) {
    console.error('[achievement-detector] Error getting career stats:', error);
    return null;
  }
}

/**
 * Get league performance summary for a player
 */
async function getLeaguePerformanceSummary(client, leagueId, playerId) {
  try {
    // Get league settings
    const leagueResult = await client.query(
      'SELECT name, settings FROM leagues WHERE league_id = $1',
      [leagueId]
    );

    if (leagueResult.rows.length === 0) {
      return null;
    }

    const league = leagueResult.rows[0];
    const roundTimeLimit = league.settings?.time_limit_seconds || 300;

    // Get all league round sessions for this player
    const sessionsResult = await client.query(`
      SELECT
        lr.round_number,
        s.data,
        s.created_at
      FROM league_rounds lr
      JOIN sessions s ON s.session_id = lr.session_id
      WHERE lr.league_id = $1
        AND s.player_id = $2
      ORDER BY lr.round_number
    `, [leagueId, playerId]);

    if (sessionsResult.rows.length === 0) {
      return null;
    }

    // Calculate aggregate performance
    let totalMakes = 0;
    let totalMisses = 0;
    let totalDuration = 0;
    let bestStreak = 0;
    let fastest21 = null;
    let mostIn60s = 0;

    sessionsResult.rows.forEach(row => {
      const data = row.data;
      totalMakes += data.total_makes || 0;
      totalMisses += data.total_misses || 0;
      totalDuration += data.session_duration_seconds || 0;

      bestStreak = Math.max(bestStreak, data.best_streak || 0);
      if (data.fastest_21_makes && (fastest21 === null || data.fastest_21_makes < fastest21)) {
        fastest21 = data.fastest_21_makes;
      }
      mostIn60s = Math.max(mostIn60s, data.most_makes_in_60_seconds || 0);
    });

    const totalPutts = totalMakes + totalMisses;
    const accuracy = totalPutts > 0 ? (totalMakes / totalPutts * 100) : 0;
    const ppm = totalDuration > 0 ? (totalPutts / (totalDuration / 60)) : 0;
    const mpm = totalDuration > 0 ? (totalMakes / (totalDuration / 60)) : 0;

    return {
      league_name: league.name,
      number_of_rounds: sessionsResult.rows.length,
      total_makes: totalMakes,
      total_misses: totalMisses,
      total_putts: totalPutts,
      accuracy: parseFloat(accuracy.toFixed(2)),
      total_duration: totalDuration,
      best_streak: bestStreak,
      fastest_21: fastest21,
      most_in_60s: mostIn60s,
      putts_per_minute: parseFloat(ppm.toFixed(2)),
      makes_per_minute: parseFloat(mpm.toFixed(2)),
      round_time_limit: roundTimeLimit
    };
  } catch (error) {
    console.error('[achievement-detector] Error getting league performance summary:', error);
    return null;
  }
}

/**
 * Check for consecutive makes achievements (3, 7, 10, 15, 21, 42, 50, 77, 100)
 */
async function checkConsecutiveMakesAchievements(client, playerId, sessionData, sessionId) {
  const milestones = [3, 7, 10, 15, 21, 42, 50, 77, 100];
  const currentStreak = sessionData.best_streak || 0;
  const achievements = [];

  for (const milestone of milestones) {
    if (currentStreak >= milestone) {
      const hasExisting = await hasExistingCertificate(client, playerId, 'consecutive_makes', milestone);

      if (!hasExisting) {
        const achievementData = {
          achievement_type: 'consecutive_makes',
          milestone_value: milestone,
          achieved_streak: currentStreak,
          session_putts: sessionData.total_putts || 0,
          session_makes: sessionData.total_makes || 0,
          session_date: sessionData.date_recorded || new Date().toISOString(),
          description: `${milestone} consecutive putts made`,
          rarity_tier: milestone >= 100 ? 'legendary' : milestone >= 50 ? 'epic' : 'rare'
        };

        const queueId = await queueAchievement(client, playerId, 'consecutive_makes', milestone, achievementData, sessionId);
        if (queueId) {
          achievements.push({
            type: 'consecutive_makes',
            value: milestone,
            data: achievementData,
            queue_id: queueId
          });
          // Send notification
          await sendAchievementNotification(playerId, achievementData);
        }
      }
    }
  }

  return achievements;
}

/**
 * Check for perfect session achievements (100% accuracy with minimum attempts)
 */
async function checkPerfectSessionAchievements(client, playerId, sessionData, sessionId) {
  const totalPutts = sessionData.total_putts || 0;
  const totalMakes = sessionData.total_makes || 0;
  const makePercentage = sessionData.make_percentage || 0;
  const achievements = [];

  // Perfect session requirements: 100% accuracy with at least 10 putts
  if (makePercentage === 100 && totalPutts >= 10) {
    const hasExisting = await hasExistingCertificate(client, playerId, 'perfect_session', totalPutts);

    if (!hasExisting) {
      const achievementData = {
        achievement_type: 'perfect_session',
        session_putts: totalPutts,
        session_makes: totalMakes,
        accuracy: makePercentage,
        session_duration: sessionData.session_duration_seconds || sessionData.session_duration || 0,
        session_date: sessionData.date_recorded || new Date().toISOString(),
        description: `Perfect session: ${totalPutts}/${totalPutts} putts made (100%)`,
        rarity_tier: totalPutts >= 50 ? 'legendary' : totalPutts >= 25 ? 'epic' : 'rare'
      };

      const queueId = await queueAchievement(client, playerId, 'perfect_session', totalPutts, achievementData, sessionId);
      if (queueId) {
        achievements.push({
          type: 'perfect_session',
          value: totalPutts,
          data: achievementData,
          queue_id: queueId
        });
        // Send notification
        await sendAchievementNotification(playerId, achievementData);
      }
    }
  }

  return achievements;
}

/**
 * Check for career milestone achievements (1000, 5000, 10000, 25000, 50000 total makes)
 */
async function checkCareerMilestoneAchievements(client, playerId, sessionData, sessionId) {
  const milestones = [1000, 5000, 10000, 25000, 50000];
  const careerStats = await getCareerStats(client, playerId);
  const achievements = [];

  if (!careerStats) return achievements;

  // Calculate new career total (current stats + this session)
  const newCareerMakes = careerStats.total_makes + (sessionData.total_makes || 0);

  for (const milestone of milestones) {
    // Check if we've crossed this milestone with this session
    if (careerStats.total_makes < milestone && newCareerMakes >= milestone) {
      const hasExisting = await hasExistingCertificate(client, playerId, 'career_milestone', milestone);

      if (!hasExisting) {
        const achievementData = {
          achievement_type: 'career_milestone',
          milestone_value: milestone,
          career_makes: newCareerMakes,
          career_sessions: careerStats.total_sessions + 1,
          career_accuracy: careerStats.total_putts > 0 ?
            ((careerStats.total_makes + (sessionData.total_makes || 0)) /
             (careerStats.total_putts + (sessionData.total_putts || 0)) * 100).toFixed(2) : 0,
          session_date: sessionData.date_recorded || new Date().toISOString(),
          description: `${milestone.toLocaleString()} career putts made`,
          rarity_tier: milestone >= 25000 ? 'legendary' : milestone >= 5000 ? 'epic' : 'rare'
        };

        const queueId = await queueAchievement(client, playerId, 'career_milestone', milestone, achievementData, sessionId);
        if (queueId) {
          achievements.push({
            type: 'career_milestone',
            value: milestone,
            data: achievementData,
            queue_id: queueId
          });
          // Send notification
          await sendAchievementNotification(playerId, achievementData);
        }
      }
    }
  }

  return achievements;
}

/**
 * Check for accuracy milestone achievements (80%, 90%, 95% career accuracy)
 */
async function checkAccuracyMilestoneAchievements(client, playerId, sessionData, sessionId) {
  const milestones = [80, 90, 95];
  const careerStats = await getCareerStats(client, playerId);
  const achievements = [];

  if (!careerStats) return achievements;

  // Calculate new career accuracy
  const newTotalPutts = careerStats.total_putts + (sessionData.total_putts || 0);
  const newTotalMakes = careerStats.total_makes + (sessionData.total_makes || 0);
  const newAccuracy = newTotalPutts > 0 ? (newTotalMakes / newTotalPutts * 100) : 0;

  // Minimum requirements for accuracy achievements
  const MIN_PUTTS_FOR_ACCURACY = 500;

  if (newTotalPutts >= MIN_PUTTS_FOR_ACCURACY) {
    for (const milestone of milestones) {
      if (newAccuracy >= milestone) {
        const hasExisting = await hasExistingCertificate(client, playerId, 'accuracy_milestone', milestone);

        if (!hasExisting) {
          const achievementData = {
            achievement_type: 'accuracy_milestone',
            milestone_value: milestone,
            career_accuracy: parseFloat(newAccuracy.toFixed(2)),
            career_makes: newTotalMakes,
            career_putts: newTotalPutts,
            career_sessions: careerStats.total_sessions + 1,
            session_date: sessionData.date_recorded || new Date().toISOString(),
            description: `${milestone}% career accuracy achieved`,
            rarity_tier: milestone >= 95 ? 'legendary' : milestone >= 90 ? 'epic' : 'rare'
          };

          const queueId = await queueAchievement(client, playerId, 'accuracy_milestone', milestone, achievementData, sessionId);
          if (queueId) {
            achievements.push({
              type: 'accuracy_milestone',
              value: milestone,
              data: achievementData,
              queue_id: queueId
            });
            // Send notification
            await sendAchievementNotification(playerId, achievementData);
          }
        }
      }
    }
  }

  return achievements;
}

/**
 * Check for competition achievements (duel victories, league championships)
 */
async function checkCompetitionAchievements(client, playerId, sessionData, sessionId, duelId = null, leagueRoundId = null) {
  const achievements = [];

  // Check for first duel victory
  if (duelId) {
    // Check if this duel was won by the player
    const duelResult = await client.query(
      'SELECT winner_id, status FROM duels WHERE duel_id = $1 AND winner_id = $2 AND status = $3',
      [duelId, playerId, 'completed']
    );

    if (duelResult.rows.length > 0) {
      // Check if this is their first duel victory
      const firstVictoryCheck = await client.query(
        'SELECT COUNT(*) as victory_count FROM duels WHERE winner_id = $1 AND status = $2',
        [playerId, 'completed']
      );

      const victoryCount = parseInt(firstVictoryCheck.rows[0].victory_count) || 0;

      if (victoryCount === 1) { // This is their first victory
        const hasExisting = await hasExistingCertificate(client, playerId, 'competition_win', 1);

        if (!hasExisting) {
          const achievementData = {
            achievement_type: 'competition_win',
            achievement_subtype: 'first_duel_victory',
            competition_id: duelId,
            competition_type: 'duel',
            session_performance: {
              putts: sessionData.total_putts || 0,
              makes: sessionData.total_makes || 0,
              accuracy: sessionData.make_percentage || 0,
              streak: sessionData.best_streak || 0
            },
            session_date: sessionData.date_recorded || new Date().toISOString(),
            description: 'First duel victory',
            rarity_tier: 'rare'
          };

          const queueId = await queueAchievement(client, playerId, 'competition_win', 1, achievementData, sessionId);
          if (queueId) {
            achievements.push({
              type: 'competition_win',
              value: 1,
              data: achievementData,
              queue_id: queueId
            });
            // Send notification
            await sendAchievementNotification(playerId, achievementData);
          }
        }
      }
    }
  }

  // Check for league championship achievements (top 3 finishers)
  if (leagueRoundId) {
    // Get league info from the round
    const leagueInfo = await client.query(`
      SELECT
        l.league_id,
        l.name as league_name,
        l.status,
        lr.round_number,
        l.total_rounds
      FROM league_rounds lr
      JOIN leagues l ON l.league_id = lr.league_id
      WHERE lr.round_id = $1
    `, [leagueRoundId]);

    if (leagueInfo.rows.length > 0) {
      const league = leagueInfo.rows[0];

      // Only process if league is completed
      if (league.status === 'completed') {
        // Get final league standings (top 3)
        const standings = await client.query(`
          SELECT
            player_id,
            ROW_NUMBER() OVER (ORDER BY total_score DESC, min_date ASC) as final_rank
          FROM (
            SELECT
              lp.player_id,
              COALESCE(SUM(ls.score), 0) as total_score,
              MIN(lp.joined_at) as min_date
            FROM league_players lp
            LEFT JOIN league_scores ls ON ls.league_id = lp.league_id AND ls.player_id = lp.player_id
            WHERE lp.league_id = $1
            GROUP BY lp.player_id
          ) ranked_players
          ORDER BY total_score DESC, min_date ASC
          LIMIT 3
        `, [league.league_id]);

        // Check if this player is in top 3
        const playerRank = standings.rows.findIndex(row => row.player_id === playerId) + 1;

        if (playerRank > 0 && playerRank <= 3) {
          const achievementValue = playerRank; // 1st, 2nd, or 3rd place
          const hasExisting = await hasExistingCertificate(client, playerId, 'competition_win', `league_${league.league_id}_${achievementValue}`);

          if (!hasExisting) {
            // Get league performance summary for this player
            const leaguePerformance = await getLeaguePerformanceSummary(client, league.league_id, playerId);

            const achievementData = {
              achievement_type: 'competition_win',
              achievement_subtype: `league_championship_${playerRank}`,
              competition_id: league.league_id,
              competition_type: 'league',
              competition_name: league.league_name,
              final_rank: playerRank,
              total_rounds: league.total_rounds,
              league_performance: leaguePerformance,
              session_date: sessionData.date_recorded || new Date().toISOString(),
              description: `${playerRank === 1 ? '1st' : playerRank === 2 ? '2nd' : '3rd'} place in ${league.league_name}`,
              rarity_tier: playerRank === 1 ? 'legendary' : playerRank === 2 ? 'epic' : 'rare'
            };

            const queueId = await queueAchievement(client, playerId, 'competition_win', `league_${league.league_id}_${achievementValue}`, achievementData, sessionId);
            if (queueId) {
              achievements.push({
                type: 'competition_win',
                value: `league_${league.league_id}_${achievementValue}`,
                data: achievementData,
                queue_id: queueId
              });
              // Send notification
              await sendAchievementNotification(playerId, achievementData);
            }
          }
        }
      }
    }
  }

  return achievements;
}

/**
 * Check for session milestone achievements (10, 21, 50, 100, 210, 420, 1000, 2100 sessions)
 * Counts all session types: practice, duels, and league rounds
 */
async function checkSessionMilestoneAchievements(client, playerId, sessionData, sessionId) {
  const achievements = [];

  // Session milestone thresholds with rarity tiers
  const milestones = [
    { count: 10, tier: 'rare', description: 'dedication to practice' },
    { count: 21, tier: 'rare', description: 'consistent training' },
    { count: 50, tier: 'rare', description: 'committed practice' },
    { count: 100, tier: 'epic', description: 'training discipline' },
    { count: 210, tier: 'epic', description: 'practice mastery' },
    { count: 420, tier: 'epic', description: 'training excellence' },
    { count: 1000, tier: 'legendary', description: 'practice dedication' },
    { count: 2100, tier: 'legendary', description: 'ultimate commitment' }
  ];

  try {
    // Count total sessions across all types for the player
    const totalSessionsResult = await client.query(`
      SELECT COUNT(*) as total_sessions
      FROM sessions s
      WHERE s.player_id = $1
    `, [playerId]);

    const totalSessions = parseInt(totalSessionsResult.rows[0]?.total_sessions) || 0;

    // Check each milestone
    for (const milestone of milestones) {
      if (totalSessions >= milestone.count) {
        // Check if we already have this achievement
        const hasExisting = await hasExistingCertificate(client, playerId, 'session_milestone', milestone.count);

        if (!hasExisting) {
          const achievementData = {
            achievement_type: 'session_milestone',
            milestone_value: milestone.count,
            total_sessions: totalSessions,
            session_types_included: 'All (practice, duels, leagues)',
            achievement_description: `${milestone.count} sessions completed - ${milestone.description}`,
            current_session: {
              putts: sessionData.total_putts || 0,
              makes: sessionData.total_makes || 0,
              accuracy: sessionData.make_percentage || 0,
              duration: sessionData.session_duration_seconds || 0
            },
            session_date: sessionData.date_recorded || new Date().toISOString(),
            description: `${milestone.count} sessions completed`,
            rarity_tier: milestone.tier
          };

          const queueId = await queueAchievement(client, playerId, 'session_milestone', milestone.count, achievementData, sessionId);
          if (queueId) {
            achievements.push({
              type: 'session_milestone',
              value: milestone.count,
              data: achievementData,
              queue_id: queueId
            });
            // Send notification
            await sendAchievementNotification(playerId, achievementData);
          }
        }
      }
    }

    return achievements;

  } catch (error) {
    console.error('[achievement-detector] Error checking session milestone achievements:', error);
    return achievements;
  }
}

/**
 * Main achievement detection function
 * Called from upload-session.js after a session is successfully uploaded
 */
export async function detectAchievements(client, playerId, sessionData, sessionId, duelId = null, leagueRoundId = null) {
  console.log(`[achievement-detector] Detecting achievements for player ${playerId}, session ${sessionId}`);

  try {
    const allAchievements = [];

    // Check all achievement types
    const consecutiveAchievements = await checkConsecutiveMakesAchievements(client, playerId, sessionData, sessionId);
    const perfectSessionAchievements = await checkPerfectSessionAchievements(client, playerId, sessionData, sessionId);
    const careerMilestoneAchievements = await checkCareerMilestoneAchievements(client, playerId, sessionData, sessionId);
    const accuracyMilestoneAchievements = await checkAccuracyMilestoneAchievements(client, playerId, sessionData, sessionId);
    const sessionMilestoneAchievements = await checkSessionMilestoneAchievements(client, playerId, sessionData, sessionId);
    const competitionAchievements = await checkCompetitionAchievements(client, playerId, sessionData, sessionId, duelId, leagueRoundId);

    // Combine all achievements
    allAchievements.push(
      ...consecutiveAchievements,
      ...perfectSessionAchievements,
      ...careerMilestoneAchievements,
      ...accuracyMilestoneAchievements,
      ...sessionMilestoneAchievements,
      ...competitionAchievements
    );

    if (allAchievements.length > 0) {
      console.log(`[achievement-detector] Detected ${allAchievements.length} new achievements for player ${playerId}:`);
      allAchievements.forEach(achievement => {
        console.log(`  - ${achievement.type}: ${achievement.value} (${achievement.data.rarity_tier})`);
      });
    } else {
      console.log(`[achievement-detector] No new achievements detected for player ${playerId}`);
    }

    return allAchievements;

  } catch (error) {
    console.error('[achievement-detector] Error in achievement detection:', error);
    throw error;
  }
}

/**
 * Create a cryptographic hash of achievement data for blockchain timestamping
 */
export function createAchievementHash(achievementData) {
  const dataString = JSON.stringify(achievementData, Object.keys(achievementData).sort());
  return createHash('sha256').update(dataString).digest('hex');
}