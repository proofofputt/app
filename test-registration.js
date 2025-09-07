// Test script to verify registration API endpoint
const API_BASE_URL = 'https://app.proofofputt.com/api';

async function testRegistration() {
  console.log('Testing registration endpoint...');
  
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness
  const testUser = {
    name: `Test User ${timestamp}`,
    email: `test${timestamp}@example.com`,
    password: 'testpassword123'
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers.entries()]);
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Registration test PASSED');
    } else {
      console.log('❌ Registration test FAILED:', data.error);
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

async function testForgotPassword() {
  console.log('\nTesting forgot password endpoint...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
    
    if (response.ok) {
      console.log('✅ Forgot password test PASSED');
    } else {
      console.log('❌ Forgot password test FAILED:', data.error);
    }
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Run tests
testRegistration().then(() => testForgotPassword());