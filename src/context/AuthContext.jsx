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
      if (playerData && playerData.player_id) {
        try {
          const freshData = await apiGetPlayerData(playerData.player_id);
          localStorage.setItem('playerData', JSON.stringify(freshData));
          setPlayerData(freshData);
        } catch (error) {
          console.error('Failed to refresh player data on mount:', error);
          // Keep existing playerData if refresh fails, don't corrupt the state
        }
      }
      setIsLoading(false); // Set loading to false after attempt to load/refresh
    };

    loadAndRefreshData();
  }, []); // Run once on mount

  const login = async (email, password) => {
    try {
      const authData = await apiLogin(email, password);
      // Fetch complete player data after successful authentication
      const playerData = await apiGetPlayerData(authData.player_id);
      localStorage.setItem('playerData', JSON.stringify(playerData));
      setPlayerData(playerData);
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      // Clear any potentially stale data on login failure
      localStorage.removeItem('playerData');
      setPlayerData(null);
      throw error;
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