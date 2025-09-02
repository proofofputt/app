import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiLogin, apiRegister, apiGetPlayerData, apiGetLatestSessions } from '../api.js';

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
      // Check for existing auth token and player data
      const token = localStorage.getItem('authToken');
      const storedPlayerData = localStorage.getItem('playerData');
      
      if (token && storedPlayerData && !playerData) {
        try {
          const parsedPlayerData = JSON.parse(storedPlayerData);
          setPlayerData(parsedPlayerData);
          
          // Optionally refresh data if player_id exists
          if (parsedPlayerData && parsedPlayerData.player_id) {
            try {
              const freshData = await apiGetPlayerData(parsedPlayerData.player_id);
              localStorage.setItem('playerData', JSON.stringify(freshData));
              setPlayerData(freshData);
            } catch (error) {
              console.error('Failed to refresh player data on mount:', error);
              // Keep existing playerData if refresh fails
            }
          }
        } catch (error) {
          console.error('Failed to parse stored player data:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('playerData');
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
        localStorage.setItem('playerData', JSON.stringify(data.player));
        setPlayerData(data.player);
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

  const refreshData = async () => {
    if (!playerData) return;
    try {
      const freshData = await apiGetPlayerData(playerData.player_id);
      localStorage.setItem('playerData', JSON.stringify(freshData));
      setPlayerData(freshData);
    } catch (error) {
      console.error('Could not refresh user data:', error);
      // Keep existing playerData if refresh fails, don't corrupt the state
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