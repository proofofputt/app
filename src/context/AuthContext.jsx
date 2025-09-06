import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiLogin, apiRegister, apiGetPlayerData, apiGetLatestSessions, apiChangePassword } from '../api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [playerData, setPlayerData] = useState(() => {
    try {
      const storedData = localStorage.getItem('playerData');
      return storedData ? JSON.parse(storedData) : null;
    } catch (error) {
      console.error("Failed to parse player data from localStorage", error);
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(() => {
    // Only show loading if we have stored player data that needs refreshing
    try {
      const storedData = localStorage.getItem('playerData');
      return !!storedData; // Only loading if we have data to refresh
    } catch (error) {
      return false;
    }
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const loadAndRefreshData = async () => {
      setIsLoading(true);
      
      // Check for existing auth token and player data
      const token = localStorage.getItem('authToken');
      const storedPlayerData = localStorage.getItem('playerData');
      
      if (token && storedPlayerData) {
        try {
          const parsedPlayerData = JSON.parse(storedPlayerData);
          setPlayerData(parsedPlayerData);
          
          // Always refresh data to get comprehensive stats and sessions
          if (parsedPlayerData && parsedPlayerData.player_id) {
            try {
              console.log('[AuthContext] Refreshing player data for:', parsedPlayerData.player_id);
              const freshData = await apiGetPlayerData(parsedPlayerData.player_id);
              console.log('[AuthContext] Fresh data received:', freshData ? 'success' : 'failed');
              if (freshData && freshData.stats) {
                localStorage.setItem('playerData', JSON.stringify(freshData));
                setPlayerData(freshData);
              } else {
                console.warn('[AuthContext] Player data API failed, loading sessions and stats separately');
                
                // Load sessions from working sessions API
                const sessionsResponse = await fetch(`/api/player/${parsedPlayerData.player_id}/sessions?limit=5`);
                const sessionsData = sessionsResponse.ok ? await sessionsResponse.json() : null;
                const sessions = sessionsData?.sessions || [];
                
                // Load stats from working debug-stats API
                const debugStatsResponse = await fetch('/api/debug-stats');
                const debugStatsData = debugStatsResponse.ok ? await debugStatsResponse.json() : null;
                const stats = debugStatsData?.dashboard_data?.stats || {
                  total_sessions: 0,
                  total_makes: 0,
                  total_misses: 0,
                  best_streak: 0,
                  fastest_21_makes_seconds: null,
                  max_makes_per_minute: 0,
                  max_putts_per_minute: 0,
                  most_in_60_seconds: 0,
                  max_session_duration: 0,
                  make_percentage: 0,
                  last_session_at: null
                };
                
                console.log('[AuthContext] Loaded from fallback APIs:', { 
                  sessions_count: sessions.length, 
                  stats_total_makes: stats.total_makes 
                });
                
                const playerDataWithStats = {
                  ...parsedPlayerData,
                  stats,
                  sessions
                };
                localStorage.setItem('playerData', JSON.stringify(playerDataWithStats));
                setPlayerData(playerDataWithStats);
              }
            } catch (error) {
              console.error('[AuthContext] Failed to refresh player data on mount:', error);
              
              // Try fallback APIs even on error
              try {
                console.log('[AuthContext] Trying fallback APIs after error');
                const sessionsResponse = await fetch(`/api/player/${parsedPlayerData.player_id}/sessions?limit=5`);
                const sessionsData = sessionsResponse.ok ? await sessionsResponse.json() : null;
                const sessions = sessionsData?.sessions || [];
                
                const debugStatsResponse = await fetch('/api/debug-stats');
                const debugStatsData = debugStatsResponse.ok ? await debugStatsResponse.json() : null;
                const stats = debugStatsData?.dashboard_data?.stats || {
                  total_sessions: 0, total_makes: 0, total_misses: 0, best_streak: 0,
                  fastest_21_makes_seconds: null, max_makes_per_minute: 0, max_putts_per_minute: 0,
                  most_in_60_seconds: 0, max_session_duration: 0, make_percentage: 0, last_session_at: null
                };
                
                const playerDataWithStats = {
                  ...parsedPlayerData,
                  stats,
                  sessions
                };
                localStorage.setItem('playerData', JSON.stringify(playerDataWithStats));
                setPlayerData(playerDataWithStats);
                console.log('[AuthContext] Successfully loaded fallback data:', { sessions: sessions.length, makes: stats.total_makes });
              } catch (fallbackError) {
                console.error('[AuthContext] Fallback APIs also failed:', fallbackError);
                // Final fallback to basic structure
                const playerDataWithStats = {
                  ...parsedPlayerData,
                  stats: { total_sessions: 0, total_makes: 0, total_misses: 0, best_streak: 0,
                    fastest_21_makes_seconds: null, max_makes_per_minute: 0, max_putts_per_minute: 0,
                    most_in_60_seconds: 0, max_session_duration: 0, make_percentage: 0, last_session_at: null },
                  sessions: []
                };
                localStorage.setItem('playerData', JSON.stringify(playerDataWithStats));
                setPlayerData(playerDataWithStats);
              }
            }
          }
        } catch (error) {
          console.error('Failed to parse stored player data:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('playerData');
          setPlayerData(null);
        }
      }
      
      setIsLoading(false);
    };

    loadAndRefreshData();
  }, []); // Run once on mount

  const login = async (email, password) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.token && data.player) {
        localStorage.setItem('authToken', data.token);
        
        // Fetch comprehensive player data including stats and sessions
        try {
          const comprehensiveData = await apiGetPlayerData(data.player.player_id);
          localStorage.setItem('playerData', JSON.stringify(comprehensiveData));
          setPlayerData(comprehensiveData);
        } catch (error) {
          // Fallback to basic player data with empty stats if comprehensive fetch fails
          console.warn('Could not fetch comprehensive player data, using basic data with default stats:', error);
          const basicPlayerDataWithStats = {
            ...data.player,
            stats: {
              total_sessions: 0,
              total_makes: 0,
              total_misses: 0,
              best_streak: 0,
              fastest_21_makes_seconds: null,
              max_makes_per_minute: 0,
              max_putts_per_minute: 0,
              most_in_60_seconds: 0,
              max_session_duration: 0,
              make_percentage: 0,
              last_session_at: null
            },
            sessions: []
          };
          localStorage.setItem('playerData', JSON.stringify(basicPlayerDataWithStats));
          setPlayerData(basicPlayerDataWithStats);
        }
        
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
        return { success: true };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      localStorage.removeItem('authToken');
      localStorage.removeItem('playerData');
      setPlayerData(null);
      return { success: false, error: error.message };
    }
  };

  const register = async (email, password, name) => {
    try {
      const authData = await apiRegister(email, password, name);
      // Fetch complete player data after successful registration
      const playerData = await apiGetPlayerData(authData.player_id);
      localStorage.setItem('playerData', JSON.stringify(playerData));
      setPlayerData(playerData);
      navigate('/');
    } catch (error) {
      localStorage.removeItem('playerData');
      setPlayerData(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('playerData');
    setPlayerData(null);
    navigate('/login');
  };

  const refreshData = async (playerId = null) => {
    const targetPlayerId = playerId || playerData?.player_id;
    if (!targetPlayerId) return;
    try {
      const freshData = await apiGetPlayerData(targetPlayerId);
      localStorage.setItem('playerData', JSON.stringify(freshData));
      setPlayerData(freshData);
      return freshData;
    } catch (error) {
      console.error('Could not refresh user data:', error);
      // Keep existing playerData if refresh fails, don't corrupt the state
      throw error;
    }
  };

  const refreshSessionsOnly = async () => {
    if (!playerData) return;
    try {
      const latestSessions = await apiGetLatestSessions(playerData.player_id, 5);
      const updatedPlayerData = {
        ...playerData,
        sessions: latestSessions,
        last_session_refresh: new Date().toISOString()
      };
      localStorage.setItem('playerData', JSON.stringify(updatedPlayerData));
      setPlayerData(updatedPlayerData);
      return latestSessions;
    } catch (error) {
      console.error('Could not refresh session data:', error);
      throw error;
    }
  };

  const changePassword = async (oldPassword, newPassword) => {
    if (!playerData) throw new Error("You must be logged in to change your password.");
    try {
      const response = await apiChangePassword(playerData.player_id, oldPassword, newPassword);
      return response;
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  };

  // Expose playerTimezone for convenience
  const playerTimezone = playerData?.timezone || 'UTC';

  const value = {
    playerData,
    playerTimezone,
    isAuthenticated: !!playerData,
    isLoading,
    login,
    register,
    logout,
    refreshData,
    refreshSessionsOnly,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};