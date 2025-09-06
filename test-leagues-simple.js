// Simple test to debug leagues API issues
const testLeagues = async () => {
  try {
    const response = await fetch('https://app.proofofputt.com/api/leagues?player_id=1', {
      headers: {
        'Authorization': 'Bearer your_token_here',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.text();
    console.log('Response data:', data);
    
    try {
      const json = JSON.parse(data);
      console.log('Parsed JSON:', json);
    } catch (e) {
      console.log('Not valid JSON');
    }
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
};

testLeagues();