import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [playerData, setPlayerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedPlayerData = localStorage.getItem('playerData');
    
    if (token && savedPlayerData) {
      try {
        const parsedPlayerData = JSON.parse(savedPlayerData);
        setPlayerData(parsedPlayerData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing saved player data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('playerData');
      }
    }
    setIsLoading(false);
  }, []);

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
        setIsAuthenticated(true);
        return { success: true };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('playerData');
    setPlayerData(null);
    setIsAuthenticated(false);
  };

  const value = {
    playerData,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};