const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const handleResponse = async (response) => {
  const contentType = response.headers.get("content-type");
  // Gracefully handle 404s by returning null, as this is often an expected state (e.g., new player with no stats).
  if (response.status === 404) {
    return null;
  }

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
    // Always get the authToken from localStorage (this is where it's actually stored)
    const token = localStorage.getItem('authToken');
    console.log('[getAuthToken] Token retrieved:', token ? 'present' : 'missing');
    return token;
  } catch (error) {
    console.error('[getAuthToken] Error retrieving token:', error);
    return null;
  }
};

const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[getHeaders] Authorization header set with token');
  } else {
    console.warn('[getHeaders] No token available - request will be unauthenticated');
  }
  return headers;
};

// --- Auth ---
export const apiLogin = (email, password) => 
  fetch(`${API_BASE_URL}/login`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ email, password }) }).then(handleResponse);

export const apiRegister = (name, email, password, referralSessionId = null, consentContactInfo = true) => 
  fetch(`${API_BASE_URL}/register`, { 
    method: 'POST', 
    headers: getHeaders(), 
    body: JSON.stringify({ 
      name, 
      email, 
      password, 
      referral_session_id: referralSessionId,
      consent_contact_info: consentContactInfo
    }) 
  }).then(handleResponse);

export const apiForgotPassword = (email) => 
  fetch(`${API_BASE_URL}/forgot-password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ email }) }).then(handleResponse);

export const apiResetPassword = (token, password) =>
  fetch(`${API_BASE_URL}/reset-password`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ token, password }) }).then(handleResponse);

export const apiChangePassword = (playerId, oldPassword, newPassword) =>
  fetch(`${API_BASE_URL}/player/${playerId}/change-password`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  }).then(handleResponse);

// --- Player ---
export const apiGetPlayerData = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/data`, { headers: getHeaders() }).then(handleResponse);

