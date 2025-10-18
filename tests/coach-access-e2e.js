#!/usr/bin/env node

/**
 * Coach Access System - End-to-End Test Suite
 * Tests complete user flows for coach access features
 */

import https from 'https';
import http from 'http';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Test configuration
const CONFIG = {
  PROD_BASE_URL: 'https://app.proofofputt.com',
  DEV_BASE_URL: 'http://localhost:5173',
  TIMEOUT: 10000,
  // Test users - update these with actual test accounts
  TEST_COACH: {
    email: 'coach@test.proofofputt.com',
    password: 'TestCoach123!',
    player_id: null, // Will be set after login
    referral_code: null
  },
  TEST_STUDENT: {
    email: 'student@test.proofofputt.com',
    password: 'TestStudent123!',
    player_id: null,
    referred_by_code: null
  }
};

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const requestModule = isHttps ? https : http;

    const req = requestModule.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: CONFIG.TIMEOUT
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test suite class
class CoachAccessTestSuite {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = [];
    this.environment = baseUrl.includes('localhost') ? 'DEV' : 'PROD';
    this.tokens = {
      coach: null,
      student: null,
      admin: null
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] [${this.environment}] ${message}`);
  }

  async test(name, testFn) {
    this.log(`Running: ${name}`);
    const startTime = Date.now();

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.results.push({
        name,
        status: 'PASS',
        duration,
        result
      });

      this.log(`✅ PASS: ${name} (${duration}ms)`, 'PASS');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.push({
        name,
        status: 'FAIL',
        duration,
        error: error.message,
        stack: error.stack
      });

      this.log(`❌ FAIL: ${name} (${duration}ms) - ${error.message}`, 'FAIL');
      throw error;
    }
  }

  // Setup: Create test users
  async setupTestUsers() {
    return await this.test('Setup: Create Test Users', async () => {
      const client = await pool.connect();
      try {
        // Create coach account
        const coachResult = await client.query(`
          INSERT INTO players (name, email, password_hash, referral_code)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email) DO UPDATE SET referral_code = EXCLUDED.referral_code
          RETURNING player_id, referral_code
        `, [
          'Test Coach',
          CONFIG.TEST_COACH.email,
          'hashed_password_placeholder',
          'TESTCOACH'
        ]);

        CONFIG.TEST_COACH.player_id = coachResult.rows[0].player_id;
        CONFIG.TEST_COACH.referral_code = coachResult.rows[0].referral_code;

        // Create student account (will be used for auto-friend test)
        CONFIG.TEST_STUDENT.referred_by_code = CONFIG.TEST_COACH.referral_code;

        return {
          coach_player_id: CONFIG.TEST_COACH.player_id,
          coach_referral_code: CONFIG.TEST_COACH.referral_code
        };
      } finally {
        client.release();
      }
    });
  }

  // Test 1: Auto-Friend Trigger on Referral Signup
  async testAutoFriendTrigger() {
    return await this.test('Auto-Friend Trigger on Referral Signup', async () => {
      const client = await pool.connect();
      try {
        // Create student referred by coach
        const studentResult = await client.query(`
          INSERT INTO players (name, email, password_hash, referred_by_player_id)
          VALUES ($1, $2, $3, (SELECT player_id FROM players WHERE referral_code = $4))
          ON CONFLICT (email) DO UPDATE SET referred_by_player_id = EXCLUDED.referred_by_player_id
          RETURNING player_id, referred_by_player_id
        `, [
          'Test Student',
          CONFIG.TEST_STUDENT.email,
          'hashed_password_placeholder',
          CONFIG.TEST_COACH.referral_code
        ]);

        CONFIG.TEST_STUDENT.player_id = studentResult.rows[0].player_id;

        // Wait for trigger to fire
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify bidirectional friendship exists
        const friendshipResult = await client.query(`
          SELECT * FROM friendships
          WHERE (player_id = $1 AND friend_id = $2 AND source = 'referral')
             OR (player_id = $2 AND friend_id = $1 AND source = 'referral')
        `, [CONFIG.TEST_COACH.player_id, CONFIG.TEST_STUDENT.player_id]);

        if (friendshipResult.rows.length !== 2) {
          throw new Error(`Expected 2 friendships, got ${friendshipResult.rows.length}`);
        }

        return {
          friendships_created: friendshipResult.rows.length,
          friendships: friendshipResult.rows.map(f => ({
            from: f.player_id,
            to: f.friend_id,
            source: f.source,
            status: f.status
          }))
        };
      } finally {
        client.release();
      }
    });
  }

  // Test 2: Grant Coach Access via API
  async testGrantCoachAccess() {
    return await this.test('Grant Coach Access via API', async () => {
      // Simulate student granting coach access
      const response = await makeRequest(`${this.baseUrl}/api/contacts/toggle-coach-access`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.student || 'test_token'}`,
          'Content-Type': 'application/json'
        },
        body: {
          friend_id: CONFIG.TEST_COACH.player_id,
          enable: true,
          access_level: 'full_sessions',
          notes: 'My putting coach for automated test'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (!response.data.success) {
        throw new Error(`Grant failed: ${response.data.message}`);
      }

      // Verify in database
      const client = await pool.connect();
      try {
        const grantResult = await client.query(`
          SELECT * FROM coach_access_grants
          WHERE student_player_id = $1 AND coach_player_id = $2 AND status = 'active'
        `, [CONFIG.TEST_STUDENT.player_id, CONFIG.TEST_COACH.player_id]);

        if (grantResult.rows.length === 0) {
          throw new Error('Coach grant not found in database');
        }

        return {
          api_response: response.data,
          database_record: grantResult.rows[0]
        };
      } finally {
        client.release();
      }
    });
  }

  // Test 3: Coach Views Student List
  async testCoachViewsStudents() {
    return await this.test('Coach Views Student List', async () => {
      const response = await makeRequest(`${this.baseUrl}/api/coach-access/students?status=active`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.tokens.coach || 'test_token'}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.data.success) {
        throw new Error('Failed to fetch students');
      }

      // Verify test student appears in list
      const testStudent = response.data.students.find(
        s => s.student_player_id === CONFIG.TEST_STUDENT.player_id
      );

      if (!testStudent) {
        throw new Error('Test student not found in coach\'s student list');
      }

      return {
        total_students: response.data.students.length,
        test_student_found: true,
        test_student_data: testStudent
      };
    });
  }

  // Test 4: Session Access Control - Coach Can View
  async testCoachViewsSessions() {
    return await this.test('Coach Can View Student Sessions', async () => {
      const response = await makeRequest(
        `${this.baseUrl}/api/player/${CONFIG.TEST_STUDENT.player_id}/sessions?limit=5`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.tokens.coach || 'test_token'}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }

      return {
        sessions_count: response.data.sessions ? response.data.sessions.length : 0,
        access_granted: true
      };
    });
  }

  // Test 5: Session Access Control - Unauthorized User Denied
  async testUnauthorizedAccessDenied() {
    return await this.test('Unauthorized User Denied Session Access', async () => {
      // Create another user who is NOT the coach
      const client = await pool.connect();
      let unauthorizedPlayerId;

      try {
        const result = await client.query(`
          INSERT INTO players (name, email, password_hash)
          VALUES ($1, $2, $3)
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
          RETURNING player_id
        `, ['Unauthorized User', 'unauthorized@test.com', 'hashed_password']);

        unauthorizedPlayerId = result.rows[0].player_id;
      } finally {
        client.release();
      }

      // Attempt to view student's sessions
      const response = await makeRequest(
        `${this.baseUrl}/api/player/${CONFIG.TEST_STUDENT.player_id}/sessions`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer test_token_unauthorized`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Should be denied (403 or 401)
      if (response.status !== 403 && response.status !== 401) {
        throw new Error(`Expected 403 or 401, got ${response.status} - Security issue!`);
      }

      return {
        status: response.status,
        access_denied: true
      };
    });
  }

  // Test 6: Revoke Coach Access
  async testRevokeCoachAccess() {
    return await this.test('Revoke Coach Access', async () => {
      // Student revokes access
      const response = await makeRequest(`${this.baseUrl}/api/contacts/toggle-coach-access`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokens.student || 'test_token'}`,
          'Content-Type': 'application/json'
        },
        body: {
          friend_id: CONFIG.TEST_COACH.player_id,
          enable: false
        }
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.data.success) {
        throw new Error(`Revoke failed: ${response.data.message}`);
      }

      // Verify in database
      const client = await pool.connect();
      try {
        const grantResult = await client.query(`
          SELECT * FROM coach_access_grants
          WHERE student_player_id = $1 AND coach_player_id = $2
        `, [CONFIG.TEST_STUDENT.player_id, CONFIG.TEST_COACH.player_id]);

        const grant = grantResult.rows[0];
        if (grant.status !== 'revoked') {
          throw new Error(`Expected status 'revoked', got '${grant.status}'`);
        }

        if (!grant.revoked_at) {
          throw new Error('revoked_at not set');
        }

        return {
          api_response: response.data,
          database_status: grant.status,
          revoked_at: grant.revoked_at
        };
      } finally {
        client.release();
      }
    });
  }

  // Test 7: Coach Denied After Revoke
  async testCoachDeniedAfterRevoke() {
    return await this.test('Coach Denied Access After Revoke', async () => {
      const response = await makeRequest(
        `${this.baseUrl}/api/player/${CONFIG.TEST_STUDENT.player_id}/sessions`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.tokens.coach || 'test_token'}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Should now be denied
      if (response.status !== 403 && response.status !== 401) {
        throw new Error(`Expected 403 or 401 after revoke, got ${response.status}`);
      }

      return {
        status: response.status,
        access_denied: true,
        message: response.data.message || response.data.error
      };
    });
  }

  // Test 8: Referral Chain Population
  async testReferralChainPopulation() {
    return await this.test('Referral Chain Population (5 levels)', async () => {
      const client = await pool.connect();
      try {
        // Verify coach has referrer_level_1 set to student (or appropriate chain)
        const result = await client.query(`
          SELECT
            player_id,
            name,
            referrer_level_1,
            referrer_level_2,
            referrer_level_3,
            referrer_level_4,
            referrer_level_5
          FROM players
          WHERE player_id = $1
        `, [CONFIG.TEST_STUDENT.player_id]);

        const player = result.rows[0];

        return {
          player_id: player.player_id,
          name: player.name,
          referrer_level_1: player.referrer_level_1,
          referrer_level_2: player.referrer_level_2,
          referrer_level_3: player.referrer_level_3,
          referrer_level_4: player.referrer_level_4,
          referrer_level_5: player.referrer_level_5,
          chain_populated: player.referrer_level_1 !== null
        };
      } finally {
        client.release();
      }
    });
  }

  // Test 9: Friends List with Coach Access Status
  async testFriendsListAPI() {
    return await this.test('Friends List with Coach Access Status', async () => {
      const response = await makeRequest(
        `${this.baseUrl}/api/contacts/friends?status=accepted&include_stats=true`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.tokens.student || 'test_token'}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.data.success) {
        throw new Error('Failed to fetch friends');
      }

      // Find coach in friends list
      const coachFriend = response.data.friends.find(
        f => f.player_id === CONFIG.TEST_COACH.player_id
      );

      if (!coachFriend) {
        throw new Error('Coach not found in friends list');
      }

      return {
        total_friends: response.data.friends.length,
        coach_found: true,
        coach_is_referrer: coachFriend.is_referrer,
        coach_access_granted: coachFriend.coach_access_granted,
        coach_access_received: coachFriend.coach_access_received
      };
    });
  }

  // Cleanup: Remove test data
  async cleanup() {
    return await this.test('Cleanup: Remove Test Data', async () => {
      const client = await pool.connect();
      try {
        // Delete friendships
        await client.query(`
          DELETE FROM friendships
          WHERE (player_id = $1 OR player_id = $2)
             OR (friend_id = $1 OR friend_id = $2)
        `, [CONFIG.TEST_COACH.player_id, CONFIG.TEST_STUDENT.player_id]);

        // Delete coach grants
        await client.query(`
          DELETE FROM coach_access_grants
          WHERE student_player_id = $1 OR coach_player_id = $1
             OR student_player_id = $2 OR coach_player_id = $2
        `, [CONFIG.TEST_COACH.player_id, CONFIG.TEST_STUDENT.player_id]);

        // Delete test players (optional - comment out if you want to keep them)
        // await client.query(`
        //   DELETE FROM players WHERE player_id IN ($1, $2)
        // `, [CONFIG.TEST_COACH.player_id, CONFIG.TEST_STUDENT.player_id]);

        return { cleanup_successful: true };
      } finally {
        client.release();
      }
    });
  }

  // Run all tests
  async runAll() {
    this.log(`Starting Coach Access E2E tests for ${this.environment} environment`);
    const startTime = Date.now();

    try {
      await this.setupTestUsers();
      await this.testAutoFriendTrigger();
      await this.testGrantCoachAccess();
      await this.testCoachViewsStudents();
      await this.testCoachViewsSessions();
      await this.testUnauthorizedAccessDenied();
      await this.testRevokeCoachAccess();
      await this.testCoachDeniedAfterRevoke();
      await this.testReferralChainPopulation();
      await this.testFriendsListAPI();

      // Cleanup
      await this.cleanup();
    } catch (error) {
      this.log(`Test suite interrupted: ${error.message}`, 'ERROR');
    } finally {
      await pool.end();
    }

    const duration = Date.now() - startTime;
    this.printSummary(duration);
  }

  printSummary(duration) {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(80));
    console.log(`COACH ACCESS E2E TEST SUMMARY - ${this.environment} Environment`);
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\nFAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(test => {
        console.log(`❌ ${test.name}: ${test.error}`);
      });
    }

    console.log('\n');
    return { passed, failed, total: this.results.length };
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const env = args[0] || 'dev';

  let baseUrl;
  if (env === 'prod') {
    baseUrl = CONFIG.PROD_BASE_URL;
  } else {
    baseUrl = CONFIG.DEV_BASE_URL;
  }

  console.log(`\n🧪 Running Coach Access E2E Tests against: ${baseUrl}\n`);

  const suite = new CoachAccessTestSuite(baseUrl);
  await suite.runAll();

  // Exit with appropriate code
  const failedTests = suite.results.filter(r => r.status === 'FAIL').length;
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { CoachAccessTestSuite, CONFIG };
