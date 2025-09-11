// Script to test fundraisers API
import fetch from 'node-fetch';

async function testFundraisers() {
  try {
    console.log('💰 Testing fundraisers API...');
    
    // Test GET fundraisers endpoint
    const apiUrl = 'https://app.proofofputt.com/api/fundraisers';
    
    const response = await fetch(apiUrl);
    console.log('📊 Response status:', response.status);
    
    const responseData = await response.json();
    console.log('📋 Response data:', JSON.stringify(responseData, null, 2));
    
    if (responseData.success) {
      console.log('✅ Fundraisers API working correctly');
      console.log(`   Found ${responseData.fundraisers?.length || 0} fundraisers`);
    } else {
      console.log('⚠️ API returned success: false');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFundraisers();