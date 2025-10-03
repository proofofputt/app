import React, { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { PersistentNotificationProvider } from './context/PersistentNotificationContext';
import { handleOAuthCallback } from './utils/oauth';
import Dashboard from './components/Dashboard';
import DuelsPage from './components/DuelsPage';
import SettingsPage from './pages/SettingsPage';
import LeagueDetailPage from './components/LeagueDetailPage';
import LeaguesPage from './pages/LeaguesPage';
import SessionHistoryPage from './components/SessionHistoryPage';
import PlayerCareerPage from './pages/PlayerCareerPage';
import CoachPage from './components/CoachPage';
import PlayerVsPlayerPage from './pages/PlayerVsPlayerPage';
import NotificationsPage from './pages/NotificationsPage';
import ContactsPage from './pages/ContactsPage';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LinkAccountPage from './pages/LinkAccountPage';
import SetupAccountPage from './pages/SetupAccountPage';
import './App.css';

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { playerData, isLoading } = useAuth();

  // Handle OAuth callback at app level
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const oauthResult = handleOAuthCallback(urlParams);

    if (oauthResult.success && oauthResult.token) {
      console.log('[App] OAuth callback detected, storing token');
      localStorage.setItem('authToken', oauthResult.token);

      // Decode JWT to get player_id and fetch player data
      const payload = JSON.parse(atob(oauthResult.token.split('.')[1]));
      console.log('[App] Decoded payload:', payload);

      if (payload.playerId) {
        console.log(`[App] Fetching player data for ID ${payload.playerId}`);
        fetch(`/api/player/${payload.playerId}/data`, {
          headers: {
            'Authorization': `Bearer ${oauthResult.token}`
          }
        })
          .then(res => {
            console.log(`[App] Player data response status: ${res.status}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(playerData => {
            console.log('[App] Player data received:', playerData);
            if (playerData && playerData.player_id) {
              localStorage.setItem('playerData', JSON.stringify(playerData));
              console.log('[App] Player data stored, cleaning URL');
              // Clean URL and force reload to update auth state
              navigate('/', { replace: true });
              window.location.reload();
            }
          })
          .catch(error => {
            console.error('[App] Failed to fetch player data:', error);
          });
      }
    }
  }, [location.search, navigate]);

  if (isLoading) {
    return <p style={{ textAlign: 'center', padding: '2rem' }}>Loading...</p>;
  }

  return (
    <div className="App">
      {playerData && <Header />}
      <main className="container-fluid">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/link-account" element={<LinkAccountPage />} />
          <Route path="/setup-account" element={<SetupAccountPage />} />

          {/* Root Route - Dashboard if authenticated, otherwise redirect to login */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/player/:playerId/sessions" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/duels" element={<ProtectedRoute><DuelsPage /></ProtectedRoute>} />
          <Route path="/player/:playerId/stats" element={<ProtectedRoute><PlayerCareerPage /></ProtectedRoute>} />
          <Route path="/leagues/:leagueId" element={<ProtectedRoute><LeagueDetailPage /></ProtectedRoute>} />
          <Route path="/leagues" element={<ProtectedRoute><LeaguesPage /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/coach/:conversationId" element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/players/:player1Id/vs/:player2Id" element={<ProtectedRoute><PlayerVsPlayerPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <PersistentNotificationProvider>
          <AppContent />
        </PersistentNotificationProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;