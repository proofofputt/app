#!/usr/bin/env node

/**
 * OAuth Flow Test Suite
 * Tests both desktop and web OAuth flows
 */

import https from 'https';
import http from 'http';

// Test configuration
const CONFIG = {
  PROD_BASE_URL: process.env.API_BASE_URL || 'https://app.proofofputt.com',
  TIMEOUT: 10000,
};

// Utility function to make HTTP requests
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
          const parsed = data ? JSON.parse(data) : null;
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

class OAuthTestSuite {
  constructor() {
    this.results = [];
    this.baseUrl = CONFIG.PROD_BASE_URL;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const colors = {
      INFO: '\x1b[36m',
      PASS: '\x1b[32m',
      FAIL: '\x1b[31m',
      WARN: '\x1b[33m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[level]}[${timestamp}] [${level}] ${message}${reset}`);
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
      return null;
    }
  }

  // Test 1: Web OAuth Init Endpoint
  async testWebOAuthInit() {
    return await this.test('Web OAuth Init - Table Exists', async () => {
      const response = await makeRequest(`${this.baseUrl}/api/auth/google/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://app.proofofputt.com'
        },
        body: { mode: 'login' }
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (!response.data.success) {
        throw new Error(`OAuth init failed: ${response.data.message}`);
      }

      if (!response.data.authUrl) {
        throw new Error('No authUrl returned');
      }

      if (!response.data.state) {
        throw new Error('No state token returned');
      }

      return {
        success: true,
        has_auth_url: !!response.data.authUrl,
        has_state: !!response.data.state,
        session_id: response.data.sessionId
      };
    });
  }

  // Test 2: Desktop OAuth Verify Endpoint - New User
  async testDesktopOAuthVerifyNewUser() {
    return await this.test('Desktop OAuth Verify - New User Creation', async () => {
      const timestamp = Date.now();
      const testEmail = `oauth_test_${timestamp}@example.com`;
      const testGoogleId = `google_test_${timestamp}`;

      const response = await makeRequest(`${this.baseUrl}/api/auth/google/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          email: testEmail,
          google_id: testGoogleId,
          name: 'OAuth Test User'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.data)}`);
      }

      if (!response.data.success) {
        throw new Error(`OAuth verify failed: ${response.data.message}`);
      }

      if (!response.data.token) {
        throw new Error('No JWT token returned');
      }

      if (!response.data.player) {
        throw new Error('No player data returned');
      }

      if (response.data.player.email !== testEmail) {
        throw new Error(`Email mismatch: expected ${testEmail}, got ${response.data.player.email}`);
      }

      return {
        success: true,
        player_created: true,
        player_id: response.data.player.player_id,
        has_token: !!response.data.token,
        email: response.data.player.email
      };
    });
  }

  // Test 3: Desktop OAuth Verify Endpoint - Existing User
  async testDesktopOAuthVerifyExistingUser() {
    return await this.test('Desktop OAuth Verify - Existing User Login', async () => {
      const timestamp = Date.now();
      const testEmail = `oauth_existing_${timestamp}@example.com`;
      const testGoogleId = `google_existing_${timestamp}`;

      // First create the user
      const createResponse = await makeRequest(`${this.baseUrl}/api/auth/google/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          email: testEmail,
          google_id: testGoogleId,
          name: 'Existing OAuth User'
        }
      });

      if (createResponse.status !== 200 || !createResponse.data.success) {
        throw new Error('Failed to create test user');
      }

      const createdPlayerId = createResponse.data.player.player_id;

      // Now try to login with the same credentials
      const loginResponse = await makeRequest(`${this.baseUrl}/api/auth/google/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          email: testEmail,
          google_id: testGoogleId,
          name: 'Existing OAuth User'
        }
      });

      if (loginResponse.status !== 200) {
        throw new Error(`Expected 200, got ${loginResponse.status}: ${JSON.stringify(loginResponse.data)}`);
      }

      if (!loginResponse.data.success) {
        throw new Error(`OAuth verify failed: ${loginResponse.data.message}`);
      }

      if (loginResponse.data.player.player_id !== createdPlayerId) {
        throw new Error(`Player ID mismatch: expected ${createdPlayerId}, got ${loginResponse.data.player.player_id}`);
      }

      return {
        success: true,
        player_id_matched: true,
        player_id: loginResponse.data.player.player_id,
        has_token: !!loginResponse.data.token
      };
    });
  }

  // Test 4: Desktop OAuth Verify - Missing Fields
  async testDesktopOAuthVerifyValidation() {
    return await this.test('Desktop OAuth Verify - Validation', async () => {
      const tests = [];

      // Missing email
      const noEmailResponse = await makeRequest(`${this.baseUrl}/api/auth/google/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          google_id: 'test_google_id',
          name: 'Test User'
        }
      });

      tests.push({
        test: 'missing_email',
        passed: noEmailResponse.status === 400,
        status: noEmailResponse.status
      });

      // Missing google_id
      const noGoogleIdResponse = await makeRequest(`${this.baseUrl}/api/auth/google/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: 'test@example.com',
          name: 'Test User'
        }
      });

      tests.push({
        test: 'missing_google_id',
        passed: noGoogleIdResponse.status === 400,
        status: noGoogleIdResponse.status
      });

      const allPassed = tests.every(t => t.passed);
      if (!allPassed) {
        throw new Error(`Validation tests failed: ${JSON.stringify(tests)}`);
      }

      return { validation_tests: tests, all_passed: allPassed };
    });
  }

  // Test 5: Web OAuth Init - Different Modes
  async testWebOAuthInitModes() {
    return await this.test('Web OAuth Init - Login/Signup Modes', async () => {
      const modes = ['login', 'signup'];
      const results = [];

      for (const mode of modes) {
        const response = await makeRequest(`${this.baseUrl}/api/auth/google/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://app.proofofputt.com'
          },
          body: { mode }
        });

        results.push({
          mode,
          success: response.status === 200 && response.data?.success,
          status: response.status
        });
      }

      const allPassed = results.every(r => r.success);
      if (!allPassed) {
        throw new Error(`Mode tests failed: ${JSON.stringify(results)}`);
      }

      return { mode_tests: results, all_passed: allPassed };
    });
  }

  // Run all tests
  async runAll() {
    this.log(`Starting OAuth Flow Tests`);
    this.log(`Base URL: ${this.baseUrl}`);
    const startTime = Date.now();

    await this.testWebOAuthInit();
    await this.testWebOAuthInitModes();
    await this.testDesktopOAuthVerifyNewUser();
    await this.testDesktopOAuthVerifyExistingUser();
    await this.testDesktopOAuthVerifyValidation();

    const duration = Date.now() - startTime;
    this.printSummary(duration);
  }

  printSummary(duration) {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    console.log('\n' + '='.repeat(80));
    console.log('OAUTH FLOW TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Base URL: ${this.baseUrl}`);
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\nFAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(test => {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${test.error}`);
      });
    } else {
      console.log('\n✅ All OAuth tests passed!');
    }

    console.log('\n');
    return { passed, failed, total: this.results.length };
  }
}

// Main execution
async function main() {
  const suite = new OAuthTestSuite();
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

export { OAuthTestSuite };