export const apiGetCareerStats = (playerId) => 
  fetch(`${API_BASE_URL}/career-stats?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiSearchPlayers = (term, excludePlayerId = null) => {
    let url = `${API_BASE_URL}/players/search?term=${encodeURIComponent(term)}`;
    if (excludePlayerId) {
        url += `&exclude_player_id=${excludePlayerId}`;
    }
    return fetch(url, { headers: getHeaders() })
        .then(handleResponse)
        .then(response => {
            // Handle both old format (array) and new format ({ success, players })
            if (response && typeof response === 'object' && response.players) {
                return response.players;
            }
            // Fallback to direct array response for backward compatibility
            return Array.isArray(response) ? response : [];
        });
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
export const apiGetSessions = (playerId, limit = 20) => 
  fetch(`${API_BASE_URL}/sessions?player_id=${playerId}&limit=${limit}`, { headers: getHeaders() }).then(handleResponse);

export const apiGetPlayerSessions = (playerId, page = 1, limit = 21) => 
  fetch(`${API_BASE_URL}/player/${playerId}/sessions?page=${page}&limit=${limit}`, { headers: getHeaders() }).then(handleResponse);

export const apiStartSession = async (player_id, duel_id = null, league_round_id = null) => {
  const body = { player_id };
  if (duel_id) body.duel_id = duel_id;
  if (league_round_id) body.league_round_id = league_round_id;
  
  console.log('[apiStartSession] Request:', body);
  
  try {
    const response = await fetch(`${API_BASE_URL}/start-session`, { 
      method: 'POST', 
      headers: getHeaders(), 
      body: JSON.stringify(body) 
    });
    
    console.log('[apiStartSession] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[apiStartSession] Error response:', errorData);
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('[apiStartSession] Success response:', result);
    return result;
  } catch (error) {
    console.error('[apiStartSession] Request failed:', error);
    throw error;
  }
};

// Calibration functions removed - now handled by desktop app

// --- Duels ---
export const apiListDuels = (playerId) => {
  console.log('[apiListDuels] Called with playerId:', playerId);
  if (!playerId) {
    console.warn('[apiListDuels] playerId is missing, returning empty array');
    return Promise.resolve({ duels: [] });
  }
  return fetch(`${API_BASE_URL}/duels?player_id=${playerId}`, { headers: getHeaders() })
    .then(handleResponse)
    .then(response => {
      // Handle the response structure from duels API
      if (response && typeof response === 'object' && response.duels) {
        return response.duels;
      }
      // Fallback to empty array if no duels
      return [];
    });
};

export const apiGetPlayerVsPlayerDuels = (player1Id, player2Id) => 
  fetch(`${API_BASE_URL}/players/${player1Id}/vs/${player2Id}/duels`, { headers: getHeaders() }).then(handleResponse);

export const apiGetPlayerVsPlayerLeaderboard = (player1Id, player2Id) => 
  fetch(`${API_BASE_URL}/players/${player1Id}/vs/${player2Id}/leaderboard`, { headers: getHeaders() }).then(handleResponse);

export const apiCreateDuel = (duelData) => {
  console.log('[apiCreateDuel] Creating duel with data:', duelData);
  const headers = getHeaders();
  console.log('[apiCreateDuel] Request headers:', headers);
  return fetch(`${API_BASE_URL}/duels`, {
    method: 'POST',
    headers,
    body: JSON.stringify(duelData)
  }).then(handleResponse);
};

export const apiRespondToDuel = (duelId, playerId, response) => {
  console.log('[apiRespondToDuel] Request:', { duelId, playerId, response, url: `${API_BASE_URL}/duels/${duelId}/respond` });
  return fetch(`${API_BASE_URL}/duels/${duelId}/respond`, { 
    method: 'POST', 
    headers: getHeaders(), 
    body: JSON.stringify({ player_id: playerId, response }) 
  }).then(async res => {
    console.log('[apiRespondToDuel] Response status:', res.status, res.statusText);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('[apiRespondToDuel] Error response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || 'Unknown error' };
      }
      throw new Error(errorData.message || errorData.error || 'Failed to respond to duel');
    }
    return res.json();
  });
};

export const apiSubmitSessionToDuel = (duelId, playerId, sessionId) => 
  fetch(`${API_BASE_URL}/duels/${duelId}/submit`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId, session_id: sessionId }) }).then(handleResponse);

export const apiCancelDuel = (duelId) => {
  console.log('[apiCancelDuel] Request:', { duelId, url: `${API_BASE_URL}/duels/${duelId}/cancel` });
  return fetch(`${API_BASE_URL}/duels/${duelId}/cancel`, { 
    method: 'POST', 
    headers: getHeaders()
  }).then(async res => {
    console.log('[apiCancelDuel] Response status:', res.status, res.statusText);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('[apiCancelDuel] Error response:', errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || 'Unknown error' };
      }
      throw new Error(errorData.message || errorData.error || 'Failed to cancel duel');
    }
    return res.json();
  });
};

// --- Leagues ---
export const apiListLeagues = (playerId) => 
  fetch(`${API_BASE_URL}/leagues?player_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiGetLeagueDetails = (leagueId, playerId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}?player_id=${playerId}`, { headers: getHeaders() })
    .then(handleResponse)
    .then(response => {
      // Handle both old structure (wrapped) and new structure (direct)
      if (response && typeof response === 'object') {
        // If response has success field, extract the league data
        if (response.success !== undefined && response.league) {
          const leagueData = {
            ...response.league,
            // Add missing fields that frontend expects
            creator_id: response.league.creator_id || response.league.created_by,
            privacy_type: response.league.privacy_type || response.league.privacy || 'public',
            start_time: response.league.start_time || response.league.created_at,
            members: response.members || [],
            rounds: (response.rounds || []).map(round => ({
              ...round,
              submissions: round.submissions || []
            }))
          };
          return leagueData;
        }
        // If response is direct league data, return as-is
        return response;
      }
      return response;
    });

export const apiCreateLeague = (leagueData) => 
  fetch(`${API_BASE_URL}/leagues`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(leagueData) }).then(handleResponse);

export const apiJoinLeague = (leagueId, playerId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}/join`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId }) }).then(handleResponse);

