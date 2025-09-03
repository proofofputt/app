const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const handleResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  if (!response.ok) {
    let errorData = { message: `HTTP error! status: ${response.status}` };
    if (contentType?.includes("application/json")) {
      try {
        const jsonError = await response.json();
        errorData.message = jsonError.message || jsonError.error || 'Unknown server error.';
      } catch (e) {
        // The error response was not valid JSON.
        errorData.message = 'Failed to parse error response from server.';
      }
    }
    throw new Error(errorData.message);
  }
  // Handle cases where there might be no content
  if (response.status === 204) {
    return null;
  }
  return contentType?.includes("application/json") ? response.json() : response.text();
};

const getAuthToken = () => {
  try {
    // First try the authToken directly
    const token = localStorage.getItem('authToken');
    if (token) return token;
    
    // Fallback to checking playerData.token
    const playerData = JSON.parse(localStorage.getItem('playerData'));
    return playerData?.token;
  } catch {
    return null;
  }
};

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// --- Auth ---
export const apiLogin = (email, password) => 
  fetch(`${API_BASE_URL}/login`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ email, password }) }).then(handleResponse);

export const apiRegister = (name, email, password) => 
  fetch(`${API_BASE_URL}/register`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ name, email, password }) }).then(handleResponse);

export const apiForgotPassword = (email) => 
  fetch(`${API_BASE_URL}/forgot-password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ email }) }).then(handleResponse);

export const apiResetPassword = (token, new_password) => 
  fetch(`${API_BASE_URL}/reset-password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ token, new_password }) }).then(handleResponse);

// --- Player ---
export const apiGetPlayerData = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/data`, { headers: getHeaders() }).then(handleResponse);

export const apiGetCareerStats = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/stats`, { headers: getHeaders() }).then(handleResponse);

export const apiSearchPlayers = (term, excludePlayerId = null) => {
    let url = `${API_BASE_URL}/players/search?term=${encodeURIComponent(term)}`;
    if (excludePlayerId) {
        url += `&exclude_player_id=${excludePlayerId}`;
    }
    return fetch(url, { headers: getHeaders() }).then(handleResponse);
};

export const apiUpdatePlayer = (playerId, data) => 
  fetch(`${API_BASE_URL}/player/${playerId}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse);

export const apiUpdateSocials = (playerId, data) => 
  fetch(`${API_BASE_URL}/player/${playerId}/socials`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse);

export const apiUpdateNotificationPreferences = (playerId, data) => 
  fetch(`${API_BASE_URL}/player/${playerId}/notification-preferences`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse);

export const apiCancelSubscription = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/subscription/cancel`, { method: 'POST', headers: getHeaders() }).then(handleResponse);

// --- Sessions & Calibration ---
export const apiGetSessions = (playerId) => 
  fetch(`${API_BASE_URL}/sessions?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiGetPlayerSessions = (playerId, page = 1, limit = 25) => 
  fetch(`${API_BASE_URL}/player/${playerId}/sessions?page=${page}&limit=${limit}`, { headers: getHeaders() }).then(handleResponse);

export const apiStartSession = (player_id, duel_id = null, league_round_id = null) => {
  const body = { player_id };
  if (duel_id) body.duel_id = duel_id;
  if (league_round_id) body.league_round_id = league_round_id;
  return fetch(`${API_BASE_URL}/start-session`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) }).then(handleResponse);
};

export const apiStartCalibration = (playerId) => 
  fetch(`${API_BASE_URL}/start-calibration`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId }) }).then(handleResponse);

export const apiGetCalibrationStatus = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/calibration`, { headers: getHeaders() }).then(handleResponse);

