const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// A more robust response handler that checks for JSON content type
const handleResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  if (!response.ok) {
    let errorData = { error: `HTTP error! status: ${response.status}` };
    if (contentType && contentType.includes("application/json")) {
      try {
        errorData = await response.json();
      } catch (e) {
        errorData.error = 'Failed to parse error response from server.';
      }
    }
    throw new Error(errorData.error || 'An unknown server error occurred.');
  }
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
};

// --- Auth & User Account ---
export const apiLogin = (email, password) => {
  return fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(handleResponse);
};

export const apiRegister = (email, password, name) => {
  return fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  }).then(handleResponse);
};

export const apiForgotPassword = (email) => {
  return fetch(`${API_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(handleResponse);
};

export const apiResetPassword = (token, newPassword) => {
  return fetch(`${API_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  }).then(handleResponse);
};

// --- Player Data & Settings ---
export const apiGetPlayerData = (playerId) => fetch(`${API_BASE_URL}/player/${playerId}/data`).then(handleResponse);
export const apiGetCareerStats = (playerId) => fetch(`${API_BASE_URL}/player/${playerId}/career-stats`).then(handleResponse);
export const apiSearchPlayers = (searchTerm) => fetch(`${API_BASE_URL}/players/search?term=${searchTerm}`).then(handleResponse);

export const apiUpdatePlayer = (playerId, updates) => {
  return fetch(`${API_BASE_URL}/player/${playerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }).then(handleResponse);
};

export const apiUpdatePlayerSocials = (playerId, socials) => {
  return fetch(`${API_BASE_URL}/player/${playerId}/socials`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(socials),
  }).then(handleResponse);
};

export const apiUpdateNotificationPreferences = (playerId, preferences) => {
  return fetch(`${API_BASE_URL}/player/${playerId}/notification-preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  }).then(handleResponse);
};

// --- Sessions & Calibration ---
export const apiGetSessions = (playerId) => fetch(`${API_BASE_URL}/sessions?player_id=${playerId}`).then(handleResponse);
export const apiGetPlayerSessions = (playerId, page = 1, limit = 25) => fetch(`${API_BASE_URL}/player/${playerId}/sessions?page=${page}&limit=${limit}`).then(handleResponse);

export const apiStartSession = (playerId, duelId, leagueRoundId) => {
  const payload = { player_id: playerId };
  if (duelId) payload.duel_id = duelId;
  if (leagueRoundId) payload.league_round_id = leagueRoundId;
  return fetch(`${API_BASE_URL}/start-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse);
};

export const apiStartCalibration = (playerId) => {
  return fetch(`${API_BASE_URL}/start-calibration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).then(handleResponse);
};

// --- Duels ---
export const apiListDuels = (playerId) => fetch(`${API_BASE_URL}/duels/list/${playerId}`).then(handleResponse);
export const apiGetPlayerVsPlayerDuels = (player1Id, player2Id) => fetch(`${API_BASE_URL}/players/${player1Id}/vs/${player2Id}/duels`).then(handleResponse);
export const apiGetPlayerVsPlayerLeaderboard = (player1Id, player2Id) => fetch(`${API_BASE_URL}/players/${player1Id}/vs/${player2Id}/leaderboard`).then(handleResponse);

export const apiCreateDuel = (duelData) => {
  return fetch(`${API_BASE_URL}/duels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(duelData),
  }).then(handleResponse);
};

export const apiRespondToDuel = (duelId, playerId, response) => {
  return fetch(`${API_BASE_URL}/duels/${duelId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, response }),
  }).then(handleResponse);
};