export const apiInviteToLeague = (leagueId, inviteeId, inviterId = null) =>
  fetch(`${API_BASE_URL}/leagues/${leagueId}/invite`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ invitee_id: inviteeId, inviter_id: inviterId }) }).then(handleResponse);

export const apiRespondToLeagueInvite = (inviteId, playerId, action) => 
  fetch(`${API_BASE_URL}/leagues/invites/${inviteId}/respond`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ player_id: playerId, action }) }).then(handleResponse);

export const apiUpdateLeagueSettings = (leagueId, editorId, settings) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ editor_id: editorId, settings }) }).then(handleResponse);

export const apiStartLeague = (leagueId) => 
  fetch(`${API_BASE_URL}/leagues/${leagueId}/start`, { method: 'POST', headers: getHeaders() }).then(handleResponse);

export const apiDeleteLeague = (leagueId) =>
  fetch(`${API_BASE_URL}/leagues/${leagueId}`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ action: 'delete' }) }).then(handleResponse);

export const apiLeaveLeague = (leagueId) =>
  fetch(`${API_BASE_URL}/leagues/${leagueId}`, { method: 'DELETE', headers: getHeaders(), body: JSON.stringify({ action: 'leave' }) }).then(handleResponse);

// Get league invitations for a player
export const apiGetLeagueInvitations = (playerId) =>
  fetch(`${API_BASE_URL}/players/${playerId}/league-invitations`, { headers: getHeaders() }).then(handleResponse);

// Get my league invitations (sent or received)
export const apiGetMyLeagueInvitations = (type = 'received') =>
  fetch(`${API_BASE_URL}/leagues/invitations/my-invitations?type=${type}`, { headers: getHeaders() }).then(handleResponse);

// Cancel a league invitation
export const apiCancelLeagueInvitation = (invitationId) =>
  fetch(`${API_BASE_URL}/leagues/invitations/${invitationId}/cancel`, { method: 'POST', headers: getHeaders() }).then(handleResponse);

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
export const apiGetLeaderboard = (params) => {
  const query = new URLSearchParams(params).toString();
  // Assuming the new endpoint is at /api/leaderboards-v2 as per the file name.
  // Adjust if the deployed route is different (e.g., /api/v2/leaderboards).
  return fetch(`${API_BASE_URL}/leaderboards-v2?${query}`, { headers: getHeaders() }).then(handleResponse);
};


// --- Desktop App ---
export const apiCheckDesktopStatus = () => 
  fetch(`${API_BASE_URL}/desktop/status`, { headers: getHeaders() }).then(handleResponse);

// --- Missing Functions ---
export const apiUpdatePlayerSocials = (playerId, data) => 
  fetch(`${API_BASE_URL}/player/${playerId}/socials`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) }).then(handleResponse);

export const apiGetLatestSessions = (playerId, limit = 5) => 
  fetch(`${API_BASE_URL}/player-sessions-latest?player_id=${playerId}&limit=${limit}`, { headers: getHeaders() }).then(handleResponse);

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
  return fetch(`${API_BASE_URL}/redeem-coupon`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ player_id: playerId, coupon_code: couponCode })
  }).then(handleResponse);
};

// --- Friends & Social ---
export const apiListFriends = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends`, { headers: getHeaders() }).then(handleResponse);

// Add friend by private identifier (email, phone, or username)
export const apiAddFriendByIdentifier = (playerId, identifier, identifierType = 'auto') => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/add`, { 
    method: 'POST', 
    headers: getHeaders(), 
    body: JSON.stringify({ identifier, identifier_type: identifierType })
  }).then(handleResponse);

// Legacy method - kept for backward compatibility
export const apiAddFriend = (playerId, friendId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/${friendId}`, { method: 'POST', headers: getHeaders() }).then(handleResponse);

export const apiRemoveFriend = (playerId, friendId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/${friendId}`, { method: 'DELETE', headers: getHeaders() }).then(handleResponse);

export const apiFriendsSocialActivity = (playerId) => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/activity`, { headers: getHeaders() }).then(handleResponse);

// Search players by username only (public search)
export const apiSearchPlayersByUsername = (playerId, usernameQuery) => 
  fetch(`${API_BASE_URL}/players/search/username?q=${encodeURIComponent(usernameQuery)}&requester_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