// --- Duels ---
export const apiListDuels = (playerId) => 
  fetch(`${API_BASE_URL}/duels?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiGetPlayerVsPlayerDuels = (player1Id, player2Id) => 
  fetch(`${API_BASE_URL}/players/${player1Id}/vs/${player2Id}/duels`, { headers: getHeaders() }).then(handleResponse);

export const apiGetPlayerVsPlayerLeaderboard = (player1Id, player2Id) => 
  fetch(`${API_BASE_URL}/players/${player1Id}/vs/${player2Id}/leaderboard`, { headers: getHeaders() }).then(handleResponse);

export const apiCreateDuel = (duelData) => 
  fetch(`${API_BASE_URL}/duels`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(duelData) }).then(handleResponse);

export const apiRespondToDuel = (duelId, playerId, response) => 
  fetch(`${API_BASE_URL}/duels/${duelId}/respond`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId, response }) }).then(handleResponse);

export const apiSubmitSessionToDuel = (duelId, playerId, sessionId) => 
  fetch(`${API_BASE_URL}/duels/${duelId}/submit`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId, session_id: sessionId }) }).then(handleResponse);

// --- Leagues ---
export const apiListLeagues = (playerId) => 
  fetch(`${API_BASE_URL}/leagues?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiGetLeagueDetails = (leagueId, playerId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiCreateLeague = (leagueData) => 
  fetch(`${API_BASE_URL}/leagues`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(leagueData) }).then(handleResponse);

export const apiJoinLeague = (leagueId, playerId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}/join`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId }) }).then(handleResponse);

export const apiInviteToLeague = (leagueId, inviterId, inviteeId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}/invite`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ inviter_id: inviterId, invitee_id: inviteeId }) }).then(handleResponse);

export const apiRespondToLeagueInvite = (leagueId, playerId, action) => 
  fetch(`${API_BASE_URL}/leagues/invites/${leagueId}/respond`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId, action }) }).then(handleResponse);

export const apiUpdateLeagueSettings = (leagueId, editorId, settings) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ editor_id: editorId, settings }) }).then(handleResponse);

export const apiDeleteLeague = (leagueId, deleterId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ deleter_id: deleterId }) }).then(handleResponse);

// --- Fundraising ---
export const apiListFundraisers = () => 
  fetch(`${API_BASE_URL}/fundraisers`, { headers: getHeaders() }).then(handleResponse);

export const apiGetFundraiserDetails = (fundraiserId) => 
  fetch(`${API_BASE_URL}/fundraisers/${fundraiserId}`, { headers: getHeaders() }).then(handleResponse);

export const apiCreateFundraiser = (fundraiserData) => 
  fetch(`${API_BASE_URL}/fundraisers`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(fundraiserData) }).then(handleResponse);

export const apiCreatePledge = (fundraiserId, pledgeData) => 
  fetch(`${API_BASE_URL}/fundraisers/${fundraiserId}/pledge`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(pledgeData) }).then(handleResponse);

// --- AI Coach ---
export const apiCoachChat = (payload) => 
  fetch(`${API_BASE_URL}/coach/chat`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }).then(handleResponse);

export const apiListConversations = (playerId) => 
  fetch(`${API_BASE_URL}/coach/conversations?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiGetConversationHistory = (conversationId) => 
  fetch(`${API_BASE_URL}/coach/conversations/${conversationId}`, { headers: getHeaders() }).then(handleResponse);

// --- Leaderboards ---
export const apiGetLeaderboards = () => 
  fetch(`${API_BASE_URL}/leaderboards`, { headers: getHeaders() }).then(handleResponse);

// --- Desktop App ---
export const apiCheckDesktopStatus = () => 
  fetch(`${API_BASE_URL}/desktop/status`, { headers: getHeaders() }).then(handleResponse);

// --- Missing Functions ---
export const apiUpdatePlayerSocials = (playerId, data) => 
  fetch(`${API_BASE_URL}/player/${playerId}/socials`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse);

export const apiGetLatestSessions = (playerId, limit = 5) => 
  fetch(`${API_BASE_URL}/player/${playerId}/sessions?limit=${limit}`, { headers: getHeaders() }).then(handleResponse);

// --- Notifications ---
export const apiGetNotifications = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/notifications`, { headers: getHeaders() }).then(handleResponse);

export const apiGetUnreadNotificationsCount = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/notifications/unread-count`, { headers: getHeaders() }).then(handleResponse);

export const apiMarkNotificationAsRead = (playerId, notificationId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/notifications/${notificationId}/read`, { method: 'POST', headers: getHeaders() }).then(handleResponse);

export const apiMarkAllNotificationsAsRead = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/notifications/read-all`, { method: 'POST', headers: getHeaders() }).then(handleResponse);

export const apiDeleteNotification = (playerId, notificationId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/notifications/${notificationId}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse);

// --- Subscription / Coupon ---
export const apiRedeemCoupon = (playerId, couponCode) => {
  const token = getAuthToken();
  return fetch(`${API_BASE_URL}/player/${playerId}/redeem-coupon`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ coupon_code: couponCode })
  }).then(handleResponse);
};