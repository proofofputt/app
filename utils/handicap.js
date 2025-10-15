/**
 * Handicap Utility Functions for Proof of Putt
 *
 * Provides handicap-adjusted scoring for duels and leagues
 */

/**
 * Apply handicap adjustment to a timed session score
 *
 * For timed sessions:
 * - Handicap represents expected makes per minute (MPM)
 * - Adjustment = (player's MPM - handicap) * session_duration_minutes
 * - This rewards players who perform above their handicap
 *
 * @param {number} totalMakes - Raw makes in the session
 * @param {number} sessionDuration - Session duration in seconds
 * @param {number} playerHandicap - Player's handicap (MPM)
 * @returns {number} - Handicap-adjusted score
 */
export function applyTimedHandicap(totalMakes, sessionDuration, playerHandicap) {
  if (!playerHandicap || playerHandicap === 0) {
    return totalMakes; // No handicap, return raw score
  }

  const durationMinutes = sessionDuration / 60;
  const actualMPM = totalMakes / durationMinutes;
  const handicapAdjustment = (actualMPM - playerHandicap) * durationMinutes;

  // Adjusted score = raw makes + adjustment
  // If player performs better than handicap, adjustment is positive
  // If worse, adjustment is negative
  return Math.max(0, totalMakes + handicapAdjustment);
}

/**
 * Apply handicap adjustment to a shootout score
 *
 * For shootouts:
 * - Handicap represents expected makes per minute (MPM)
 * - Convert handicap to "makes per X attempts" based on competition rules
 * - Handicap adjustment rounds to nearest whole number
 * - Lower handicap players get a handicap "stroke" bonus
 *
 * @param {number} totalMakes - Raw makes in shootout
 * @param {number} maxAttempts - Maximum putt attempts in shootout
 * @param {number} playerHandicap - Player's handicap (MPM)
 * @param {number} avgPuttsPerMinute - Average putts per minute (default 12)
 * @returns {number} - Handicap-adjusted score (rounded)
 */
export function applyShootoutHandicap(totalMakes, maxAttempts, playerHandicap, avgPuttsPerMinute = 12) {
  if (!playerHandicap || playerHandicap === 0) {
    return totalMakes; // No handicap, return raw score
  }

  // Estimate time for shootout based on attempts
  const estimatedMinutes = maxAttempts / avgPuttsPerMinute;

  // Expected makes based on handicap
  const expectedMakes = playerHandicap * estimatedMinutes;

  // Handicap strokes = difference between expected and actual
  const handicapStrokes = totalMakes - expectedMakes;

  // Return adjusted score (rounded to whole number for shootouts)
  return Math.round(Math.max(0, totalMakes + handicapStrokes));
}

/**
 * Calculate relative handicap difference between two players
 *
 * @param {number} handicap1 - First player's handicap
 * @param {number} handicap2 - Second player's handicap
 * @returns {object} - { stronger, weaker, difference }
 */
export function calculateHandicapDifference(handicap1, handicap2) {
  if (!handicap1 && !handicap2) {
    return { stronger: null, weaker: null, difference: 0 };
  }

  if (!handicap1) return { stronger: 2, weaker: 1, difference: handicap2 };
  if (!handicap2) return { stronger: 1, weaker: 2, difference: handicap1 };

  const diff = Math.abs(handicap1 - handicap2);

  return {
    stronger: handicap1 > handicap2 ? 1 : 2,
    weaker: handicap1 > handicap2 ? 2 : 1,
    difference: diff
  };
}

/**
 * Determine if handicap should be applied based on rules
 *
 * @param {object} rules - Competition rules object
 * @returns {boolean}
 */
export function shouldApplyHandicap(rules) {
  return rules?.handicap_enabled === true;
}

/**
 * Get formatted handicap display value
 *
 * @param {number} handicap - Handicap value
 * @param {boolean} roundForShootout - Round to whole number for shootout display
 * @returns {string} - Formatted handicap
 */
export function formatHandicap(handicap, roundForShootout = false) {
  if (!handicap || handicap === 0) return '—';

  if (roundForShootout) {
    return Math.round(handicap).toString();
  }

  return handicap.toFixed(2);
}
