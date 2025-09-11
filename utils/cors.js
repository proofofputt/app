// Centralized CORS configuration for security
export const corsConfig = {
  development: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080'
  ],
  production: [
    'https://app.proofofputt.com',
    'https://proofofputt.com'
  ]
};

export function setCORSHeaders(req, res) {
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? corsConfig.production 
    : [...corsConfig.production, ...corsConfig.development];
  
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  return true;
}