#!/usr/bin/env node

/**
 * Test OAuth Callback URL
 * Simulates a Google OAuth callback to test the endpoint
 */

import https from 'https';

const baseUrl = 'https://app.proofofputt.com';

console.log('\n🔍 Testing OAuth Callback Endpoint\n');

// Test 1: Callback with error parameter (should redirect to /login?oauth_error=test)
console.log('Test 1: Callback with error parameter');
const errorUrl = `${baseUrl}/api/auth/google/callback?error=test`;

https.get(errorUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
}, (res) => {
  console.log(`  Status: ${res.statusCode}`);
  console.log(`  Location: ${res.headers.location || 'none'}`);

  if (res.statusCode === 302 || res.statusCode === 301) {
    console.log('  ✅ Redirect working correctly');
  } else if (res.statusCode === 404) {
    console.log('  ❌ 404 Error - Callback endpoint not found!');
    console.log('  This means the /api/auth/google/callback route is not deployed');
  } else if (res.statusCode === 405) {
    console.log('  ⚠️  405 Method Not Allowed - Endpoint exists but rejects GET without params');
  } else {
    console.log(`  ⚠️  Unexpected status: ${res.statusCode}`);
  }

  console.log('\n💡 Solution:');
  console.log('  In Google Cloud Console (https://console.cloud.google.com):');
  console.log('  1. Go to APIs & Services > Credentials');
  console.log('  2. Click your OAuth 2.0 Client ID');
  console.log('  3. Under "Authorized redirect URIs", ensure this is listed:');
  console.log(`     ${baseUrl}/api/auth/google/callback`);
  console.log('  4. Save changes (may take 5-10 minutes to propagate)');
  console.log('');
}).on('error', (err) => {
  console.error('  ❌ Request failed:', err.message);
});
