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
import DebugPlayerPage from './pages/DebugPlayerPage';
import SessionHistoryPage from './components/SessionHistoryPage';
import PlayerCareerPage from './pages/PlayerCareerPage';
import CoachPage from './components/CoachPage';
import PlayerVsPlayerPage from './pages/PlayerVsPlayerPage';
import NotificationsPage from './pages/NotificationsPage';
import ContactsPage from './pages/ContactsPage';
// import NetworkingPreferencesPage from './pages/NetworkingPreferencesPage'; // Temporarily disabled
import CommentsPage from './pages/CommentsPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage';
import AdminClubUpdatesPage from './pages/AdminClubUpdatesPage';
import ClubsPage from './pages/ClubsPage';
import MyGifts from './components/MyGifts';
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
  const [oauthProcessing, setOauthProcessing] = React.useState(false);

  // Handle OAuth callback at app level (but not in popup windows)
  useEffect(() => {
    // If this is a popup window, send OAuth result to parent and close
    if (window.opener) {
      console.log('[App] Detected popup window, checking for OAuth params');
      const urlParams = new URLSearchParams(location.search);
      const oauthResult = handleOAuthCallback(urlParams);

      if (oauthResult.success || oauthResult.error) {
        console.log('[App] Sending OAuth result to parent window');
        window.opener.postMessage({
          type: 'OAUTH_RESULT',
          result: oauthResult
        }, window.location.origin);

        // Close popup after sending message
        setTimeout(() => {
          window.close();
        }, 100);
      }
      return;
    }

    const urlParams = new URLSearchParams(location.search);
    const oauthResult = handleOAuthCallback(urlParams);

    if (oauthResult.success && oauthResult.token) {
      setOauthProcessing(true);
      console.log('[App] OAuth callback detected, storing token');
      localStorage.setItem('authToken', oauthResult.token);

      // Decode JWT to get player_id and fetch player data
      try {
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
                console.log('[App] Player data stored, reloading page');
                // Reload to update auth state with clean URL
                window.location.href = '/';
              } else {
                console.error('[App] Invalid player data:', playerData);
                setOauthProcessing(false);
              }
            })
            .catch(error => {
              console.error('[App] Failed to fetch player data:', error);
              setOauthProcessing(false);
            });
        } else {
          console.error('[App] No playerId in JWT');
          setOauthProcessing(false);
        }
      } catch (error) {
        console.error('[App] Failed to decode JWT:', error);
        setOauthProcessing(false);
      }
    }
  }, [location.search, navigate]);

  if (isLoading || oauthProcessing) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
        <p>{oauthProcessing ? 'Completing sign in...' : 'Loading...'}</p>
      </div>
    );
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
          <Route path="/clubs" element={<ClubsPage />} />

          {/* Root Route - Dashboard if authenticated, otherwise redirect to login */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/player/:playerId/sessions" element={<ProtectedRoute><SessionHistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/duels" element={<ProtectedRoute><DuelsPage /></ProtectedRoute>} />
          <Route path="/player/:playerId/stats" element={<ProtectedRoute><PlayerCareerPage /></ProtectedRoute>} />
          <Route path="/leagues/:leagueId" element={<ProtectedRoute><LeagueDetailPage /></ProtectedRoute>} />
          <Route path="/leagues" element={<ProtectedRoute><LeaguesPage /></ProtectedRoute>} />
          <Route path="/debug/player" element={<ProtectedRoute><DebugPlayerPage /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/coach/:conversationId" element={<ProtectedRoute><CoachPage /></ProtectedRoute>} />
          <Route path="/players/:player1Id/vs/:player2Id" element={<ProtectedRoute><PlayerVsPlayerPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/comments" element={<ProtectedRoute><CommentsPage /></ProtectedRoute>} />
          {/* Temporarily disabled - keeping for future consideration */}
          {/* <Route path="/networking-preferences" element={<ProtectedRoute><NetworkingPreferencesPage /></ProtectedRoute>} /> */}
          <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
          <Route path="/gifts" element={<ProtectedRoute><MyGifts /></ProtectedRoute>} />
          <Route path="/admin/feedback" element={<ProtectedRoute><AdminFeedbackPage /></ProtectedRoute>} />
          <Route path="/admin/subscriptions" element={<ProtectedRoute><AdminSubscriptionsPage /></ProtectedRoute>} />
          <Route path="/admin/club-updates" element={<ProtectedRoute><AdminClubUpdatesPage /></ProtectedRoute>} />
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