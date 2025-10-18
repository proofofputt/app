import jwt from 'jsonwebtoken';

// Token from browser console
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF5ZXJJZCI6MSwiZW1haWwiOiJwb3BAcHJvb2ZvZnB1dHQuY29tIiwiaWF0IjoxNzYwNTAyODI4LCJleHAiOjE3NjA1ODkyMjh9.8ihi1ezXdimDHFtftao5uorn5QEwgGLSnfuzLP3Td0o";

console.log('Decoding JWT token without verification:');
const decoded = jwt.decode(token);
console.log(JSON.stringify(decoded, null, 2));

console.log('\n===========================================');
console.log('Token Analysis:');
console.log('===========================================');
console.log('Has playerId field:', 'playerId' in decoded);
console.log('Has player_id field:', 'player_id' in decoded);
console.log('Player ID value:', decoded.playerId || decoded.player_id);
console.log('Email:', decoded.email);

console.log('\nTimestamps:');
console.log('Issued at (iat):', new Date(decoded.iat * 1000).toISOString());
console.log('Expires at (exp):', new Date(decoded.exp * 1000).toISOString());
console.log('Current time:', new Date().toISOString());

const now = Math.floor(Date.now() / 1000);
console.log('\nExpiration Check:');
console.log('Current timestamp:', now);
console.log('Token exp timestamp:', decoded.exp);
console.log('Difference (seconds):', decoded.exp - now);

if (decoded.exp < now) {
  const minutesAgo = Math.floor((now - decoded.exp) / 60);
  const hoursAgo = Math.floor(minutesAgo / 60);
  const daysAgo = Math.floor(hoursAgo / 24);

  console.log('❌ TOKEN IS EXPIRED!');
  console.log(`   Expired ${daysAgo} days, ${hoursAgo % 24} hours, ${minutesAgo % 60} minutes ago`);
  console.log('\n🔧 SOLUTION: Log out and log back in to get a fresh token');
} else {
  const minutesLeft = Math.floor((decoded.exp - now) / 60);
  console.log(`✅ TOKEN IS VALID (expires in ${minutesLeft} minutes)`);
}
