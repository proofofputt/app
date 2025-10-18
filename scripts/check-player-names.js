/**
 * Check player name vs display_name
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const playerId = 1009;

async function checkNames() {
  try {
    const result = await pool.query(`
      SELECT
        player_id,
        name,
        display_name,
        email
      FROM players
      WHERE player_id = $1
    `, [playerId]);

    if (result.rows.length === 0) {
      console.log('Player not found');
      return;
    }

    const player = result.rows[0];

    console.log('Player Names:');
    console.log('='.repeat(60));
    console.log(`Player ID: ${player.player_id}`);
    console.log(`Email: ${player.email}`);
    console.log(`name: "${player.name}"`);
    console.log(`display_name: "${player.display_name}"`);
    console.log();
    console.log('Are they the same?', player.name === player.display_name);
    console.log('Is display_name null?', player.display_name === null);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNames();