export const apiSubmitSessionToDuel = (duelId, playerId, sessionId) => {
  return fetch(`${API_BASE_URL}/duels/${duelId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, session_id: sessionId }),
  }).then(handleResponse);
};

// --- Leagues ---
export const apiListLeagues = (playerId) => fetch(`${API_BASE_URL}/leagues?player_id=${playerId}`).then(handleResponse);
export const apiGetLeagueDetails = (leagueId, playerId) => fetch(`${API_BASE_URL}/leagues/${leagueId}?player_id=${playerId}`).then(handleResponse);
export const apiGetLeagueLeaderboard = (leagueId, playerId) => fetch(`${API_BASE_URL}/leagues/${leagueId}/leaderboard?player_id=${playerId}`).then(handleResponse);

export const apiCreateLeague = (leagueData) => {
  return fetch(`${API_BASE_URL}/leagues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leagueData),
  }).then(handleResponse);
};

export const apiJoinLeague = (leagueId, playerId) => {
  return fetch(`${API_BASE_URL}/leagues/${leagueId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).then(handleResponse);
};

export const apiInviteToLeague = (leagueId, playerId) => {
  return fetch(`${API_BASE_URL}/leagues/${leagueId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).then(handleResponse);
};

export const apiRespondToLeagueInvite = (leagueId, playerId, action) => {
  return fetch(`${API_BASE_URL}/leagues/invites/${leagueId}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId, action }),
  }).then(handleResponse);
};

export const apiUpdateLeagueSettings = (leagueId, editorId, settings) => {
  return fetch(`${API_BASE_URL}/leagues/${leagueId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editor_id: editorId, settings }),
  }).then(handleResponse);
};

export const apiDeleteLeague = (leagueId, deleterId) => {
  return fetch(`${API_BASE_URL}/leagues/${leagueId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleter_id: deleterId }),
  }).then(handleResponse);
};

// --- Fundraising ---
export const apiListFundraisers = () => fetch(`${API_BASE_URL}/fundraisers`).then(handleResponse);
export const apiGetFundraiserDetails = (fundraiserId) => fetch(`${API_BASE_URL}/fundraisers/${fundraiserId}`).then(handleResponse);

export const apiCreateFundraiser = (fundraiserData) => {
  return fetch(`${API_BASE_URL}/fundraisers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fundraiserData),
  }).then(handleResponse);
};

export const apiCreatePledge = (fundraiserId, pledgeData) => {
  return fetch(`${API_BASE_URL}/fundraisers/${fundraiserId}/pledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pledgeData),
  }).then(handleResponse);
};

// --- Notifications ---
export const apiGetNotifications = (playerId, limit, offset) => fetch(`${API_BASE_URL}/notifications/${playerId}?limit=${limit}&offset=${offset}`).then(handleResponse);
export const apiGetUnreadNotificationsCount = (playerId) => fetch(`${API_BASE_URL}/notifications/${playerId}/unread_count`).then(handleResponse);

export const apiMarkNotificationAsRead = (notificationId, playerId) => {
  return fetch(`${API_BASE_URL}/notifications/${notificationId}/mark_read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).then(handleResponse);
};

export const apiMarkAllNotificationsAsRead = (playerId) => {
  return fetch(`${API_BASE_URL}/notifications/${playerId}/mark_all_read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).then(handleResponse);
};

export const apiDeleteNotification = (notificationId, playerId) => {
  return fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId }),
  }).then(handleResponse);
};

// --- AI Coach ---
export const apiCoachChat = (payload) => {
  return fetch(`${API_BASE_URL}/coach/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(handleResponse);
};

export const apiListConversations = (playerId) => {
  return fetch(`${API_BASE_URL}/coach/conversations?player_id=${playerId}`).then(handleResponse);
};

export const apiGetConversationHistory = (conversationId) => {
  return fetch(`${API_BASE_URL}/coach/conversations/${conversationId}`).then(handleResponse);
};

// --- Misc ---
export const apiGetLeaderboards = () => fetch(`${API_BASE_URL}/leaderboards`).then(handleResponse);

export const apiRedeemCoupon = (playerId, couponCode) => {
  return fetch(`${API_BASE_URL}/player/${playerId}/redeem-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coupon_code: couponCode }),
  }).then(handleResponse);
};

export const apiCancelSubscription = (playerId) => {
  return fetch(`${API_BASE_URL}/player/${playerId}/subscription/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }).then(handleResponse);
};