export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { duel_id, duration_limit_minutes, player_id } = req.body;

  if (!duel_id) {
    return res.status(400).json({
      success: false,
      message: 'duel_id is required'
    });
  }

  // Generate deep link URL for the desktop app
  const deepLinkUrl = `proofofputt://duel/?id=${duel_id}${duration_limit_minutes ? `&timeLimit=${duration_limit_minutes}` : ''}`;

  // In a real implementation, you might:
  // 1. Validate the duel exists and player has permission
  // 2. Update duel status to "starting" 
  // 3. Send notification to opponent
  // 4. Log the session start attempt

  console.log(`Desktop session start requested for duel ${duel_id} by player ${player_id}`);
  console.log(`Deep link URL: ${deepLinkUrl}`);

  return res.status(200).json({
    success: true,
    message: 'Desktop session start initiated',
    deep_link_url: deepLinkUrl,
    duel_id,
    duration_limit_minutes: duration_limit_minutes || null,
    instructions: {
      desktop: 'Open this deep link to start the duel session in the desktop app',
      webapp: 'The desktop app will automatically start tracking when the deep link is opened'
    }
  });
}