// Private search for adding friends (email, phone, username)
export const apiSearchPlayersForFriends = (playerId, query, searchType = 'auto') => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/search`, { 
    method: 'POST', 
    headers: getHeaders(), 
    body: JSON.stringify({ query, search_type: searchType })
  }).then(handleResponse);

// Legacy method - kept for backward compatibility  
export const apiSearchPlayersLegacy = (playerId, query) => 
  fetch(`${API_BASE_URL}/players/search/username?q=${encodeURIComponent(query)}&requester_id=${playerId}`, { headers: getHeaders() }).then(handleResponse);

export const apiFriendsLeaderboard = (playerId, sortBy = 'ranking_points', timeframe = 'all_time') => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/leaderboard?sort_by=${sortBy}&timeframe=${timeframe}`, { headers: getHeaders() }).then(handleResponse);

// Friend requests
export const apiSendFriendRequest = (playerId, targetIdentifier, identifierType = 'auto') => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/request`, { 
    method: 'POST', 
    headers: getHeaders(), 
    body: JSON.stringify({ target_identifier: targetIdentifier, identifier_type: identifierType })
  }).then(handleResponse);

export const apiRespondToFriendRequest = (playerId, requestId, action) => 
  fetch(`${API_BASE_URL}/player/${playerId}/friends/request/${requestId}`, { 
    method: 'POST', 
    headers: getHeaders(), 
    body: JSON.stringify({ action })
  }).then(handleResponse);

export const apiGetFriendRequests = (playerId) =>
  fetch(`${API_BASE_URL}/player/${playerId}/friends/requests`, { headers: getHeaders() }).then(handleResponse);

// --- User Feedback & Comments ---
export const apiGetFeedbackThreads = (status = null) => {
  const url = status
    ? `${API_BASE_URL}/user-feedback?status=${status}`
    : `${API_BASE_URL}/user-feedback`;
  return fetch(url, { headers: getHeaders() }).then(handleResponse);
};

export const apiGetFeedbackThread = (threadId) =>
  fetch(`${API_BASE_URL}/user-feedback?thread_id=${threadId}`, { headers: getHeaders() }).then(handleResponse);

export const apiCreateFeedbackThread = (feedbackData) =>
  fetch(`${API_BASE_URL}/user-feedback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(feedbackData)
  }).then(handleResponse);

export const apiAddFeedbackMessage = (threadId, messageText) =>
  fetch(`${API_BASE_URL}/user-feedback`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ thread_id: threadId, message_text: messageText })
  }).then(handleResponse);

// --- Admin: Feedback Management ---
export const apiAdminGetAllFeedback = (filters = {}, pagination = {}) => {
  const params = new URLSearchParams();

  if (filters.status) params.append('status', filters.status);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.category) params.append('category', filters.category);
  if (pagination.limit) params.append('limit', pagination.limit);
  if (pagination.offset) params.append('offset', pagination.offset);

  const queryString = params.toString();
  const url = queryString ? `${API_BASE_URL}/admin/feedback?${queryString}` : `${API_BASE_URL}/admin/feedback`;

  return fetch(url, { headers: getHeaders() }).then(handleResponse);
};

export const apiAdminUpdateThread = (threadId, updates) =>
  fetch(`${API_BASE_URL}/admin/feedback`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ thread_id: threadId, ...updates })
  }).then(handleResponse);

export const apiAdminBulkUpdateThreads = (threadIds, updates) =>
  fetch(`${API_BASE_URL}/admin/feedback`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ thread_ids: threadIds, ...updates })
  }).then(handleResponse);

export const apiAdminGetFeedbackStats = () =>
  fetch(`${API_BASE_URL}/admin/feedback-stats`, { headers: getHeaders() }).then(handleResponse);

export const apiAdminRespondToThread = (threadId, messageText, autoInProgress = true) =>
  fetch(`${API_BASE_URL}/admin/feedback-respond`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ thread_id: threadId, message_text: messageText, auto_in_progress: autoInProgress })
  }).then(handleResponse);