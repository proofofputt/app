/**
 * Gift Code Generation Utility
 * Generates secure 7-character alphanumeric codes
 */

import crypto from 'crypto';

/**
 * Generate a 7-character alphanumeric gift code
 * Format: XXXXXXX (e.g., "A3K9M2P")
 * Uses crypto for secure random generation
 *
 * @returns {string} 7-character uppercase alphanumeric code
 */
export function generateGiftCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(7);

  for (let i = 0; i < 7; i++) {
    code += characters[randomBytes[i] % characters.length];
  }

  return code;
}

/**
 * Generate multiple unique gift codes
 * Checks for uniqueness against a provided validator function
 *
 * @param {number} quantity - Number of codes to generate
 * @param {Function} existsCheck - Async function that checks if code exists (returns boolean)
 * @returns {Promise<string[]>} Array of unique gift codes
 */
export async function generateUniqueGiftCodes(quantity, existsCheck) {
  const codes = [];
  const maxAttempts = quantity * 10; // Prevent infinite loops
  let attempts = 0;

  while (codes.length < quantity && attempts < maxAttempts) {
    const code = generateGiftCode();
    attempts++;

    // Check if code already exists
    const exists = await existsCheck(code);

    if (!exists && !codes.includes(code)) {
      codes.push(code);
    }
  }

  if (codes.length < quantity) {
    throw new Error(`Failed to generate ${quantity} unique codes after ${maxAttempts} attempts`);
  }

  return codes;
}
