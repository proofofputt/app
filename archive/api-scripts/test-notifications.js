import notificationService from './services/notification.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerId, type = 'test' } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }

    let result;

    switch (type) {
      case 'duel_challenge':
        result = await notificationService.createDuelChallengeNotification({
          playerId: playerId,
          challengerName: 'Test Player',
          duelId: 1
        });
        break;

      case 'league_invitation':
        result = await notificationService.createLeagueInvitationNotification({
          playerId: playerId,
          inviterName: 'Test Inviter',
          leagueName: 'Test League',
          leagueId: 1
        });
        break;

      case 'friend_request':
        result = await notificationService.createFriendRequestNotification({
          playerId: playerId,
          requesterName: 'Test Friend',
          requestId: 1
        });
        break;

      case 'achievement':
        result = await notificationService.createAchievementNotification({
          playerId: playerId,
          achievementName: 'Test Achievement',
          description: 'You did something great!'
        });
        break;

      case 'system':
        result = await notificationService.createSystemNotification({
          playerId: playerId,
          title: 'System Test',
          message: 'This is a test system notification'
        });
        break;

      default:
        result = await notificationService.createNotification({
          playerId: playerId,
          type: 'test',
          title: 'Test Notification',
          message: 'This is a test notification from the notification system',
          linkPath: '/dashboard'
        });
    }

    return res.status(200).json({
      success: true,
      message: 'Test notification created',
      result: result
    });

  } catch (error) {
    console.error('Test notification error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}