#!/usr/bin/env node

/**
 * Comprehensive API Endpoint Test Suite
 * Tests upload-session.js and player sessions API with full scenario matrix
 */

import https from 'https';
import http from 'http';

// Test configuration
const CONFIG = {
  // Use localhost for development testing
  PROD_BASE_URL: 'https://app.proofofputt.com',
  DEV_BASE_URL: 'http://localhost:5173',
  TEST_PLAYER_ID: 3,
  TEST_DUEL_ID: 25,
  TIMEOUT: 10000,
};

// Test data templates
const TEST_SESSION_DATA = {
  basic: {
    total_putts: 5,
    total_makes: 3,
    total_misses: 2,
    make_percentage: 60.0,
    best_streak: 3,
    session_duration_seconds: 45.5,
    putts_per_minute: 6.59,
    makes_per_minute: 3.95,
    most_makes_in_60_seconds: 3,
    fastest_21_makes: null,
    date_recorded: new Date().toISOString()
  }
};

// Utility functions
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const requestModule = isHttps ? https : http;

    const req = requestModule.request(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options,
      timeout: CONFIG.TIMEOUT
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
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
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Test suites
class APITestSuite {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.results = [];
    this.environment = baseUrl.includes('localhost') ? 'DEV' : 'PROD';
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

  // Test 1: Sessions API Date Display
  async testSessionsDateDisplay() {
    return await this.test('Sessions API Date Display', async () => {
      const response = await makeRequest(`${this.baseUrl}/api/player/${CONFIG.TEST_PLAYER_ID}/sessions?limit=1`);

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.data.sessions || response.data.sessions.length === 0) {
        throw new Error('No sessions returned');
      }

      const session = response.data.sessions[0];

      // Check that date fields are not null/N/A
      if (!session.start_time || session.start_time === 'N/A') {
        throw new Error(`start_time is ${session.start_time}`);
      }

      if (!session.session_date || session.session_date === 'N/A') {
        throw new Error(`session_date is ${session.session_date}`);
      }

      // Validate date format
      const date = new Date(session.start_time);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${session.start_time}`);
      }

      return {
        session_id: session.session_id,
        start_time: session.start_time,
        session_date: session.session_date,
        duel_id: session.duel_id,
        valid_date: !isNaN(date.getTime())
      };
    });
  }

  // Test 2: Sessions API Duel Context
  async testSessionsDuelContext() {
    return await this.test('Sessions API Duel Context', async () => {
      const response = await makeRequest(`${this.baseUrl}/api/player/${CONFIG.TEST_PLAYER_ID}/sessions?limit=10`);

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}`);
      }

      if (!response.data.sessions) {
        throw new Error('No sessions array returned');
      }

      // Look for sessions with duel_id
      const duelSessions = response.data.sessions.filter(s => s.duel_id !== null && s.duel_id !== undefined);

      return {
        total_sessions: response.data.sessions.length,
        duel_sessions: duelSessions.length,
        sample_duel_session: duelSessions[0] || null,
        duel_ids_found: [...new Set(duelSessions.map(s => s.duel_id))]
      };
    });
  }

  // Test 3: Upload Session - Desktop Format
  async testUploadSessionDesktop() {
    return await this.test('Upload Session - Desktop Format', async () => {
      const sessionId = `test_desktop_${Date.now()}`;
      const payload = {
        session_id: sessionId,
        player_id: CONFIG.TEST_PLAYER_ID,
        session_data: TEST_SESSION_DATA.basic
      };

      const response = await makeRequest(`${this.baseUrl}/api/upload-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-desktop-upload': 'true'
        },
        body: payload
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (!response.data.success) {
        throw new Error(`Upload failed: ${response.data.message}`);
      }

      return {
        session_id: response.data.session_id,
        upload_success: response.data.success,
        uploaded_at: response.data.uploaded_at
      };
    });
  }

  // Test 4: Upload Session - Duel Association
  async testUploadSessionWithDuel() {
    return await this.test('Upload Session - Duel Association', async () => {
      const sessionId = `test_duel_${Date.now()}`;
      const payload = {
        session_id: sessionId,
        player_id: CONFIG.TEST_PLAYER_ID,
        session_data: TEST_SESSION_DATA.basic,
        duel_id: CONFIG.TEST_DUEL_ID
      };

      const response = await makeRequest(`${this.baseUrl}/api/upload-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-desktop-upload': 'true'
        },
        body: payload
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (!response.data.success) {
        throw new Error(`Upload failed: ${response.data.message}`);
      }

      if (!response.data.duel_linked) {
        throw new Error('Duel linking failed');
      }

      return {
        session_id: response.data.session_id,
        duel_linked: response.data.duel_linked,
        duel_id: response.data.duel_id
      };
    });
  }

  // Test 5: Error Scenarios
  async testErrorScenarios() {
    return await this.test('Error Scenarios', async () => {
      const tests = [];

      // Missing player_id
      try {
        await makeRequest(`${this.baseUrl}/api/upload-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-desktop-upload': 'true' },
          body: { session_data: TEST_SESSION_DATA.basic }
        });
        tests.push({ test: 'missing_player_id', result: 'FAIL - should have failed' });
      } catch (error) {
        tests.push({ test: 'missing_player_id', result: 'PASS - correctly failed' });
      }

      // Missing session_data
      try {
        await makeRequest(`${this.baseUrl}/api/upload-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-desktop-upload': 'true' },
          body: { player_id: CONFIG.TEST_PLAYER_ID }
        });
        tests.push({ test: 'missing_session_data', result: 'FAIL - should have failed' });
      } catch (error) {
        tests.push({ test: 'missing_session_data', result: 'PASS - correctly failed' });
      }

      return { error_tests: tests };
    });
  }

  // Test 6: End-to-End Validation
  async testEndToEndValidation() {
    return await this.test('End-to-End Validation', async () => {
      // Upload a session
      const sessionId = `test_e2e_${Date.now()}`;
      const uploadResponse = await makeRequest(`${this.baseUrl}/api/upload-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-desktop-upload': 'true' },
        body: {
          session_id: sessionId,
          player_id: CONFIG.TEST_PLAYER_ID,
          session_data: TEST_SESSION_DATA.basic
        }
      });

      if (!uploadResponse.data.success) {
        throw new Error('Upload failed');
      }

      // Wait a moment for database consistency
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Retrieve sessions and verify
      const sessionsResponse = await makeRequest(`${this.baseUrl}/api/player/${CONFIG.TEST_PLAYER_ID}/sessions?limit=5`);

      if (sessionsResponse.status !== 200) {
        throw new Error('Sessions retrieval failed');
      }

      const uploadedSession = sessionsResponse.data.sessions.find(s => s.session_id === sessionId);

      if (!uploadedSession) {
        throw new Error('Uploaded session not found in sessions list');
      }

      return {
        upload_success: true,
        retrieval_success: true,
        session_data: {
          session_id: uploadedSession.session_id,
          total_makes: uploadedSession.total_makes,
          start_time: uploadedSession.start_time,
          session_date: uploadedSession.session_date,
          duel_id: uploadedSession.duel_id
        }
      };
    });
  }

  // Run all tests
  async runAll() {
    this.log(`Starting comprehensive API tests for ${this.environment} environment`);
    const startTime = Date.now();

    try {
      await this.testSessionsDateDisplay();
      await this.testSessionsDuelContext();
      await this.testUploadSessionDesktop();
      await this.testUploadSessionWithDuel();
      await this.testErrorScenarios();
      await this.testEndToEndValidation();
    } catch (error) {
      this.log(`Test suite interrupted: ${error.message}`, 'ERROR');
    }

    const duration = Date.now() - startTime;
    this.printSummary(duration);
  }

  printSummary(duration) {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(80));
    console.log(`TEST SUMMARY - ${this.environment} Environment`);
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

  console.log(`Running API tests against: ${baseUrl}`);

  const suite = new APITestSuite(baseUrl);
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

export { APITestSuite, CONFIG };